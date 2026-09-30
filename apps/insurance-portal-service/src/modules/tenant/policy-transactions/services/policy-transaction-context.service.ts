import { BadRequestException, Injectable } from '@nestjs/common';
import type { SaveQuotationDraftDto } from '../../quotations/dto/quotation-draft.dto';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { FLEET_OFF_COVER_STATUSES } from '../constants/fleet-vehicle-endorsement.constants';

const TIRA_COVER_NOTE_TYPE_RENEWAL = 2;
const TIRA_COVER_NOTE_TYPE_ENDORSEMENT = 3;
/** Premium step id shared by the Underwrite motor, fleet and non-motor wizards. */
const UNDERWRITE_RESUME_STEP = 'premium';

type TransactionDraftType = 'RENEWAL' | 'ENDORSEMENT' | 'CANCELLATION';

export interface PolicyTransactionDraftContextInput {
  policy: Policy;
  version: PolicyVersion;
  transaction?: PolicyTransaction | null;
  type: TransactionDraftType;
  effectiveDate: string;
  endDate: string;
  previousCoverNoteReference: string;
  endorsementType?: number | string | null;
  endorsementReason?: string | null;
  recordOnly?: boolean;
}

export interface PolicyTransactionDraftContext {
  snapshot: Record<string, unknown>;
  quotationFlow: QuotationFlow;
  quotationType: QuotationType;
  dto: SaveQuotationDraftDto;
  branchContext?: {
    branchId: string;
    salePointCode: string;
    officer: { officer_name: string; officer_title: string };
  };
}

@Injectable()
export class PolicyTransactionContextService {
  buildDraftContext(
    input: PolicyTransactionDraftContextInput,
  ): PolicyTransactionDraftContext {
    const snapshot =
      input.transaction?.proposed_policy_snapshot ??
      input.transaction?.source_policy_snapshot ??
      input.version.policy_snapshot;
    const source = this.asObject(snapshot['source']) ?? {};
    const cover = this.asObject(snapshot['cover']) ?? {};
    const product = this.asObject(snapshot['product']) ?? {};
    const customer = this.asObject(snapshot['customer']) ?? {};
    const snapshotEntries = this.asArray(snapshot['entries'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    // A renewal re-covers only what is still on cover; endorsements keep
    // every entry so snapshot indices stay stable.
    const entries =
      input.type === 'RENEWAL'
        ? snapshotEntries.filter((entry) => !this.isOffCover(entry))
        : snapshotEntries;

    if (!entries.length) {
      throw new BadRequestException(
        'The current policy state does not contain insured risks.',
      );
    }

    const quotationFlow = String(
      source['quotationFlow'] ?? QuotationFlow.NON_MOTOR,
    ) as QuotationFlow;
    const quotationType =
      quotationFlow === QuotationFlow.NON_MOTOR
        ? QuotationType.NON_MOTOR
        : QuotationType.MOTOR;
    const policyHolder =
      this.asObject(snapshot['policyHolder']) ??
      this.asObject(customer['policyHolder']);
    const policyHolders =
      this.asArray(snapshot['policyHolders']).length > 0
        ? this.asArray(snapshot['policyHolders'])
        : this.asArray(customer['policyHolders']);
    const draftPayload = this.buildDraftPayload({
      ...input,
      snapshot,
      source,
      cover,
      product,
      customer,
      policyHolder,
      policyHolders,
      entries,
      quotationFlow,
      quotationType,
    });
    const dto: SaveQuotationDraftDto = {
      insurer_company_id: input.policy.insurer_company_id,
      intermediary_company_id: input.policy.intermediary_company_id,
      branch_id: input.policy.branch_id,
      department_id: input.policy.department_id,
      customer_id: input.policy.customer_id,
      category_id:
        this.stringOrNull(product['categoryId']) ?? input.policy.category_id,
      product_id:
        this.stringOrNull(product['productId']) ?? input.policy.product_id,
      sub_class_id:
        this.stringOrNull(product['subClassId']) ?? input.policy.sub_class_id,
      quotation_type: quotationType,
      quotation_flow: quotationFlow,
      channel_type: input.policy.channel_type,
      is_fleet: quotationFlow === QuotationFlow.MOTOR_FLEET,
      // Customer, risks and cover are carried over; the Underwrite wizards
      // (motor, fleet, non-motor) resume at re-pricing. Unknown ids fall
      // back to the first step in the legacy quotation wizard.
      current_wizard_step: UNDERWRITE_RESUME_STEP,
      draft_payload: draftPayload,
    };

    return {
      snapshot,
      quotationFlow,
      quotationType,
      dto,
      branchContext: this.buildBranchContext(input.policy, cover),
    };
  }

  private buildDraftPayload(
    params: PolicyTransactionDraftContextInput & {
      snapshot: Record<string, unknown>;
      source: Record<string, unknown>;
      cover: Record<string, unknown>;
      product: Record<string, unknown>;
      customer: Record<string, unknown>;
      policyHolder: Record<string, unknown> | null;
      policyHolders: unknown[];
      entries: Record<string, unknown>[];
      quotationFlow: QuotationFlow;
      quotationType: QuotationType;
    },
  ): Record<string, unknown> {
    const firstEntry = params.entries[0];
    const firstMotor = this.asObject(firstEntry['motor']);
    const coverNoteType =
      params.type === 'RENEWAL'
        ? TIRA_COVER_NOTE_TYPE_RENEWAL
        : TIRA_COVER_NOTE_TYPE_ENDORSEMENT;
    const transactionMetadata = params.transaction
      ? {
          transaction_id: params.transaction.id,
          transaction_no: params.transaction.transaction_no,
          transaction_type: params.transaction.transaction_type,
          source_policy_version_id: params.transaction.source_policy_version_id,
          source_policy_version_no: params.transaction.source_policy_version_no,
          proposed_policy_snapshot_hash:
            params.transaction.proposed_policy_snapshot_hash,
        }
      : {};
    const transactionPricingRisks = this.transactionPricingRisks(
      params.transaction,
    );

    return {
      policyholder_mode: 'existing',
      customer_id: params.policy.customer_id,
      customer_snapshot: params.customer,
      policyholder_snapshot: params.policyHolder,
      policy_holders: params.policyHolders,
      category_id:
        this.stringOrNull(params.product['categoryId']) ??
        params.policy.category_id,
      product_id:
        this.stringOrNull(params.product['productId']) ??
        params.policy.product_id,
      sub_class_id:
        this.stringOrNull(params.product['subClassId']) ??
        params.policy.sub_class_id ??
        '',
      product_version_id:
        this.stringOrNull(params.product['productVersionId']) ??
        params.policy.product_version_id,
      product_definition_hash:
        this.stringOrNull(params.product['productDefinitionHash']) ??
        params.policy.product_definition_hash,
      quotation_flow: params.quotationFlow,
      quotation_type: params.quotationType,
      is_fleet: params.quotationFlow === QuotationFlow.MOTOR_FLEET,
      channel_type: params.policy.channel_type,
      branch_id: params.policy.branch_id ?? '',
      department_id: params.policy.department_id ?? '',
      intermediary_company_id: params.policy.intermediary_company_id ?? '',
      currency: params.policy.currency,
      exchange_rate: String(params.cover['exchangeRate'] ?? '1'),
      cover_note_type: String(coverNoteType),
      prev_cover_note_reference: params.previousCoverNoteReference,
      valid_from: params.effectiveDate,
      valid_until: params.endDate,
      cover_note_number: '',
      cover_note_desc: String(firstEntry['coverNoteDescription'] ?? ''),
      operative_clause: String(firstEntry['operativeClause'] ?? ''),
      payment_mode_tira: String(params.cover['paymentMode'] ?? '1'),
      officer_name: String(params.cover['officerName'] ?? ''),
      officer_title: String(params.cover['officerTitle'] ?? ''),
      basic_premium: '',
      total_discount: '',
      total_tax: '',
      total_charges: '',
      total_commission: '',
      total_premium: '',
      net_premium: '',
      rating_version: '',
      sum_insured: this.sumInsured(params.entries),
      risks:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? []
          : this.mapRisks(firstEntry, transactionPricingRisks, 0),
      addons:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? []
          : this.mapAddons(firstEntry),
      motor_mode: firstMotor ? 'new' : 'existing',
      motor: firstMotor ? this.mapMotorSingle(firstMotor) : {},
      nonMotor: {
        items:
          params.quotationFlow === QuotationFlow.NON_MOTOR
            ? this.mapSubjectMatters(firstEntry)
            : [],
      },
      fleet:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? this.mapFleet(
              params.entries,
              params.previousCoverNoteReference,
              transactionPricingRisks,
              params.type === 'RENEWAL',
            )
          : { header: {}, items: [] },
      endorsement_type:
        params.type === 'RENEWAL' ? '' : String(params.endorsementType ?? ''),
      endorsement_reason:
        params.type === 'RENEWAL' ? '' : (params.endorsementReason ?? ''),
      endorsement_premium_earned: '',
      transaction_context: {
        source: 'CURRENT_EFFECTIVE_POLICY_STATE',
        type: params.type,
        record_only: params.recordOnly === true,
        source_policy_id: params.policy.id,
        source_policy_no: params.policy.policy_no,
        current_policy_version_id: params.version.id,
        current_policy_version_no: params.version.version_number,
        previous_quotation_id: params.policy.quotation_id,
        previous_cover_note_reference: params.previousCoverNoteReference,
        ...transactionMetadata,
      },
      policy_transaction: {
        record_only: params.recordOnly === true,
        ...transactionMetadata,
        source_policy_id: params.policy.id,
        source_policy_no: params.policy.policy_no,
        source_policy_version_id:
          params.transaction?.source_policy_version_id ?? params.version.id,
        previous_cover_note_reference: params.previousCoverNoteReference,
      },
      renewal:
        params.type === 'RENEWAL'
          ? {
              source_policy_id: params.policy.id,
              source_policy_no: params.policy.policy_no,
              source_policy_version_id: params.version.id,
              previous_cover_note_reference: params.previousCoverNoteReference,
            }
          : undefined,
    };
  }

  private mapRisks(
    entry: Record<string, unknown>,
    transactionPricingRisks: Record<string, unknown>[],
    entryIndex: number,
  ) {
    return this.asArray(entry['risks']).map((risk, riskIndex) => {
      const item = this.asObject(risk) ?? {};
      const pricing =
        this.findPricingRisk(entry, item) ??
        this.findTransactionPricingRisk(
          transactionPricingRisks,
          entryIndex,
          riskIndex,
          item,
        );
      const pricingQuoteId =
        pricing?.['pricingQuoteId'] ??
        pricing?.['pricing_quote_id'] ??
        pricing?.['sourcePricingQuoteId'] ??
        pricing?.['source_pricing_quote_id'] ??
        '';
      const premiumBeforeDiscount =
        pricing?.['premiumBeforeDiscount'] ??
        pricing?.['premium_before_discount'] ??
        '';
      const premiumAfterDiscount =
        pricing?.['premiumAfterDiscount'] ??
        pricing?.['premium_after_discount'] ??
        premiumBeforeDiscount;
      const premiumExcludingTaxEquivalent =
        pricing?.['premiumExcludingTaxEquivalent'] ??
        pricing?.['premium_excluding_tax_equivalent'] ??
        premiumAfterDiscount;
      const premiumIncludingTax =
        pricing?.['premiumIncludingTax'] ??
        pricing?.['premium_including_tax'] ??
        premiumExcludingTaxEquivalent;

      return {
        risk_id: item['insuranceRiskId'] ?? item['riskId'] ?? item['id'] ?? '',
        risk_code: item['riskCode'] ?? pricing?.['riskCode'] ?? '',
        pricing_quote_id: pricingQuoteId,
        sum_insured: String(
          item['sumInsured'] ?? pricing?.['sumInsured'] ?? '',
        ),
        sum_insured_equivalent: String(
          pricing?.['sumInsuredEquivalent'] ??
            pricing?.['sum_insured_equivalent'] ??
            item['sumInsured'] ??
            '',
        ),
        rate: String(pricing?.['premiumRate'] ?? ''),
        premium_rate: String(pricing?.['premiumRate'] ?? ''),
        basic_premium: String(premiumBeforeDiscount),
        premium_before_discount: String(premiumBeforeDiscount),
        premium_after_discount: String(premiumAfterDiscount),
        premium_excluding_tax_equivalent: String(premiumExcludingTaxEquivalent),
        premium_including_tax: String(premiumIncludingTax),
        total_premium: String(premiumIncludingTax),
        discounts_offered: this.mapDiscounts(pricing?.['discounts']),
        taxes_charged: this.mapTaxes(pricing?.['taxes']),
        rating_result_metadata: pricingQuoteId
          ? { pricing_quote_id: pricingQuoteId }
          : null,
      };
    });
  }

  private mapAddons(entry: Record<string, unknown>) {
    const pricing = this.asObject(entry['pricing']);
    return this.asArray(pricing?.['addons']).map((addon) => {
      const item = this.asObject(addon) ?? {};
      return {
        addon_id: item['addonId'] ?? item['id'] ?? '',
        addon_reference: item['reference'] ?? '',
        description: item['description'] ?? '',
        addon_desc: item['description'] ?? '',
        amount: String(item['amount'] ?? ''),
        addon_amount: String(item['amount'] ?? ''),
        premium_rate: String(item['premiumRate'] ?? ''),
        addon_premium_rate: String(item['premiumRate'] ?? ''),
        premium_excluding_tax: String(item['premiumExcludingTax'] ?? '0'),
        premium_excluding_tax_equivalent: String(
          item['premiumExcludingTaxEquivalent'] ??
            item['premiumExcludingTax'] ??
            '0',
        ),
        premium_including_tax: String(item['premiumIncludingTax'] ?? '0'),
        taxes: this.mapTaxes(item['taxes']),
      };
    });
  }

  private mapSubjectMatters(entry: Record<string, unknown>) {
    return this.asArray(entry['subjectMatters']).map((subject) => {
      const item = this.asObject(subject) ?? {};
      return {
        subject_matter_id: item['subjectMatterId'] ?? item['id'] ?? '',
        reference: item['reference'] ?? '',
        description: item['description'] ?? '',
        sum_insured: item['sumInsured'] ?? item['sum_insured'] ?? '',
      };
    });
  }

  private mapMotorSingle(motor: Record<string, unknown>) {
    return {
      motor_category_code: motor['motorCategory'] ?? '',
      motor_type_code: motor['motorType'] ?? '',
      registration_no:
        motor['registrationNumber'] ?? motor['registration_no'] ?? '',
      chassis_no: motor['chassisNumber'] ?? motor['chassis_no'] ?? '',
      engine_no: motor['engineNumber'] ?? motor['engine_no'] ?? '',
      make: motor['make'] ?? '',
      model: motor['model'] ?? '',
      model_no: motor['modelNumber'] ?? motor['model_no'] ?? '',
      body_type: motor['bodyType'] ?? motor['body_type'] ?? '',
      color: motor['color'] ?? '',
      cubic_capacity: motor['engineCapacity'] ?? motor['cubic_capacity'] ?? '',
      fuel_type: motor['fuelUsed'] ?? motor['fuel_type'] ?? '',
      number_of_axles: motor['numberOfAxles'] ?? motor['number_of_axles'] ?? '',
      axle_distance: motor['axleDistance'] ?? motor['axle_distance'] ?? '',
      seating_capacity:
        motor['sittingCapacity'] ?? motor['seating_capacity'] ?? '',
      manufacture_year:
        motor['yearOfManufacture'] ?? motor['manufacture_year'] ?? '',
      tare_weight: motor['tareWeight'] ?? motor['tare_weight'] ?? '',
      gross_weight: motor['grossWeight'] ?? motor['gross_weight'] ?? '',
      motor_usage_code: motor['motorUsage'] ?? motor['motor_usage_code'] ?? '',
      owner_name: motor['ownerName'] ?? motor['owner_name'] ?? '',
      owner_category: motor['ownerCategory'] ?? motor['owner_category'] ?? '',
      owner_address: motor['ownerAddress'] ?? motor['owner_address'] ?? '',
      sum_insured: motor['sumInsured'] ?? '',
    };
  }

  private mapMotorFleet(motor: Record<string, unknown>) {
    return {
      motor_category: motor['motorCategory'] ?? '',
      motor_type: motor['motorType'] ?? '',
      registration_number:
        motor['registrationNumber'] ?? motor['registration_number'] ?? '',
      chassis_number: motor['chassisNumber'] ?? motor['chassis_number'] ?? '',
      engine_number: motor['engineNumber'] ?? motor['engine_number'] ?? '',
      make: motor['make'] ?? '',
      model: motor['model'] ?? '',
      model_number: motor['modelNumber'] ?? motor['model_number'] ?? '',
      body_type: motor['bodyType'] ?? motor['body_type'] ?? '',
      color: motor['color'] ?? '',
      engine_capacity:
        motor['engineCapacity'] ?? motor['engine_capacity'] ?? '',
      fuel_used: motor['fuelUsed'] ?? motor['fuel_used'] ?? '',
      number_of_axles: motor['numberOfAxles'] ?? motor['number_of_axles'] ?? '',
      axle_distance: motor['axleDistance'] ?? motor['axle_distance'] ?? '',
      sitting_capacity:
        motor['sittingCapacity'] ?? motor['sitting_capacity'] ?? '',
      year_of_manufacture:
        motor['yearOfManufacture'] ?? motor['year_of_manufacture'] ?? '',
      tare_weight: motor['tareWeight'] ?? motor['tare_weight'] ?? '',
      gross_weight: motor['grossWeight'] ?? motor['gross_weight'] ?? '',
      motor_usage: motor['motorUsage'] ?? motor['motor_usage'] ?? '',
      owner_name: motor['ownerName'] ?? motor['owner_name'] ?? '',
      owner_category: motor['ownerCategory'] ?? motor['owner_category'] ?? '',
      owner_address: motor['ownerAddress'] ?? motor['owner_address'] ?? '',
      sum_insured: motor['sumInsured'] ?? '',
    };
  }

  private mapFleet(
    entries: Record<string, unknown>[],
    previousCoverNoteReference: string,
    transactionPricingRisks: Record<string, unknown>[],
    renumberEntries = false,
  ) {
    return {
      header: {
        declared_total_vehicles: entries.length,
      },
      declared_total_vehicles: entries.length,
      items: entries.map((entry, index) => {
        const motor = this.mapMotorFleet(this.asObject(entry['motor']) ?? {});

        return {
          // A renewal is a new fleet cover note: entries run 1..N again once
          // off-cover vehicles are dropped.
          fleet_entry: String(
            renumberEntries ? index + 1 : (entry['fleetEntry'] ?? index + 1),
          ),
          cover_note_number: '',
          prev_cover_note_reference_number:
            this.resolveEntryPreviousReference(entry) ??
            previousCoverNoteReference,
          cover_note_desc: String(entry['coverNoteDescription'] ?? ''),
          operative_clause: String(entry['operativeClause'] ?? ''),
          risks: this.mapRisks(entry, transactionPricingRisks, index),
          risks_covered: this.mapRisks(entry, transactionPricingRisks, index),
          addons: this.mapAddons(entry),
          cover_note_addons: this.mapAddons(entry),
          motor_dtl: motor,
          motor,
          subject_matters: this.mapSubjectMatters(entry),
          subject_matters_covered: this.mapSubjectMatters(entry),
        };
      }),
    };
  }

  private transactionPricingRisks(
    transaction?: PolicyTransaction | null,
  ): Record<string, unknown>[] {
    const snapshot = this.asObject(transaction?.pricing_snapshot) ?? {};
    const remaining = this.asObject(snapshot['remaining']) ?? {};

    return [
      ...this.asArray(snapshot['risks']),
      ...this.asArray(snapshot['proposedRiskPricing']),
      ...this.asArray(remaining['risks']),
    ]
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
  }

  private findTransactionPricingRisk(
    risks: Record<string, unknown>[],
    entryIndex: number,
    riskIndex: number,
    risk: Record<string, unknown>,
  ) {
    const riskId = risk['quotationRiskId'] ?? risk['insuranceRiskId'];
    const riskCode = risk['riskCode'];

    return (
      risks.find(
        (candidate) =>
          Number(candidate['entryIndex']) === entryIndex &&
          Number(candidate['riskIndex']) === riskIndex,
      ) ??
      risks.find(
        (candidate) =>
          candidate['quotationRiskId'] === riskId ||
          candidate['insuranceRiskId'] === riskId ||
          candidate['riskCode'] === riskCode,
      ) ??
      null
    );
  }

  private mapDiscounts(value: unknown) {
    return this.asArray(value)
      .map((item) => this.asObject(item))
      .filter((item): item is Record<string, unknown> => !!item)
      .map((item) => ({
        discount_type: item['discountType'] ?? item['discount_type'] ?? '',
        discount_rate: String(
          item['discountRate'] ?? item['discount_rate'] ?? '',
        ),
        discount_amount: String(
          item['discountAmount'] ?? item['discount_amount'] ?? '0',
        ),
        request_reason_code:
          item['requestReasonCode'] ?? item['request_reason_code'] ?? '',
        request_comment:
          item['requestComment'] ?? item['request_comment'] ?? '',
        approval_required:
          item['approvalRequired'] ?? item['approval_required'] ?? false,
        approval_status:
          item['approvalStatus'] ?? item['approval_status'] ?? 'NOT_REQUIRED',
      }));
  }

  private mapTaxes(value: unknown) {
    return this.asArray(value)
      .map((item) => this.asObject(item))
      .filter((item): item is Record<string, unknown> => !!item)
      .map((item) => ({
        tax_code: item['taxCode'] ?? item['tax_code'] ?? '',
        is_tax_exempted:
          item['isTaxExempted'] === true ||
          item['is_tax_exempted'] === true ||
          item['is_tax_exempted'] === 'Y',
        tax_exemption_type:
          item['taxExemptionType'] ?? item['tax_exemption_type'] ?? '',
        tax_exemption_reference:
          item['taxExemptionReference'] ??
          item['tax_exemption_reference'] ??
          '',
        tax_rate: String(item['taxRate'] ?? item['tax_rate'] ?? '0'),
        tax_amount: String(item['taxAmount'] ?? item['tax_amount'] ?? '0'),
      }));
  }

  private findPricingRisk(
    entry: Record<string, unknown>,
    risk: Record<string, unknown>,
  ) {
    const pricing = this.asObject(entry['pricing']);
    const pricingRisks = this.asArray(pricing?.['risks'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    const riskId = risk['quotationRiskId'] ?? risk['insuranceRiskId'];

    return pricingRisks.find(
      (candidate) =>
        candidate['id'] === riskId ||
        candidate['insuranceRiskId'] === riskId ||
        candidate['riskCode'] === risk['riskCode'],
    );
  }

  private sumInsured(entries: Record<string, unknown>[]) {
    const total = entries
      .flatMap((entry) => this.asArray(entry['risks']))
      .map((risk) => this.asObject(risk) ?? {})
      .reduce((sum, risk) => sum + Number(risk['sumInsured'] ?? 0), 0);

    return total ? total.toFixed(2) : '';
  }

  private resolveEntryPreviousReference(entry: Record<string, unknown>) {
    const regulatory = this.asObject(entry['regulatory']);
    const notes = this.asArray(entry['coverNotes'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    const direct =
      regulatory?.['coverNoteReferenceNumber'] ??
      entry['coverNoteReferenceNumber'] ??
      entry['previousCoverNoteReference'] ??
      entry['prevCoverNoteReferenceNumber'];

    return typeof direct === 'string' && direct.trim()
      ? direct
      : (notes[0]?.['coverNoteReferenceNumber'] as string | undefined);
  }

  private buildBranchContext(policy: Policy, cover: Record<string, unknown>) {
    if (!policy.branch_id) {
      return undefined;
    }

    const salePointCode = this.stringOrNull(cover['salePointCode']);
    if (!salePointCode) {
      return undefined;
    }

    return {
      branchId: policy.branch_id,
      salePointCode,
      officer: {
        officer_name:
          this.stringOrNull(cover['officerName']) ?? 'Portal Officer',
        officer_title:
          this.stringOrNull(cover['officerTitle']) ?? 'Underwriter',
      },
    };
  }

  private isOffCover(entry: Record<string, unknown>) {
    return FLEET_OFF_COVER_STATUSES.includes(
      String(entry['status'] ?? '')
        .trim()
        .toUpperCase(),
    );
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
