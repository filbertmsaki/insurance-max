import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyPremiumBreakdown } from '../../policies/entities/policy-premium-breakdown.entity';
import { PolicyRisk } from '../../policies/entities/policy-risk.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationPremiumItemType } from '../../quotations/enums/quotation-premium-item-type.enum';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';

const TIRA_COVER_NOTE_TYPE_ENDORSEMENT = 3;

/**
 * Builds the JSON payload TIRAMIS expects for a cover-note *amendment*
 * (endorsement or cancellation), matching the shape of
 * `apps/tiramis/src/modules/cover-notes/dto/create-cover-note.dto.ts` (the
 * two backend services are separate deployable apps, so this is a plain
 * object across the TCP boundary, not a shared class).
 *
 * Some request-shape fields (`operativeClause`, `paymentMode`,
 * `officerName`/`officerTitle`, `productCode`, `currencyCode`,
 * `exchangeRate`) are not stored anywhere on the issued `Policy` itself —
 * they are pulled from the originating quotation's cover-note record
 * (`QuotationCoverNote`), the same source the original submission used.
 */
@Injectable()
export class PolicyTransactionTiramisPayloadService {
  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,
    @InjectRepository(PolicyPremiumBreakdown)
    private readonly breakdownRepository: Repository<PolicyPremiumBreakdown>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async buildEndorsementPayload(
    transaction: PolicyTransaction,
    endorsement: PolicyEndorsement,
    policy: Policy,
  ): Promise<Record<string, unknown>> {
    if (
      !transaction.proposed_policy_snapshot ||
      !transaction.proposed_policy_snapshot_hash
    ) {
      throw new BadRequestException(
        'The endorsement does not contain an authoritative proposed policy snapshot.',
      );
    }

    if (!transaction.pricing_snapshot || !transaction.pricing_snapshot_hash) {
      throw new BadRequestException(
        'The endorsement has not been authoritatively priced.',
      );
    }

    if (endorsement.tira_endorsement_type == null) {
      throw new BadRequestException(
        'The selected endorsement type does not have a TIRAMIS endorsement-type mapping.',
      );
    }

    if (!endorsement.previous_cover_note_reference) {
      throw new BadRequestException(
        'The previous TIRAMIS cover-note reference is required.',
      );
    }

    const snapshot = transaction.proposed_policy_snapshot;
    const pricing = transaction.pricing_snapshot;
    const source = this.asObject(snapshot['source']) ?? {};
    const cover = this.asObject(snapshot['cover']) ?? {};
    const sourceTotals =
      this.asObject(transaction.source_policy_snapshot['totals']) ?? {};
    const entries = this.asArray(snapshot['entries'])
      .map((entry) => this.asObject(entry))
      .filter((entry): entry is Record<string, unknown> => !!entry);

    if (!entries.length) {
      throw new BadRequestException(
        'The proposed policy snapshot does not contain insured entries.',
      );
    }

    const [company, actor] = await Promise.all([
      this.companyRepository.findOne({
        where: { id: policy.insurer_company_id },
      }),
      transaction.completed_by
        ? this.userRepository.findOne({
            where: { id: transaction.completed_by },
          })
        : null,
    ]);

    if (!company) {
      throw new BadRequestException(
        'The underwriting insurer could not be resolved.',
      );
    }

    const revisedTotalPremium = this.money(pricing['revisedFullTermPremium']);
    const revisedTax = DecimalUtil.value(
      sourceTotals['totalTax'] as string | number | null | undefined,
    )
      .plus(
        DecimalUtil.value(
          pricing['taxDifference'] as string | number | null | undefined,
        ),
      )
      .toFixed(4);
    const revisedCommission = DecimalUtil.value(
      sourceTotals['totalCommission'] as string | number | null | undefined,
    )
      .plus(
        DecimalUtil.value(
          pricing['commissionDifference'] as string | number | null | undefined,
        ),
      )
      .toFixed(4);
    const totalPremiumExcludingTax = DecimalUtil.value(revisedTotalPremium)
      .minus(DecimalUtil.value(revisedTax))
      .toFixed(4);
    const policyHolders = this.mapPolicyHoldersFromSnapshot(snapshot);

    if (!policyHolders.length) {
      throw new BadRequestException(
        'The proposed policy does not contain a policyholder.',
      );
    }

    const quotationFlow = String(source['quotationFlow'] ?? '');
    const isFleet =
      source['isFleet'] === true || quotationFlow === 'MOTOR_FLEET';
    const officer = this.asObject(cover['officer']);
    const common = {
      insurerCompanyCode: company.tira_insurer_company_code,
      tranCompanyCode:
        company.tira_company_code ?? company.tira_insurer_company_code,
      coverNoteType: TIRA_COVER_NOTE_TYPE_ENDORSEMENT,
      salePointCode: cover['salePointCode'] ?? null,
      coverNoteStartDate: transaction.effective_date,
      coverNoteEndDate: cover['endDate'] ?? snapshot['endDate'],
      paymentMode: cover['paymentMode'] ?? null,
      currencyCode: transaction.currency_code,
      exchangeRate: String(cover['exchangeRate'] ?? '1'),
      totalPremiumExcludingTax,
      totalPremiumIncludingTax: revisedTotalPremium,
      commissionPaid: revisedCommission,
      commissionRate: String(cover['commissionRate'] ?? '0'),
      officerName: actor
        ? `${actor.first_name ?? ''} ${actor.last_name ?? ''}`.trim()
        : String(officer?.['name'] ?? ''),
      officerTitle: actor?.officer_title ?? officer?.['title'] ?? null,
      productCode: cover['productCode'] ?? null,
      endorsementType: endorsement.tira_endorsement_type,
      endorsementReason: transaction.reason,
      endorsementPremiumEarned: this.money(
        pricing['earnedPremiumBeforeChange'],
      ),
      policyHolders,
    };

    if (isFleet) {
      return this.buildFleetEndorsementPayload(
        transaction,
        endorsement,
        snapshot,
        pricing,
        entries,
        common,
      );
    }

    const entry = entries[0];

    const previousCoverNoteReferenceNumber = this.resolvePreviousReference(
      transaction,
      endorsement,
      entry,
      0,
    );

    return {
      ...common,
      coverNoteNumber: this.buildEndorsementCoverNoteNumber(
        transaction.transaction_no,
      ),
      ...this.previousCoverNoteReferenceFields(
        previousCoverNoteReferenceNumber,
      ),
      coverNoteDesc:
        entry['coverNoteDescription'] ??
        `Endorsement ${transaction.transaction_no}`,
      operativeClause: entry['operativeClause'] ?? 'Endorsement',
      risks: this.mapEntryRisks(pricing, 0),
      subjectMatters: this.mapSubjectMatters(entry),
      addons: this.mapAddons(entry),
      ...(entry['motor']
        ? {
            isFleet: false,
            motorDetail: this.mapMotorDetail(this.asObject(entry['motor'])!),
          }
        : {}),
    };
  }

  async buildCancellationPayload(
    transaction: PolicyTransaction,
    cancellation: PolicyCancellation,
    policy: Policy,
  ): Promise<Record<string, unknown>> {
    if (
      !transaction.proposed_policy_snapshot ||
      !transaction.proposed_policy_snapshot_hash
    ) {
      throw new BadRequestException(
        'The cancellation does not contain an authoritative proposed policy snapshot.',
      );
    }

    if (!transaction.pricing_snapshot || !transaction.pricing_snapshot_hash) {
      throw new BadRequestException(
        'The cancellation has not been authoritatively priced.',
      );
    }

    if (cancellation.tira_endorsement_type == null) {
      throw new BadRequestException(
        'The company does not have a valid TIRAMIS cancellation endorsement-type mapping.',
      );
    }

    if (!cancellation.previous_cover_note_reference) {
      throw new BadRequestException(
        'The previous TIRAMIS cover-note reference is required.',
      );
    }

    const source = this.asObject(
      transaction.source_policy_snapshot?.['source'],
    );
    const issuedCoverNote = this.asObject(source?.['finalizationSnapshot']);
    if (!issuedCoverNote) {
      throw new BadRequestException(
        'The issued policy does not contain its authoritative TIRAMIS cover-note snapshot.',
      );
    }

    // Preserve the issued motor/fleet, holder and signed risk-pricing data.
    // TIRAMIS validates those fields again for cancellation endorsements.
    const base = { ...issuedCoverNote };
    // The quotation snapshot also stores a portal-only routing field, which
    // TIRAMIS's strict submission DTO does not accept.
    delete base['branchCode'];

    return {
      ...base,
      coverNoteType: TIRA_COVER_NOTE_TYPE_ENDORSEMENT,
      coverNoteNumber: transaction.transaction_no,
      coverNoteStartDate: transaction.effective_date,
      coverNoteEndDate: issuedCoverNote['coverNoteEndDate'] ?? policy.end_date,
      coverNoteDesc: `Cancellation ${transaction.transaction_no}`,
      operativeClause: 'Cancellation',
      ...this.previousCoverNoteReferenceFields(
        cancellation.previous_cover_note_reference,
      ),
      endorsementType: cancellation.tira_endorsement_type,
      endorsementReason: transaction.reason,
      endorsementPremiumEarned: DecimalUtil.money(cancellation.earned_premium),
    };
  }

  private async buildBasePayload(
    transaction: PolicyTransaction,
    policy: Policy,
  ): Promise<Record<string, unknown>> {
    const [company, actor, quotation, risks] = await Promise.all([
      this.companyRepository.findOne({
        where: { id: policy.insurer_company_id },
      }),
      transaction.completed_by
        ? this.userRepository.findOne({
            where: { id: transaction.completed_by },
          })
        : null,
      policy.quotation_id
        ? this.quotationRepository.findOne({
            where: { id: policy.quotation_id },
            relations: { cover_note: true },
          })
        : null,
      this.policyRiskRepository.find({
        where: { policy_id: policy.id },
        relations: { risk: true },
      }),
    ]);

    const coverNote = quotation?.cover_note ?? null;
    const riskDtos = await Promise.all(
      risks.map((risk) => this.buildRiskPayload(risk)),
    );

    return {
      insurerCompanyCode: company?.tira_insurer_company_code ?? null,
      tranCompanyCode:
        company?.tira_company_code ??
        company?.tira_insurer_company_code ??
        null,
      coverNoteType: coverNote?.cover_note_type ?? null,
      coverNoteNumber: policy.cover_note_no,
      salePointCode: coverNote?.sale_point_code ?? null,
      coverNoteStartDate: policy.start_date,
      coverNoteEndDate: policy.end_date,
      coverNoteDesc: `Amendment to policy ${policy.policy_no}`,
      operativeClause: 'Amendment',
      paymentMode: coverNote?.payment_mode ?? null,
      currencyCode: policy.currency,
      exchangeRate: coverNote?.exchange_rate ?? '1.0000000000',
      totalPremiumExcludingTax: DecimalUtil.subtract(
        policy.total_premium,
        policy.total_tax,
      ),
      totalPremiumIncludingTax: policy.total_premium,
      commissionPaid: policy.total_commission,
      commissionRate: coverNote?.commission_rate ?? '0',
      officerName: actor
        ? `${actor.first_name} ${actor.last_name}`.trim()
        : (coverNote?.officer_name ?? null),
      officerTitle: actor?.officer_title ?? coverNote?.officer_title ?? null,
      productCode: coverNote?.product_code ?? null,
      risks: riskDtos,
      policyHolders: this.buildPolicyHolders(policy),
    };
  }

  private async buildRiskPayload(risk: PolicyRisk) {
    const breakdowns = await this.breakdownRepository.find({
      where: { policy_risk_id: risk.id },
    });

    const discounts = breakdowns.filter(
      (item) => item.item_type === QuotationPremiumItemType.DISCOUNT,
    );
    const taxes = breakdowns.filter(
      (item) => item.item_type === QuotationPremiumItemType.TAX,
    );

    return {
      riskCode: risk.risk?.risk_code ?? null,
      sumInsured: risk.sum_insured,
      sumInsuredEquivalent: risk.sum_insured,
      premiumRate: risk.rate,
      premiumBeforeDiscount: risk.basic_premium,
      premiumAfterDiscount: DecimalUtil.subtract(
        risk.basic_premium,
        risk.discount_amount,
      ),
      premiumExcludingTaxEquivalent: DecimalUtil.subtract(
        risk.total_premium,
        risk.tax_amount,
      ),
      premiumIncludingTax: risk.total_premium,
      discounts: discounts.map((discount) => ({
        discountType: null,
        discountRate: discount.rate,
        discountAmount: discount.amount,
      })),
      taxes: taxes.map((tax) => ({
        taxCode: tax.item_code,
        taxRate: tax.rate,
        taxAmount: tax.amount,
      })),
    };
  }

  private buildPolicyHolders(policy: Policy) {
    const holder = policy.customer_snapshot?.policyHolder as
      | Record<string, unknown>
      | null
      | undefined;

    if (!holder) {
      return [];
    }

    return [
      {
        policyHolderName: holder.name ?? null,
        policyHolderBirthDate: holder.birthDate ?? null,
        policyHolderType: holder.type ?? null,
        policyHolderIdNumber: holder.idNumber ?? null,
        policyHolderIdType: holder.idType ?? null,
        countryCode: holder.countryCode ?? null,
        region: holder.region ?? null,
        district: holder.district ?? null,
        phoneNumber: holder.phone ?? null,
        emailAddress: holder.email ?? null,
      },
    ];
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private money(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return '0.0000';
    }

    return DecimalUtil.value(value as string | number).toFixed(4);
  }

  private mapPolicyHoldersFromSnapshot(snapshot: Record<string, unknown>) {
    return this.asArray(snapshot['policyHolders'])
      .map((value) => this.asObject(value))
      .filter((holder): holder is Record<string, unknown> => !!holder)
      .map((holder) => ({
        policyHolderName: holder['name'] ?? null,
        policyHolderBirthDate: holder['birthDate'] ?? null,
        policyHolderType: holder['type'] ?? null,
        policyHolderIdNumber: holder['idNumber'] ?? null,
        policyHolderIdType: holder['idType'] ?? null,
        gender: holder['gender'] ?? null,
        countryCode: holder['countryCode'] ?? null,
        region: holder['region'] ?? null,
        district: holder['district'] ?? null,
        street: holder['street'] ?? null,
        phoneNumber: holder['phone'] ?? null,
        fax: holder['fax'] ?? null,
        postalAddress: holder['postalAddress'] ?? null,
        emailAddress: holder['email'] ?? null,
      }));
  }

  private mapMotorDetail(motor: Record<string, unknown>) {
    return {
      motorCategory: motor['motorCategory'] ?? null,
      motorType: motor['motorType'] ?? null,
      registrationNumber: motor['registrationNumber'] ?? null,
      chassisNumber: motor['chassisNumber'] ?? null,
      make: motor['make'] ?? null,
      model: motor['model'] ?? null,
      modelNumber: motor['modelNumber'] ?? null,
      bodyType: motor['bodyType'] ?? null,
      color: motor['color'] ?? null,
      engineNumber: motor['engineNumber'] ?? null,
      engineCapacity: motor['engineCapacity'] ?? null,
      fuelUsed: motor['fuelUsed'] ?? null,
      numberOfAxles: motor['numberOfAxles'] ?? null,
      axleDistance: motor['axleDistance'] ?? null,
      sittingCapacity: motor['sittingCapacity'] ?? null,
      yearOfManufacture: motor['yearOfManufacture'] ?? null,
      tareWeight: motor['tareWeight'] ?? null,
      grossWeight: motor['grossWeight'] ?? null,
      motorUsage: motor['motorUsage'] ?? null,
      ownerName: motor['ownerName'] ?? null,
      ownerCategory: motor['ownerCategory'] ?? null,
      ownerAddress: motor['ownerAddress'] ?? null,
    };
  }

  private mapEntryRisks(pricing: Record<string, unknown>, entryIndex: number) {
    return this.asArray(pricing['proposedRiskPricing'])
      .map((value) => this.asObject(value))
      .filter(
        (risk): risk is Record<string, unknown> =>
          !!risk && Number(risk['entryIndex']) === entryIndex,
      )
      .sort(
        (left, right) => Number(left['riskIndex']) - Number(right['riskIndex']),
      )
      .map((risk) => ({
        riskCode: risk['riskCode'],
        sumInsured: risk['sumInsured'],
        sumInsuredEquivalent: risk['sumInsuredEquivalent'],
        premiumRate: risk['premiumRate'],
        premiumBeforeDiscount: risk['premiumBeforeDiscount'],
        premiumAfterDiscount: risk['premiumAfterDiscount'],
        premiumExcludingTaxEquivalent: risk['premiumExcludingTaxEquivalent'],
        premiumIncludingTax: risk['premiumIncludingTax'],
        discounts: risk['discounts'] ?? [],
        taxes: risk['taxes'] ?? [],
      }));
  }

  private mapSubjectMatters(entry: Record<string, unknown>) {
    return this.asArray(entry['subjectMatters'])
      .map((item) => this.asObject(item))
      .filter((item): item is Record<string, unknown> => !!item)
      .map((item) => ({
        subjectMatterReference: item['reference'] ?? null,
        subjectMatterDesc: item['description'] ?? null,
      }));
  }

  private mapAddons(entry: Record<string, unknown>) {
    const pricing = this.asObject(entry['pricing']);

    return this.asArray(pricing?.['addons'])
      .map((item) => this.asObject(item))
      .filter((item): item is Record<string, unknown> => !!item)
      .map((item) => ({
        addonReference: item['reference'] ?? null,
        addonDesc: item['description'] ?? null,
        addonAmount: item['amount'] ?? '0',
        addonPremiumRate: item['premiumRate'] ?? '0',
        premiumExcludingTax: item['premiumExcludingTax'] ?? '0',
        premiumExcludingTaxEquivalent:
          item['premiumExcludingTaxEquivalent'] ?? '0',
        premiumIncludingTax: item['premiumIncludingTax'] ?? '0',
        taxes: item['taxes'] ?? [],
      }));
  }

  private buildEndorsementCoverNoteNumber(
    transactionNo: string,
    fleetEntry?: number,
  ) {
    if (fleetEntry === undefined) {
      return transactionNo;
    }

    return `${transactionNo}-${String(fleetEntry).padStart(3, '0')}`;
  }

  private resolvePreviousReference(
    transaction: PolicyTransaction,
    endorsement: PolicyEndorsement,
    entry: Record<string, unknown>,
    entryIndex: number,
  ): string {
    const sourceCoverNotes = this.asArray(
      transaction.source_policy_snapshot['coverNotes'],
    )
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    const entryId = entry['entryId'];
    const fleetEntry = entry['fleetEntry'];
    const matched = sourceCoverNotes.find(
      (note) =>
        (entryId && note['quotationEntryId'] === entryId) ||
        (fleetEntry != null && note['fleetEntry'] === fleetEntry),
    );
    const reference = matched?.['coverNoteReferenceNumber'];

    if (typeof reference === 'string' && reference.trim()) {
      return reference;
    }

    if (entryIndex === 0 && endorsement.previous_cover_note_reference) {
      return endorsement.previous_cover_note_reference;
    }

    return endorsement.previous_cover_note_reference;
  }

  private buildFleetEndorsementPayload(
    transaction: PolicyTransaction,
    endorsement: PolicyEndorsement,
    snapshot: Record<string, unknown>,
    pricing: Record<string, unknown>,
    entries: Record<string, unknown>[],
    common: Record<string, unknown>,
  ) {
    const cover = this.asObject(snapshot['cover']) ?? {};
    const fleet = this.asObject(cover['fleet']) ?? {};
    const items = entries.map((entry, index) => {
      const fleetEntry = Number(entry['fleetEntry'] ?? index + 1);
      const previousCoverNoteReferenceNumber = this.resolvePreviousReference(
        transaction,
        endorsement,
        entry,
        index,
      );

      return {
        fleetEntry: String(fleetEntry),
        coverNoteNumber: this.buildEndorsementCoverNoteNumber(
          transaction.transaction_no,
          fleetEntry,
        ),
        ...this.previousCoverNoteReferenceFields(
          previousCoverNoteReferenceNumber,
        ),
        coverNoteDesc:
          entry['coverNoteDescription'] ??
          `Endorsement ${transaction.transaction_no}`,
        operativeClause: entry['operativeClause'] ?? 'Endorsement',
        endorsementType: endorsement.tira_endorsement_type,
        endorsementReason: transaction.reason,
        endorsementPremiumEarned: this.money(
          pricing['earnedPremiumBeforeChange'],
        ),
        risks: this.mapEntryRisks(pricing, index),
        subjectMatters: this.mapSubjectMatters(entry),
        addons: this.mapAddons(entry),
        motorDetail: entry['motor']
          ? this.mapMotorDetail(this.asObject(entry['motor'])!)
          : null,
      };
    });

    return {
      ...common,
      coverNoteNumber: items[0]?.coverNoteNumber,
      ...this.previousCoverNoteReferenceFields(
        items[0]?.previousCoverNoteReferenceNumber ??
          items[0]?.prevCoverNoteReferenceNumber,
      ),
      coverNoteDesc: items[0]?.coverNoteDesc,
      operativeClause: items[0]?.operativeClause,
      risks: items[0]?.risks ?? [],
      subjectMatters: items[0]?.subjectMatters ?? [],
      addons: items[0]?.addons ?? [],
      isFleet: true,
      fleet: {
        fleetId: fleet['fleetId'] ?? null,
        fleetType: fleet['fleetType'] ?? null,
        fleetSize: entries.length,
        comprehensiveInsured: fleet['comprehensiveInsured'] ?? null,
        items,
      },
    };
  }

  private previousCoverNoteReferenceFields(
    reference: unknown,
  ): Record<string, unknown> {
    return {
      previousCoverNoteReferenceNumber: reference,
      // Compatibility for older Tiramis deployments that still read the
      // shortened field name.
      prevCoverNoteReferenceNumber: reference,
    };
  }
}
