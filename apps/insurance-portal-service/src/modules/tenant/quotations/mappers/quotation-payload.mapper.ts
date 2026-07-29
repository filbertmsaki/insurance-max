import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  CoverNoteAddonDto,
  CoverNoteDetailDto,
  CreateQuotationDto,
  DiscountOfferedDto,
  FleetDetailDto,
  FleetHeaderDto,
  InternalQuotationDto,
  MotorDetailDto,
  PolicyHolderDto,
  RiskCoveredDto,
  SubjectMatterCoveredDto,
  TaxChargedDto,
} from '../dto/quotation-payload.dto';
import { Quotation } from '../entities/quotation.entity';
import { QuotationCoverNote } from '../entities/structured/quotation-cover-note.entity';
import { QuotationCoverNoteEntry } from '../entities/structured/quotation-cover-note-entry.entity';
import { QuotationEntryAddon } from '../entities/structured/quotation-entry-addon.entity';
import { QuotationEntryRisk } from '../entities/structured/quotation-entry-risk.entity';
import { QuotationMotorDetail } from '../entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from '../entities/structured/quotation-policy-holder.entity';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationDisplayStatusResolver } from '../services/quotation-display-status.resolver';
import {
  formatDateOnly,
  formatTiramisDateTime,
} from '../utils/tiramis-date.util';

export interface QuotationListItemResponse {
  id: string;
  quotation_no: string;
  quotation_type: string;
  quotation_flow: string;
  channel_type: string;
  status: string;
  quotation_status: string;
  approval_status: string;
  payment_status: string;
  tira_status: string;
  display_status: string;
  display_label: string;
  requires_approval: boolean;
  requires_payment: boolean;
  is_fleet: boolean;
  fleet_id: string | null;
  currency_code: string;
  product_code: string;
  product_name: string | null;
  customer_name: string | null;
  vehicle_registration_number: string | null;
  vehicle_chassis_number: string | null;
  cover_note_start_date: string;
  cover_note_end_date: string;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationListItemExtra {
  customerName: string | null;
  vehicleRegistrationNumber: string | null;
  vehicleChassisNumber: string | null;
}

export type QuotationDetailResponse = {
  id: string;
  quotation_no: string;
  customer_id: string | null;
  status: string;
  quotation_status: string;
  approval_status: string;
  payment_status: string;
  tira_status: string;
  display_status: string;
  display_label: string;
  requires_approval: boolean;
  requires_payment: boolean;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
} & CreateQuotationDto;

@Injectable()
export class QuotationPayloadMapper {
  constructor(
    private readonly quotationDisplayStatusResolver: QuotationDisplayStatusResolver,
  ) {}

  toResponse(quotation: Quotation): QuotationDetailResponse {
    const display = this.quotationDisplayStatusResolver.resolve(quotation);

    return {
      id: quotation.id,
      quotation_no: quotation.quotation_no,
      customer_id: quotation.customer_id ?? null,
      status: quotation.status,
      quotation_status: quotation.status,
      approval_status: quotation.approval_status,
      payment_status: quotation.payment_status,
      tira_status: quotation.tira_status,
      display_status: display.displayStatus,
      display_label: display.displayLabel,
      requires_approval: quotation.requires_approval,
      requires_payment: quotation.requires_payment,
      submitted_by: quotation.submitted_by ?? null,
      submitted_at: quotation.submitted_at
        ? quotation.submitted_at.toISOString()
        : null,
      created_at: quotation.created_at.toISOString(),
      updated_at: quotation.updated_at.toISOString(),
      ...this.toAuthoritativePayload(quotation),
    };
  }

  toListItem(
    quotation: Quotation,
    extra?: QuotationListItemExtra,
  ): QuotationListItemResponse {
    const coverNote = this.requireCoverNote(quotation);
    const display = this.quotationDisplayStatusResolver.resolve(quotation);

    return {
      id: quotation.id,
      quotation_no: quotation.quotation_no,
      quotation_type: quotation.quotation_type,
      quotation_flow: quotation.quotation_flow,
      channel_type: quotation.channel_type,
      status: quotation.status,
      quotation_status: quotation.status,
      approval_status: quotation.approval_status,
      payment_status: quotation.payment_status,
      tira_status: quotation.tira_status,
      display_status: display.displayStatus,
      display_label: display.displayLabel,
      requires_approval: quotation.requires_approval,
      requires_payment: quotation.requires_payment,
      is_fleet: quotation.is_fleet,
      fleet_id: coverNote.fleet_id,
      currency_code: coverNote.currency_code,
      product_code: coverNote.product_code,
      product_name: quotation.product?.product_name ?? null,
      customer_name: extra?.customerName ?? null,
      vehicle_registration_number: extra?.vehicleRegistrationNumber ?? null,
      vehicle_chassis_number: extra?.vehicleChassisNumber ?? null,
      cover_note_start_date: formatTiramisDateTime(
        coverNote.cover_note_start_date,
      ),
      cover_note_end_date: formatTiramisDateTime(coverNote.cover_note_end_date),
      total_premium_excluding_tax: this.toNumber(
        coverNote.total_premium_excluding_tax,
        'total_premium_excluding_tax',
      ),
      total_premium_including_tax: this.toNumber(
        coverNote.total_premium_including_tax,
        'total_premium_including_tax',
      ),
      submitted_at: quotation.submitted_at
        ? quotation.submitted_at.toISOString()
        : null,
      created_at: quotation.created_at.toISOString(),
      updated_at: quotation.updated_at.toISOString(),
    };
  }

  toAuthoritativePayload(quotation: Quotation): CreateQuotationDto {
    const coverNote = this.requireCoverNote(quotation);

    const internalQuotation: InternalQuotationDto = {
      insurer_company_id: quotation.insurer_company_id,
      intermediary_company_id: quotation.intermediary_company_id,
      branch_id: quotation.branch_id,
      department_id: quotation.department_id,
      category_id: quotation.category_id,
      product_id: quotation.product_id,
      sub_class_id: quotation.sub_class_id,
      quotation_type: quotation.quotation_type,
      quotation_flow: quotation.quotation_flow,
      channel_type: quotation.channel_type,
      is_fleet: quotation.is_fleet,
    };

    if (quotation.quotation_flow === QuotationFlow.MOTOR_FLEET) {
      return {
        internal_quotation: internalQuotation,
        cover_note_hdr: {
          cover_note_type: coverNote.cover_note_type,
        },
        cover_note_dtl: {
          fleet_hdr: this.mapFleetHeader(quotation, coverNote),
          fleet_dtls: this.sortedEntries(coverNote.entries).map((entry) =>
            this.mapFleetEntry(entry),
          ),
        },
      };
    }

    const entries = this.sortedEntries(coverNote.entries);

    if (entries.length !== 1) {
      throw new InternalServerErrorException(
        `${quotation.quotation_flow} quotation must contain exactly one cover-note entry. Found ${entries.length}.`,
      );
    }

    const entry = entries[0];

    const detail: CoverNoteDetailDto = {
      cover_note_number: entry.cover_note_number,
      prev_cover_note_reference_number: entry.prev_cover_note_reference_number,
      sale_point_code: coverNote.sale_point_code,
      cover_note_start_date: formatTiramisDateTime(
        coverNote.cover_note_start_date,
      ),
      cover_note_end_date: formatTiramisDateTime(coverNote.cover_note_end_date),
      cover_note_desc: entry.cover_note_desc,
      operative_clause: entry.operative_clause,
      payment_mode: coverNote.payment_mode,
      currency_code: coverNote.currency_code,
      exchange_rate: this.toNumber(coverNote.exchange_rate, 'exchange_rate'),
      total_premium_excluding_tax: this.toNumber(
        coverNote.total_premium_excluding_tax,
        'total_premium_excluding_tax',
      ),
      total_premium_including_tax: this.toNumber(
        coverNote.total_premium_including_tax,
        'total_premium_including_tax',
      ),
      /*
       * Preserve the authoritative external spelling.
       */
      commision_paid: this.toNumber(
        coverNote.commission_paid,
        'commission_paid',
      ),
      commision_rate: this.toNumber(
        coverNote.commission_rate,
        'commission_rate',
      ),
      officer_name: coverNote.officer_name,
      officer_title: coverNote.officer_title,
      product_code: coverNote.product_code,
      endorsement_type: entry.endorsement_type,
      endorsement_reason: entry.endorsement_reason,
      endorsement_premium_earned: this.toNullableNumber(
        entry.endorsement_premium_earned,
        'endorsement_premium_earned',
      ),
      risks_covered: this.mapRisks(entry),
      subject_matters_covered: this.mapSubjectMatters(entry),
      cover_note_addons: this.mapAddons(entry),
      policy_holders: this.mapPolicyHolders(quotation.policy_holders),
    };

    if (quotation.quotation_flow === QuotationFlow.MOTOR_SINGLE) {
      detail.motor_dtl = this.mapRequiredMotorDetail(
        entry.motor_detail,
        entry.cover_note_number,
      );
    }

    return {
      internal_quotation: internalQuotation,
      cover_note_hdr: {
        cover_note_type: coverNote.cover_note_type,
      },
      cover_note_dtl: detail,
    };
  }

  businessReference(quotation: Quotation): string {
    const coverNote = this.requireCoverNote(quotation);

    if (quotation.quotation_flow === QuotationFlow.MOTOR_FLEET) {
      return coverNote.fleet_id || quotation.quotation_no;
    }

    const entry = this.sortedEntries(coverNote.entries)[0];

    return entry?.cover_note_number || quotation.quotation_no;
  }

  private mapFleetHeader(
    quotation: Quotation,
    coverNote: QuotationCoverNote,
  ): FleetHeaderDto {
    return {
      fleet_id: this.requireString(coverNote.fleet_id, 'fleet_id'),
      fleet_type: this.requireInteger(coverNote.fleet_type, 'fleet_type'),
      fleet_size: this.requireInteger(coverNote.fleet_size, 'fleet_size'),
      comprehensive_insured: this.requireInteger(
        coverNote.comprehensive_insured,
        'comprehensive_insured',
      ),
      sale_point_code: coverNote.sale_point_code,
      cover_note_start_date: formatTiramisDateTime(
        coverNote.cover_note_start_date,
      ),
      cover_note_end_date: formatTiramisDateTime(coverNote.cover_note_end_date),
      payment_mode: coverNote.payment_mode,
      currency_code: coverNote.currency_code,
      exchange_rate: this.toNumber(coverNote.exchange_rate, 'exchange_rate'),
      total_premium_excluding_tax: this.toNumber(
        coverNote.total_premium_excluding_tax,
        'total_premium_excluding_tax',
      ),
      total_premium_including_tax: this.toNumber(
        coverNote.total_premium_including_tax,
        'total_premium_including_tax',
      ),
      commision_paid: this.toNumber(
        coverNote.commission_paid,
        'commission_paid',
      ),
      commision_rate: this.toNumber(
        coverNote.commission_rate,
        'commission_rate',
      ),
      officer_name: coverNote.officer_name,
      officer_title: coverNote.officer_title,
      product_code: coverNote.product_code,
      policy_holders: this.mapPolicyHolders(quotation.policy_holders),
    };
  }

  private mapFleetEntry(entry: QuotationCoverNoteEntry): FleetDetailDto {
    return {
      fleet_entry: this.requireInteger(
        entry.fleet_entry,
        `fleet_entry for ${entry.cover_note_number}`,
      ),
      cover_note_number: entry.cover_note_number,
      prev_cover_note_reference_number: entry.prev_cover_note_reference_number,
      cover_note_desc: entry.cover_note_desc,
      operative_clause: entry.operative_clause,
      endorsement_type: entry.endorsement_type,
      endorsement_reason: entry.endorsement_reason,
      endorsement_premium_earned: this.toNullableNumber(
        entry.endorsement_premium_earned,
        'endorsement_premium_earned',
      ),
      risks_covered: this.mapRisks(entry),
      subject_matters_covered: this.mapSubjectMatters(entry),
      cover_note_addons: this.mapAddons(entry),
      motor_dtl: this.mapRequiredMotorDetail(
        entry.motor_detail,
        entry.cover_note_number,
      ),
    };
  }

  private mapRisks(entry: QuotationCoverNoteEntry): RiskCoveredDto[] {
    return this.sortedBySequence(entry.risks).map((risk) => ({
      risk_code: risk.risk_code,
      pricing_quote_id: risk.pricing_quote_id,
      sum_insured: this.toNumber(risk.sum_insured, 'sum_insured'),
      sum_insured_equivalent: this.toNumber(
        risk.sum_insured_equivalent,
        'sum_insured_equivalent',
      ),
      premium_rate: this.toNumber(risk.premium_rate, 'premium_rate'),
      premium_before_discount: this.toNumber(
        risk.premium_before_discount,
        'premium_before_discount',
      ),
      premium_after_discount: this.toNumber(
        risk.premium_after_discount,
        'premium_after_discount',
      ),
      premium_excluding_tax_equivalent: this.toNumber(
        risk.premium_excluding_tax_equivalent,
        'premium_excluding_tax_equivalent',
      ),
      premium_including_tax: this.toNumber(
        risk.premium_including_tax,
        'premium_including_tax',
      ),
      discounts_offered: this.mapDiscounts(risk),
      taxes_charged: this.mapRiskTaxes(risk),
    }));
  }

  private mapDiscounts(risk: QuotationEntryRisk): DiscountOfferedDto[] {
    return this.sortedBySequence(risk.discounts).map((discount) => ({
      discount_type: discount.discount_type,
      discount_rate: this.toNumber(discount.discount_rate, 'discount_rate'),
      discount_amount: this.toNumber(
        discount.discount_amount,
        'discount_amount',
      ),
      request_reason_code: discount.request_reason_code,
      request_comment: discount.request_comment,
      effective_from: discount.effective_from,
      effective_to: discount.effective_to,
      requested_by: discount.requested_by,
      requested_at: discount.requested_at?.toISOString() ?? null,
      max_permitted_rate: this.toNullableNumber(
        discount.max_permitted_rate,
        'max_permitted_rate',
      ),
      max_permitted_amount: this.toNullableNumber(
        discount.max_permitted_amount,
        'max_permitted_amount',
      ),
      approval_required: discount.approval_required,
      approval_status: discount.approval_status as
        | 'NOT_REQUIRED'
        | 'PENDING'
        | 'APPROVED'
        | 'REJECTED',
      approved_rate: this.toNullableNumber(
        discount.approved_rate,
        'approved_rate',
      ),
      approved_amount: this.toNullableNumber(
        discount.approved_amount,
        'approved_amount',
      ),
      approved_by: discount.approved_by,
      approval_date: discount.approval_date?.toISOString() ?? null,
      rejection_reason: discount.rejection_reason,
    }));
  }

  private mapRiskTaxes(risk: QuotationEntryRisk): TaxChargedDto[] {
    return this.sortedBySequence(risk.taxes).map((tax) => ({
      tax_code: tax.tax_code,
      is_tax_exempted: this.toTaxExemptionFlag(tax.is_tax_exempted),
      tax_exemption_type: tax.tax_exemption_type,
      tax_exemption_reference: tax.tax_exemption_reference,
      tax_rate: this.toNumber(tax.tax_rate, 'tax_rate'),
      tax_amount: this.toNumber(tax.tax_amount, 'tax_amount'),
    }));
  }

  private mapSubjectMatters(
    entry: QuotationCoverNoteEntry,
  ): SubjectMatterCoveredDto[] {
    return this.sortedBySequence(entry.subject_matters).map((subject) => ({
      subject_matter_reference: subject.subject_matter_reference,
      subject_matter_desc: subject.subject_matter_desc,
    }));
  }

  private mapAddons(entry: QuotationCoverNoteEntry): CoverNoteAddonDto[] {
    return this.sortedBySequence(entry.addons).map((addon) => ({
      addon_reference: addon.addon_reference,
      addon_desc: addon.addon_desc,
      addon_amount: this.toNumber(addon.addon_amount, 'addon_amount'),
      addon_premium_rate: this.toNumber(
        addon.addon_premium_rate,
        'addon_premium_rate',
      ),
      premium_excluding_tax: this.toNumber(
        addon.premium_excluding_tax,
        'premium_excluding_tax',
      ),
      premium_excluding_tax_equivalent: this.toNumber(
        addon.premium_excluding_tax_equivalent,
        'premium_excluding_tax_equivalent',
      ),
      premium_including_tax: this.toNumber(
        addon.premium_including_tax,
        'premium_including_tax',
      ),
      taxes_charged: this.mapAddonTaxes(addon),
    }));
  }

  private mapAddonTaxes(addon: QuotationEntryAddon): TaxChargedDto[] {
    return this.sortedBySequence(addon.taxes).map((tax) => ({
      tax_code: tax.tax_code,
      is_tax_exempted: this.toTaxExemptionFlag(tax.is_tax_exempted),
      tax_exemption_type: tax.tax_exemption_type,
      tax_exemption_reference: tax.tax_exemption_reference,
      tax_rate: this.toNumber(tax.tax_rate, 'tax_rate'),
      tax_amount: this.toNumber(tax.tax_amount, 'tax_amount'),
    }));
  }

  private mapPolicyHolders(
    policyHolders: QuotationPolicyHolder[] | undefined,
  ): PolicyHolderDto[] {
    return this.sortedBySequence(policyHolders).map((holder) => ({
      policy_holder_name: holder.policy_holder_name,
      policy_holder_birth_date: formatDateOnly(holder.policy_holder_birth_date),
      policy_holder_type: holder.policy_holder_type,
      policy_holder_id_number: holder.policy_holder_id_number,
      policy_holder_id_type: holder.policy_holder_id_type,
      gender: holder.gender === null ? null : (holder.gender as 'M' | 'F'),
      country_code: holder.country_code,
      region: holder.region,
      district: holder.district,
      street: holder.street,
      policy_holder_phone_number: holder.policy_holder_phone_number,
      policy_holder_fax: holder.policy_holder_fax,
      postal_address: holder.postal_address,
      email_address: holder.email_address,
    }));
  }

  private mapRequiredMotorDetail(
    motor: QuotationMotorDetail | null | undefined,
    coverNoteNumber: string,
  ): MotorDetailDto {
    if (!motor) {
      throw new InternalServerErrorException(
        `Motor details are missing for cover note ${coverNoteNumber}`,
      );
    }

    return {
      motor_category: motor.motor_category,
      motor_type: motor.motor_type,
      registration_number: motor.registration_number,
      chassis_number: motor.chassis_number,
      make: motor.make,
      model: motor.model,
      model_number: motor.model_number,
      body_type: motor.body_type,
      color: motor.color,
      engine_number: motor.engine_number,
      engine_capacity: motor.engine_capacity,
      fuel_used: motor.fuel_used,
      number_of_axles: motor.number_of_axles,
      axle_distance: this.toNumber(motor.axle_distance, 'axle_distance'),
      sitting_capacity: motor.sitting_capacity,
      year_of_manufacture: motor.year_of_manufacture,
      tare_weight: this.toNumber(motor.tare_weight, 'tare_weight'),
      gross_weight: this.toNumber(motor.gross_weight, 'gross_weight'),
      motor_usage: motor.motor_usage,
      owner_name: motor.owner_name,
      owner_category: motor.owner_category,
      owner_address: motor.owner_address,
    };
  }

  private requireCoverNote(quotation: Quotation): QuotationCoverNote {
    if (!quotation.cover_note) {
      throw new InternalServerErrorException(
        `Cover-note information is missing for quotation ${quotation.quotation_no}`,
      );
    }

    return quotation.cover_note;
  }

  private sortedEntries(
    entries: QuotationCoverNoteEntry[] | undefined,
  ): QuotationCoverNoteEntry[] {
    return [...(entries ?? [])].sort(
      (first, second) => first.entry_number - second.entry_number,
    );
  }

  private sortedBySequence<T extends { sequence_no: number }>(
    values: T[] | undefined,
  ): T[] {
    return [...(values ?? [])].sort(
      (first, second) => first.sequence_no - second.sequence_no,
    );
  }

  private toNumber(value: string | number, fieldName: string): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new InternalServerErrorException(
        `Invalid numeric value stored for ${fieldName}`,
      );
    }

    return parsed;
  }

  private toNullableNumber(
    value: string | number | null | undefined,
    fieldName: string,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toNumber(value, fieldName);
  }

  private requireString(
    value: string | null | undefined,
    fieldName: string,
  ): string {
    if (!value?.trim()) {
      throw new InternalServerErrorException(
        `Required fleet value ${fieldName} is missing`,
      );
    }

    return value;
  }

  private requireInteger(
    value: number | null | undefined,
    fieldName: string,
  ): number {
    if (value === null || value === undefined || !Number.isInteger(value)) {
      throw new InternalServerErrorException(
        `Required fleet value ${fieldName} is invalid`,
      );
    }

    return value;
  }

  private toTaxExemptionFlag(value: string): 'Y' | 'N' {
    if (value !== 'Y' && value !== 'N') {
      throw new InternalServerErrorException(
        `Invalid stored tax exemption flag: ${value}`,
      );
    }

    return value;
  }
}
