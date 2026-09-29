import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PolicyTransactionType } from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomerPolicyHolderType } from '../../customers/enums/customer-policy-holder-type.enum';
import type { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationCoverNote } from '../../quotations/entities/structured/quotation-cover-note.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationsService } from '../../quotations/quotations.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import {
  PolicyTransactionDraftContext,
  PolicyTransactionContextService,
} from './policy-transaction-context.service';

@Injectable()
export class PolicyTransactionQuotationFactoryService {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly contextService: PolicyTransactionContextService,
  ) {}

  async createTransactionDraft(
    manager: EntityManager,
    user: AuthenticatedUser,
    params: {
      policy: Policy;
      version: PolicyVersion;
      transaction: PolicyTransaction;
      previousCoverNoteReference: string;
      endorsementType: number;
      endorsementReason: string;
      recordOnly?: boolean;
    },
  ): Promise<Quotation> {
    const context = this.contextService.buildDraftContext({
      policy: params.policy,
      version: params.version,
      transaction: params.transaction,
      type:
        params.transaction.transaction_type ===
        PolicyTransactionType.CANCELLATION
          ? 'CANCELLATION'
          : 'ENDORSEMENT',
      effectiveDate: params.transaction.effective_date,
      endDate: String(
        (params.transaction.proposed_policy_snapshot ??
          params.version.policy_snapshot)?.['endDate'] ??
          params.policy.end_date,
      ),
      previousCoverNoteReference: params.previousCoverNoteReference,
      endorsementType: params.endorsementType,
      endorsementReason: params.endorsementReason,
      recordOnly: params.recordOnly === true,
    });

    const quotationId = await this.quotationsService.createDraftInTransaction(
      manager,
      user.companyId!,
      context.dto,
      user.id,
      context.branchContext,
    );

    // These link columns are populated directly rather than via
    // SaveQuotationDraftDto because they are internal bookkeeping specific
    // to policy-transaction-generated quotations, not something a user
    // ever sets through the ordinary quotation wizard/DTO surface.
    await manager.getRepository(Quotation).update(
      { id: quotationId, company_id: user.companyId! },
      {
        source_policy_transaction_id: params.transaction.id,
        source_policy_id: params.policy.id,
        previous_quotation_id: params.policy.quotation_id ?? null,
      },
    );

    await this.quotationsService.finalizeGeneratedDraftInTransaction(
      manager,
      user.companyId!,
      quotationId,
      await this.buildFinalPayload(
        manager,
        quotationId,
        params.policy,
        context,
      ),
      user,
      { reuseExistingIdentifiers: true },
    );

    // The full aggregate uses the policy snapshot's cover and risks. For
    // financial display on endorsements/cancellations, the transaction delta
    // remains authoritative.
    await this.persistPremiumTotals(manager, quotationId, params.transaction);

    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: quotationId, company_id: user.companyId! },
    });

    if (!quotation) {
      throw new BadRequestException(
        'Policy transaction quotation could not be created.',
      );
    }

    return quotation;
  }

  private async buildFinalPayload(
    manager: EntityManager,
    quotationId: string,
    policy: Policy,
    context: PolicyTransactionDraftContext,
  ): Promise<UpdateQuotationDto> {
    const draftPayload = context.dto.draft_payload;
    const coverNote = await manager.getRepository(QuotationCoverNote).findOne({
      where: { quotation_id: quotationId },
    });
    const customer = policy.customer_id
      ? await manager.getRepository(Customer).findOne({
          where: { id: policy.customer_id, company_id: policy.company_id },
        })
      : null;
    const policyHolders = this.buildPolicyHolderPayloads(
      policy,
      draftPayload,
      customer,
    );
    const common = {
      internal_quotation: {
        insurer_company_id: context.dto.insurer_company_id!,
        intermediary_company_id: context.dto.intermediary_company_id ?? null,
        branch_id: context.dto.branch_id ?? null,
        department_id: context.dto.department_id ?? null,
        category_id: context.dto.category_id,
        product_id: context.dto.product_id,
        sub_class_id: context.dto.sub_class_id ?? null,
        quotation_type: context.dto.quotation_type,
        quotation_flow: context.dto.quotation_flow,
        channel_type: context.dto.channel_type,
        is_fleet: context.dto.is_fleet,
      },
      cover_note_hdr: {
        cover_note_type: this.positiveInteger(draftPayload['cover_note_type']),
      },
    };
    const header = {
      cover_note_start_date: this.startDateTime(draftPayload['valid_from']),
      cover_note_end_date: this.endDateTime(draftPayload['valid_until']),
      payment_mode: this.positiveInteger(draftPayload['payment_mode_tira']),
      currency_code:
        this.text(draftPayload['currency']) ?? policy.currency ?? 'TZS',
      exchange_rate: this.money(draftPayload['exchange_rate'], 1),
      total_premium_excluding_tax: this.money(
        draftPayload['net_premium'] || draftPayload['basic_premium'],
      ),
      total_premium_including_tax: this.money(
        draftPayload['total_premium'] || draftPayload['net_premium'],
      ),
      commision_paid: this.money(
        draftPayload['commission_paid'] ?? draftPayload['total_commission'],
      ),
      commision_rate: this.money(draftPayload['commission_rate']),
      officer_name:
        this.text(draftPayload['officer_name']) ??
        context.branchContext?.officer.officer_name ??
        'Portal Officer',
      officer_title:
        this.text(draftPayload['officer_title']) ??
        context.branchContext?.officer.officer_title ??
        'Underwriter',
      product_code:
        this.text(coverNote?.product_code) ??
        this.text(draftPayload['product_code']) ??
        '',
      policy_holders: policyHolders,
    };

    if (context.quotationFlow === QuotationFlow.MOTOR_FLEET) {
      const fleet = this.asObject(draftPayload['fleet']) ?? {};
      const fleetHeader = this.asObject(fleet['header']) ?? {};
      const items = this.asArray(fleet['items']);

      return {
        ...common,
        cover_note_dtl: {
          fleet_hdr: {
            ...header,
            sale_point_code:
              context.branchContext?.salePointCode ??
              this.text(coverNote?.sale_point_code) ??
              '',
            fleet_id: this.text(fleetHeader['fleet_id']) ?? '',
            fleet_type: this.positiveInteger(fleetHeader['fleet_type'], 1),
            fleet_size: items.length || 1,
            comprehensive_insured: this.money(
              fleetHeader['comprehensive_insured'],
              1,
            ),
          },
          fleet_dtls: items.map((value, index) =>
            this.buildFleetDetail(value, index),
          ),
        },
      };
    }

    const risks = this.asArray(draftPayload['risks']).map((risk) =>
      this.buildRisk(risk),
    );
    const addons = this.asArray(draftPayload['addons']).map((addon) =>
      this.buildAddon(addon),
    );
    const detail = {
      ...header,
      cover_note_number: '',
      prev_cover_note_reference_number: this.text(
        draftPayload['prev_cover_note_reference'],
      ),
      cover_note_desc: this.text(draftPayload['cover_note_desc']) ?? '',
      operative_clause: this.text(draftPayload['operative_clause']) ?? '',
      endorsement_type: this.integerOrNull(draftPayload['endorsement_type']),
      endorsement_reason: this.text(draftPayload['endorsement_reason']),
      endorsement_premium_earned: this.nullableMoney(
        draftPayload['endorsement_premium_earned'],
      ),
      risks_covered: risks,
      subject_matters_covered:
        context.quotationFlow === QuotationFlow.MOTOR_SINGLE
          ? [this.buildMotorSubjectMatter(draftPayload)]
          : this.asArray(this.asObject(draftPayload['nonMotor'])?.['items'])
              .map((subject) => this.buildSubjectMatter(subject))
              .filter(
                (subject) =>
                  subject.subject_matter_reference ||
                  subject.subject_matter_desc,
              ),
      cover_note_addons: addons,
      policy_holders: policyHolders,
    };

    if (context.quotationFlow === QuotationFlow.MOTOR_SINGLE) {
      return {
        ...common,
        cover_note_dtl: {
          ...detail,
          motor_dtl: this.buildMotorDetail(draftPayload['motor']),
        },
      };
    }

    return {
      ...common,
      cover_note_dtl: detail,
    };
  }

  private buildPolicyHolderPayloads(
    policy: Policy,
    draftPayload: Record<string, unknown>,
    customer: Customer | null,
  ) {
    const snapshotHolders = this.asArray(draftPayload['policy_holders'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    const primarySnapshot = this.asObject(
      draftPayload['policyholder_snapshot'],
    );
    const holders =
      snapshotHolders.length > 0
        ? snapshotHolders
        : primarySnapshot
          ? [primarySnapshot]
          : [{}];

    const payloads = holders
      .map((holder, index) => {
        const fallback = index === 0 ? customer : null;
        const name =
          this.text(holder['name']) ??
          this.text(holder['policyHolderName']) ??
          this.text(fallback?.display_name);
        if (!name) {
          return null;
        }

        return {
          policy_holder_name: name,
          policy_holder_birth_date:
            this.text(holder['birthDate']) ??
            this.text(fallback?.date_of_birth) ??
            '1900-01-01',
          policy_holder_type:
            this.integer(holder['type']) ??
            fallback?.policy_holder_type ??
            CustomerPolicyHolderType.INDIVIDUAL,
          policy_holder_id_number:
            this.text(holder['idNumber']) ??
            this.text(fallback?.id_number) ??
            '',
          policy_holder_id_type:
            this.integer(holder['idType']) ?? fallback?.id_type ?? 1,
          gender: this.gender(this.text(holder['gender']) ?? fallback?.gender),
          country_code:
            this.text(holder['countryCode']) ??
            this.text(fallback?.country_code) ??
            'TZA',
          region:
            this.text(holder['region']) ?? this.text(fallback?.region) ?? '',
          district:
            this.text(holder['district']) ??
            this.text(fallback?.district) ??
            '',
          street:
            this.text(holder['street']) ?? this.text(fallback?.street) ?? null,
          policy_holder_phone_number:
            this.text(holder['phone']) ?? this.text(fallback?.phone) ?? '',
          policy_holder_fax:
            this.text(holder['fax']) ?? this.text(fallback?.fax) ?? null,
          postal_address:
            this.text(holder['postalAddress']) ??
            this.text(fallback?.postal_address) ??
            null,
          email_address:
            this.text(holder['email']) ?? this.text(fallback?.email) ?? null,
        };
      })
      .filter((entity): entity is NonNullable<typeof entity> => !!entity);

    if (payloads.length > 0) return payloads;

    throw new BadRequestException(
      'Policy transaction quotation requires at least one policyholder.',
    );
  }

  private buildFleetDetail(value: unknown, index: number) {
    const item = this.asObject(value) ?? {};

    return {
      fleet_entry: this.positiveInteger(item['fleet_entry'], index + 1),
      cover_note_number: this.text(item['cover_note_number']) ?? '',
      prev_cover_note_reference_number: this.text(
        item['prev_cover_note_reference_number'],
      ),
      cover_note_desc: this.text(item['cover_note_desc']) ?? '',
      operative_clause: this.text(item['operative_clause']) ?? '',
      endorsement_type: this.integerOrNull(item['endorsement_type']),
      endorsement_reason: this.text(item['endorsement_reason']),
      endorsement_premium_earned: this.nullableMoney(
        item['endorsement_premium_earned'],
      ),
      risks_covered: this.asArray(item['risks_covered'] ?? item['risks']).map(
        (risk) => this.buildRisk(risk),
      ),
      subject_matters_covered: this.asArray(
        item['subject_matters_covered'] ?? item['subject_matters'],
      ).map((subject) => this.buildSubjectMatter(subject)),
      cover_note_addons: this.asArray(
        item['cover_note_addons'] ?? item['addons'],
      ).map((addon) => this.buildAddon(addon)),
      motor_dtl: this.buildMotorDetail(item['motor_dtl'] ?? item['motor']),
    };
  }

  private buildRisk(value: unknown) {
    const risk = this.asObject(value) ?? {};
    const metadata = this.asObject(risk['rating_result_metadata']);
    const pricingQuoteId =
      this.text(risk['pricing_quote_id']) ??
      this.text(metadata?.['pricing_quote_id']) ??
      '';
    const beforeDiscount = this.money(
      risk['premium_before_discount'] ?? risk['basic_premium'],
    );
    const afterDiscount = this.money(
      risk['premium_after_discount'] ?? risk['basic_premium'],
      beforeDiscount,
    );
    const excludingTax = this.money(
      risk['premium_excluding_tax_equivalent'] ?? risk['net_premium'],
      afterDiscount,
    );
    const includingTax = this.money(
      risk['premium_including_tax'] ?? risk['total_premium'],
      excludingTax,
    );

    return {
      risk_code: this.text(risk['risk_code']) ?? '',
      pricing_quote_id: pricingQuoteId,
      sum_insured: this.money(risk['sum_insured']),
      sum_insured_equivalent: this.money(
        risk['sum_insured_equivalent'] ?? risk['sum_insured'],
      ),
      premium_rate: this.money(risk['premium_rate'] ?? risk['rate']),
      premium_before_discount: beforeDiscount,
      premium_after_discount: afterDiscount,
      premium_excluding_tax_equivalent: excludingTax,
      premium_including_tax: includingTax,
      discounts_offered: this.asArray(risk['discounts_offered']).map(
        (discount) => this.buildDiscount(discount),
      ),
      taxes_charged: this.asArray(risk['taxes_charged']).map((tax) =>
        this.buildTax(tax),
      ),
    };
  }

  private buildDiscount(value: unknown) {
    const discount = this.asObject(value) ?? {};

    return {
      discount_type: this.positiveInteger(discount['discount_type'], 1),
      discount_rate: this.money(discount['discount_rate']),
      discount_amount: this.money(discount['discount_amount']),
      request_reason_code: this.text(discount['request_reason_code']),
      request_comment: this.text(discount['request_comment']),
      approval_required: Boolean(discount['approval_required']),
      approval_status: this.approvalStatus(discount['approval_status']),
    };
  }

  private buildTax(value: unknown) {
    const tax = this.asObject(value) ?? {};

    return {
      tax_code: this.text(tax['tax_code']) ?? '',
      is_tax_exempted: this.taxFlag(tax['is_tax_exempted']),
      tax_exemption_type: this.text(tax['tax_exemption_type']),
      tax_exemption_reference: this.text(tax['tax_exemption_reference']),
      tax_rate: this.money(tax['tax_rate']),
      tax_amount: this.money(tax['tax_amount']),
    };
  }

  private buildAddon(value: unknown) {
    const addon = this.asObject(value) ?? {};
    const amount = this.money(addon['addon_amount'] ?? addon['amount']);
    const excludingTax = this.money(
      addon['premium_excluding_tax_equivalent'] ??
        addon['premium_excluding_tax'],
    );

    return {
      addon_reference: this.text(addon['addon_reference']) ?? '',
      addon_desc:
        this.text(addon['addon_desc']) ?? this.text(addon['description']) ?? '',
      addon_amount: amount,
      addon_premium_rate: this.money(
        addon['addon_premium_rate'] ?? addon['premium_rate'],
      ),
      premium_excluding_tax: this.money(
        addon['premium_excluding_tax'],
        excludingTax,
      ),
      premium_excluding_tax_equivalent: excludingTax,
      premium_including_tax: this.money(
        addon['premium_including_tax'],
        excludingTax,
      ),
      taxes_charged: this.asArray(addon['taxes']).map((tax) =>
        this.buildTax(tax),
      ),
    };
  }

  private buildSubjectMatter(value: unknown) {
    const subject = this.asObject(value) ?? {};

    return {
      subject_matter_reference:
        this.text(subject['subject_matter_reference']) ??
        this.text(subject['reference']) ??
        this.text(subject['subject_matter_id']) ??
        '',
      subject_matter_desc:
        this.text(subject['subject_matter_desc']) ??
        this.text(subject['description']) ??
        '',
    };
  }

  private buildMotorSubjectMatter(draftPayload: Record<string, unknown>) {
    const motor = this.asObject(draftPayload['motor']) ?? {};
    const make = this.text(motor['make']);
    const model = this.text(motor['model']);

    return {
      subject_matter_reference:
        this.text(motor['registration_no']) ??
        this.text(motor['chassis_no']) ??
        '',
      subject_matter_desc:
        [make, model].filter(Boolean).join(' ') || 'Motor vehicle',
    };
  }

  private buildMotorDetail(value: unknown) {
    const motor = this.asObject(value) ?? {};

    return {
      motor_category: this.positiveInteger(
        motor['motor_category'] ?? motor['motor_category_code'],
      ),
      motor_type: this.positiveInteger(
        motor['motor_type'] ?? motor['motor_type_code'],
      ),
      registration_number:
        this.text(motor['registration_number'] ?? motor['registration_no']) ??
        '',
      chassis_number:
        this.text(motor['chassis_number'] ?? motor['chassis_no']) ?? '',
      make: this.text(motor['make']) ?? '',
      model: this.text(motor['model']) ?? '',
      model_number: this.text(motor['model_number'] ?? motor['model_no']) ?? '',
      body_type: this.text(motor['body_type']) ?? '',
      color: this.text(motor['color']) ?? '',
      engine_number:
        this.text(motor['engine_number'] ?? motor['engine_no']) ?? '',
      engine_capacity:
        this.text(motor['engine_capacity'] ?? motor['cubic_capacity']) ?? '',
      fuel_used: this.text(motor['fuel_used'] ?? motor['fuel_type']) ?? '',
      number_of_axles: this.positiveInteger(motor['number_of_axles']),
      axle_distance: this.money(motor['axle_distance']),
      sitting_capacity: this.positiveInteger(
        motor['sitting_capacity'] ?? motor['seating_capacity'],
      ),
      year_of_manufacture: this.positiveInteger(
        motor['year_of_manufacture'] ?? motor['manufacture_year'],
        1900,
      ),
      tare_weight: this.money(motor['tare_weight']),
      gross_weight: this.money(motor['gross_weight']),
      motor_usage: this.positiveInteger(
        motor['motor_usage'] ?? motor['motor_usage_code'],
      ),
      owner_name: this.text(motor['owner_name']) ?? '',
      owner_category: this.positiveInteger(motor['owner_category'], 1),
      owner_address: this.text(motor['owner_address']) ?? '',
    };
  }

  private async persistPremiumTotals(
    manager: EntityManager,
    quotationId: string,
    transaction: PolicyTransaction,
  ) {
    const premium = DecimalUtil.value(transaction.net_premium_difference ?? 0);
    const tax = DecimalUtil.value(transaction.tax_difference ?? 0);

    await manager.getRepository(QuotationCoverNote).update(
      { quotation_id: quotationId },
      {
        currency_code: transaction.currency_code,
        total_premium_excluding_tax: premium.toFixed(2),
        total_premium_including_tax: premium.plus(tax).toFixed(2),
      },
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

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private integer(value: unknown): number | null {
    const parsed = Number(value);
    return value !== null && value !== '' && Number.isInteger(parsed)
      ? parsed
      : null;
  }

  private integerOrNull(value: unknown): number | null {
    return this.integer(value);
  }

  private positiveInteger(value: unknown, fallback = 1): number {
    const parsed = this.integer(value);
    return parsed && parsed > 0 ? parsed : fallback;
  }

  private money(value: unknown, fallback = 0): number {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : fallback;
  }

  private nullableMoney(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return this.money(value);
  }

  private approvalStatus(
    value: unknown,
  ): 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' {
    const normalized = this.text(value);

    return normalized === 'PENDING' ||
      normalized === 'APPROVED' ||
      normalized === 'REJECTED'
      ? normalized
      : 'NOT_REQUIRED';
  }

  private gender(value: unknown): 'M' | 'F' | null {
    return value === 'M' || value === 'F' ? value : null;
  }

  private taxFlag(value: unknown): 'Y' | 'N' {
    return value === true || value === 'Y' ? 'Y' : 'N';
  }

  private startDateTime(value: unknown): string {
    const text = this.text(value) ?? new Date().toISOString().slice(0, 10);
    return text.includes('T') ? text : `${text}T00:00:00`;
  }

  private endDateTime(value: unknown): string {
    const text = this.text(value) ?? new Date().toISOString().slice(0, 10);
    return text.includes('T') ? text : `${text}T23:59:59`;
  }
}
