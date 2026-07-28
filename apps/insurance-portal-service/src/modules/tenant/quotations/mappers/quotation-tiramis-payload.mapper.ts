import { Injectable } from '@nestjs/common';

import type {
  CoverNoteAddonDto,
  CreateQuotationDto,
  DiscountOfferedDto,
  FleetDetailDto,
  FleetHeaderDto,
  MotorDetailDto,
  PolicyHolderDto,
  RiskCoveredDto,
  SubjectMatterCoveredDto,
  TaxChargedDto,
} from '../dto/quotation-payload.dto';
import { QuotationFlow } from '../enums/quotation-flow.enum';

@Injectable()
export class QuotationTiramisPayloadMapper {
  /**
   * Maps only an already-validated authoritative backend quotation payload.
   * Callers must perform pricing, approval, payment, and field validation
   * before invoking this mapper.
   */
  toTiramisPayload(
    payload: CreateQuotationDto,
    context: { branchCode?: string | null } = {},
  ): Record<string, unknown> {
    switch (payload.internal_quotation.quotation_flow) {
      case QuotationFlow.NON_MOTOR:
        return this.mapNonMotorPayload(payload, context.branchCode);
      case QuotationFlow.MOTOR_SINGLE:
        return this.mapMotorSinglePayload(payload, context.branchCode);
      case QuotationFlow.MOTOR_FLEET:
        return this.mapMotorFleetPayload(payload, context.branchCode);
      default:
        return {};
    }
  }

  private mapNonMotorPayload(
    payload: CreateQuotationDto,
    branchCode?: string | null,
  ): Record<string, unknown> {
    const detail = payload.cover_note_dtl;

    return {
      ...(branchCode ? { branchCode } : {}),
      coverNoteType: payload.cover_note_hdr.cover_note_type,
      coverNoteNumber: detail.cover_note_number,
      prevCoverNoteReferenceNumber: detail.prev_cover_note_reference_number,
      salePointCode: detail.sale_point_code,
      coverNoteStartDate: detail.cover_note_start_date,
      coverNoteEndDate: detail.cover_note_end_date,
      coverNoteDesc: detail.cover_note_desc,
      operativeClause: detail.operative_clause,
      paymentMode: detail.payment_mode,
      currencyCode: detail.currency_code,
      exchangeRate: detail.exchange_rate,
      totalPremiumExcludingTax: detail.total_premium_excluding_tax,
      totalPremiumIncludingTax: detail.total_premium_including_tax,
      commissionPaid: detail.commision_paid,
      commissionRate: detail.commision_rate,
      officerName: detail.officer_name,
      officerTitle: detail.officer_title,
      productCode: detail.product_code,
      endorsementType: detail.endorsement_type,
      endorsementReason: detail.endorsement_reason,
      endorsementPremiumEarned: detail.endorsement_premium_earned,
      risks: this.mapRisks(detail.risks_covered ?? []),
      subjectMatters: this.mapSubjectMatters(
        detail.subject_matters_covered ?? [],
      ),
      addons: this.mapAddons(detail.cover_note_addons ?? []),
      policyHolders: this.mapPolicyHolders(detail.policy_holders ?? []),
    };
  }

  private mapMotorSinglePayload(
    payload: CreateQuotationDto,
    branchCode?: string | null,
  ): Record<string, unknown> {
    const detail = payload.cover_note_dtl;

    return {
      ...this.mapNonMotorPayload(payload, branchCode),
      isFleet: false,
      motorDetail: this.mapMotorDetail(detail.motor_dtl!),
    };
  }

  private mapMotorFleetPayload(
    payload: CreateQuotationDto,
    branchCode?: string | null,
  ): Record<string, unknown> {
    const header = payload.cover_note_dtl.fleet_hdr!;
    const items = payload.cover_note_dtl.fleet_dtls ?? [];

    return {
      ...(branchCode ? { branchCode } : {}),
      coverNoteType: payload.cover_note_hdr.cover_note_type,
      coverNoteNumber: items[0]?.cover_note_number,
      prevCoverNoteReferenceNumber:
        items[0]?.prev_cover_note_reference_number ?? null,
      salePointCode: header.sale_point_code,
      coverNoteStartDate: header.cover_note_start_date,
      coverNoteEndDate: header.cover_note_end_date,
      coverNoteDesc: items[0]?.cover_note_desc,
      operativeClause: items[0]?.operative_clause,
      paymentMode: header.payment_mode,
      currencyCode: header.currency_code,
      exchangeRate: header.exchange_rate,
      totalPremiumExcludingTax: header.total_premium_excluding_tax,
      totalPremiumIncludingTax: header.total_premium_including_tax,
      commissionPaid: header.commision_paid,
      commissionRate: header.commision_rate,
      officerName: header.officer_name,
      officerTitle: header.officer_title,
      productCode: header.product_code,
      endorsementType: items[0]?.endorsement_type ?? null,
      endorsementReason: items[0]?.endorsement_reason ?? null,
      endorsementPremiumEarned: items[0]?.endorsement_premium_earned ?? null,
      risks: this.mapRisks(items[0]?.risks_covered ?? []),
      subjectMatters: this.mapSubjectMatters(
        items[0]?.subject_matters_covered ?? [],
      ),
      addons: this.mapAddons(items[0]?.cover_note_addons ?? []),
      policyHolders: this.mapPolicyHolders(header.policy_holders),
      isFleet: true,
      fleet: this.mapFleet(header, items),
    };
  }

  private mapFleet(
    header: FleetHeaderDto,
    items: FleetDetailDto[],
  ): Record<string, unknown> {
    return {
      fleetId: header.fleet_id,
      fleetType: header.fleet_type,
      fleetSize: header.fleet_size,
      comprehensiveInsured: header.comprehensive_insured,
      items: items.map((item) => ({
        fleetEntry: String(item.fleet_entry),
        coverNoteNumber: item.cover_note_number,
        prevCoverNoteReferenceNumber: item.prev_cover_note_reference_number,
        coverNoteDesc: item.cover_note_desc,
        operativeClause: item.operative_clause,
        endorsementType: item.endorsement_type,
        endorsementReason: item.endorsement_reason,
        endorsementPremiumEarned: item.endorsement_premium_earned,
        risks: this.mapRisks(item.risks_covered),
        subjectMatters: this.mapSubjectMatters(item.subject_matters_covered),
        addons: this.mapAddons(item.cover_note_addons),
        motorDetail: this.mapMotorDetail(item.motor_dtl),
      })),
    };
  }

  private mapRisks(risks: RiskCoveredDto[]): Array<Record<string, unknown>> {
    return risks.map((risk) => ({
      riskCode: risk.risk_code,
      sumInsured: risk.sum_insured,
      sumInsuredEquivalent: risk.sum_insured_equivalent,
      premiumRate: risk.premium_rate,
      premiumBeforeDiscount: risk.premium_before_discount,
      premiumAfterDiscount: risk.premium_after_discount,
      premiumExcludingTaxEquivalent: risk.premium_excluding_tax_equivalent,
      premiumIncludingTax: risk.premium_including_tax,
      discounts: this.mapDiscounts(risk.discounts_offered),
      taxes: this.mapTaxes(risk.taxes_charged),
    }));
  }

  private mapDiscounts(
    discounts: DiscountOfferedDto[],
  ): Array<Record<string, unknown>> {
    return discounts.map((discount) => ({
      discountType: discount.discount_type,
      discountRate: discount.discount_rate,
      discountAmount: discount.discount_amount,
    }));
  }

  private mapTaxes(taxes: TaxChargedDto[]): Array<Record<string, unknown>> {
    return taxes.map((tax) => ({
      taxCode: tax.tax_code,
      isTaxExempted: tax.is_tax_exempted,
      taxExemptionType: tax.tax_exemption_type,
      taxExemptionReference: tax.tax_exemption_reference,
      taxRate: tax.tax_rate,
      taxAmount: tax.tax_amount,
    }));
  }

  private mapSubjectMatters(
    subjectMatters: SubjectMatterCoveredDto[],
  ): Array<Record<string, unknown>> {
    return subjectMatters.map((subject) => ({
      subjectMatterReference: subject.subject_matter_reference,
      subjectMatterDesc: subject.subject_matter_desc,
    }));
  }

  private mapAddons(
    addons: CoverNoteAddonDto[],
  ): Array<Record<string, unknown>> {
    return addons.map((addon) => ({
      addonReference: addon.addon_reference,
      addonDesc: addon.addon_desc,
      addonAmount: addon.addon_amount,
      addonPremiumRate: addon.addon_premium_rate,
      premiumExcludingTax: addon.premium_excluding_tax,
      premiumExcludingTaxEquivalent: addon.premium_excluding_tax_equivalent,
      premiumIncludingTax: addon.premium_including_tax,
      taxes: this.mapTaxes(addon.taxes_charged),
    }));
  }

  private mapPolicyHolders(
    policyHolders: PolicyHolderDto[],
  ): Array<Record<string, unknown>> {
    return policyHolders.map((holder) => ({
      policyHolderName: holder.policy_holder_name,
      policyHolderBirthDate: holder.policy_holder_birth_date,
      policyHolderType: holder.policy_holder_type,
      policyHolderIdNumber: holder.policy_holder_id_number,
      policyHolderIdType: holder.policy_holder_id_type,
      gender: holder.gender,
      countryCode: holder.country_code,
      region: holder.region,
      district: holder.district,
      street: holder.street,
      phoneNumber: holder.policy_holder_phone_number,
      fax: holder.policy_holder_fax,
      postalAddress: holder.postal_address,
      emailAddress: holder.email_address,
    }));
  }

  private mapMotorDetail(motor: MotorDetailDto): Record<string, unknown> {
    return {
      motorCategory: motor.motor_category,
      motorType: motor.motor_type,
      registrationNumber: motor.registration_number,
      chassisNumber: motor.chassis_number,
      make: motor.make,
      model: motor.model,
      modelNumber: motor.model_number,
      bodyType: motor.body_type,
      color: motor.color,
      engineNumber: motor.engine_number,
      engineCapacity: motor.engine_capacity,
      fuelUsed: motor.fuel_used,
      numberOfAxles: motor.number_of_axles,
      axleDistance: motor.axle_distance,
      sittingCapacity: motor.sitting_capacity,
      yearOfManufacture: motor.year_of_manufacture,
      tareWeight: motor.tare_weight,
      grossWeight: motor.gross_weight,
      motorUsage: motor.motor_usage,
      ownerName: motor.owner_name,
      ownerCategory: motor.owner_category,
      ownerAddress: motor.owner_address,
    };
  }
}
