import { Injectable } from '@nestjs/common';
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
    const base = await this.buildBasePayload(transaction, policy);

    return {
      ...base,
      prevCoverNoteReferenceNumber: endorsement.previous_cover_note_reference,
      endorsementType: endorsement.tira_endorsement_type,
      endorsementReason: transaction.reason,
      endorsementPremiumEarned: DecimalUtil.money(transaction.additional_premium),
    };
  }

  async buildCancellationPayload(
    transaction: PolicyTransaction,
    cancellation: PolicyCancellation,
    policy: Policy,
  ): Promise<Record<string, unknown>> {
    const base = await this.buildBasePayload(transaction, policy);

    return {
      ...base,
      prevCoverNoteReferenceNumber: policy.cover_note_no,
      // No company-configured TIRA endorsement-type code exists for
      // cancellations today (`endorsement_types` is a per-company lookup
      // table with no seeded "cancellation" entry) — left null rather than
      // guessing a numeric code; `endorsementReason` still carries the
      // cancellation reason so the submission is not empty of context.
      endorsementType: null,
      endorsementReason: transaction.reason,
      endorsementPremiumEarned: DecimalUtil.money(cancellation.earned_premium),
    };
  }

  private async buildBasePayload(
    transaction: PolicyTransaction,
    policy: Policy,
  ): Promise<Record<string, unknown>> {
    const [company, actor, quotation, risks] = await Promise.all([
      this.companyRepository.findOne({ where: { id: policy.insurer_company_id } }),
      transaction.completed_by
        ? this.userRepository.findOne({ where: { id: transaction.completed_by } })
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
      tranCompanyCode: company?.tira_company_code ?? company?.tira_insurer_company_code ?? null,
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
        : coverNote?.officer_name ?? null,
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
    const holder = (policy.customer_snapshot as Record<string, unknown> | null)
      ?.policyHolder as Record<string, unknown> | null | undefined;

    if (!holder) {
      return [];
    }

    return [
      {
        policyHolderName: holder.name ?? null,
        policyHolderBirthDate: holder.birthDate ?? null,
        countryCode: holder.countryCode ?? null,
        region: holder.region ?? null,
        district: holder.district ?? null,
        phoneNumber: holder.phone ?? null,
        emailAddress: holder.email ?? null,
      },
    ];
  }
}
