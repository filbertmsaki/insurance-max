import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CoverNoteAddonDto,
  CoverNoteDetailDto,
  CreateQuotationDto,
  MotorDetailDto,
  PolicyHolderDto,
  RiskCoveredDto,
  SubjectMatterCoveredDto,
  TaxChargedDto,
} from '../dto/quotation-payload.dto';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationType } from '../enums/quotation-type.enum';

interface EntryFinancialTotals {
  premiumExcludingTax: number;
  premiumIncludingTax: number;
}

interface QuotationEntryPayload {
  fleet_entry?: number;
  cover_note_number?: string;
  prev_cover_note_reference_number?: string | null;
  cover_note_desc: string;
  operative_clause: string;
  endorsement_type?: number | null;
  endorsement_reason?: string | null;
  endorsement_premium_earned?: number | null;
  risks_covered: RiskCoveredDto[];
  subject_matters_covered: SubjectMatterCoveredDto[];
  cover_note_addons: CoverNoteAddonDto[];
  motor_dtl?: MotorDetailDto;
}

@Injectable()
export class QuotationPayloadValidator {
  private readonly moneyTolerance = 0.01;
  private readonly maximumRate = 1;

  assertValid(payload: CreateQuotationDto): void {
    const errors: string[] = [];

    if (!payload) {
      throw new BadRequestException({
        message: 'Quotation payload is required',
        validation_errors: ['The request body must not be empty'],
      });
    }

    this.validateRootStructure(payload, errors);

    if (payload.internal_quotation && payload.cover_note_dtl) {
      switch (payload.internal_quotation.quotation_flow) {
        case QuotationFlow.NON_MOTOR:
          this.validateNonMotor(payload, errors);
          break;
        case QuotationFlow.MOTOR_SINGLE:
          this.validateSingleMotor(payload, errors);
          break;
        case QuotationFlow.MOTOR_FLEET:
          this.validateMotorFleet(payload, errors);
          break;
        default:
          errors.push('internal_quotation.quotation_flow is not supported');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Quotation payload validation failed',
        validation_errors: errors,
      });
    }
  }

  private validateRootStructure(
    payload: CreateQuotationDto,
    errors: string[],
  ): void {
    if (!payload.internal_quotation) {
      errors.push('internal_quotation is required');
    }

    if (!payload.cover_note_hdr) {
      errors.push('cover_note_hdr is required');
    }

    if (!payload.cover_note_dtl) {
      errors.push('cover_note_dtl is required');
    }

    if (payload.cover_note_hdr && payload.cover_note_hdr.cover_note_type <= 0) {
      errors.push('cover_note_hdr.cover_note_type must be greater than zero');
    }
  }

  private validateNonMotor(
    payload: CreateQuotationDto,
    errors: string[],
  ): void {
    const internal = payload.internal_quotation;
    const detail = payload.cover_note_dtl;

    if (internal.quotation_type !== QuotationType.NON_MOTOR) {
      errors.push(
        'internal_quotation.quotation_type must be NON_MOTOR when quotation_flow is NON_MOTOR',
      );
    }

    if (internal.is_fleet) {
      errors.push('internal_quotation.is_fleet must be false for NON_MOTOR');
    }

    this.rejectFleetFields(detail, errors);
    this.requireStandardCoverNoteFields(detail, errors);

    if (detail.motor_dtl !== undefined && detail.motor_dtl !== null) {
      errors.push('cover_note_dtl.motor_dtl is not allowed for NON_MOTOR');
    }

    this.validateStandardQuotation(detail, false, errors);
  }

  private validateSingleMotor(
    payload: CreateQuotationDto,
    errors: string[],
  ): void {
    const internal = payload.internal_quotation;
    const detail = payload.cover_note_dtl;

    if (internal.quotation_type !== QuotationType.MOTOR) {
      errors.push(
        'internal_quotation.quotation_type must be MOTOR when quotation_flow is MOTOR_SINGLE',
      );
    }

    if (internal.is_fleet) {
      errors.push('internal_quotation.is_fleet must be false for MOTOR_SINGLE');
    }

    this.rejectFleetFields(detail, errors);
    this.requireStandardCoverNoteFields(detail, errors);

    if (!detail.motor_dtl) {
      errors.push('cover_note_dtl.motor_dtl is required for MOTOR_SINGLE');
    }

    this.validateStandardQuotation(detail, true, errors);
  }

  private validateMotorFleet(
    payload: CreateQuotationDto,
    errors: string[],
  ): void {
    const internal = payload.internal_quotation;
    const detail = payload.cover_note_dtl;

    if (internal.quotation_type !== QuotationType.MOTOR) {
      errors.push(
        'internal_quotation.quotation_type must be MOTOR when quotation_flow is MOTOR_FLEET',
      );
    }

    if (!internal.is_fleet) {
      errors.push('internal_quotation.is_fleet must be true for MOTOR_FLEET');
    }

    this.rejectStandardCoverNoteFields(detail, errors);

    if (!detail.fleet_hdr) {
      errors.push('cover_note_dtl.fleet_hdr is required for MOTOR_FLEET');
    }

    if (!Array.isArray(detail.fleet_dtls) || detail.fleet_dtls.length === 0) {
      errors.push(
        'cover_note_dtl.fleet_dtls must contain at least one vehicle',
      );
    }

    if (!detail.fleet_hdr || !detail.fleet_dtls?.length) {
      return;
    }

    const fleetHeader = detail.fleet_hdr;
    const fleetDetails = detail.fleet_dtls;

    this.validateDates(
      fleetHeader.cover_note_start_date,
      fleetHeader.cover_note_end_date,
      'cover_note_dtl.fleet_hdr',
      errors,
    );

    this.validateCommonHeaderValues(
      fleetHeader.currency_code,
      fleetHeader.exchange_rate,
      fleetHeader.total_premium_excluding_tax,
      fleetHeader.total_premium_including_tax,
      fleetHeader.commision_paid,
      fleetHeader.commision_rate,
      'cover_note_dtl.fleet_hdr',
      errors,
    );

    this.validatePolicyHolders(
      fleetHeader.policy_holders,
      'cover_note_dtl.fleet_hdr.policy_holders',
      errors,
    );

    if (fleetHeader.fleet_size !== fleetDetails.length) {
      errors.push(
        'cover_note_dtl.fleet_hdr.fleet_size must equal fleet_dtls.length. ' +
          `Received fleet_size=${fleetHeader.fleet_size} and fleet_dtls.length=${fleetDetails.length}`,
      );
    }

    if (fleetHeader.comprehensive_insured > fleetHeader.fleet_size) {
      errors.push(
        'cover_note_dtl.fleet_hdr.comprehensive_insured cannot be greater than fleet_size',
      );
    }

    const fleetEntryNumbers = new Set<number>();
    const coverNoteNumbers = new Set<string>();
    const registrationNumbers = new Set<string>();
    const chassisNumbers = new Set<string>();
    const engineNumbers = new Set<string>();

    let totalPremiumExcludingTax = 0;
    let totalPremiumIncludingTax = 0;

    fleetDetails.forEach((fleetDetail, index) => {
      const path = `cover_note_dtl.fleet_dtls[${index}]`;

      if (fleetEntryNumbers.has(fleetDetail.fleet_entry)) {
        errors.push(
          `${path}.fleet_entry duplicates fleet entry ${fleetDetail.fleet_entry}`,
        );
      }

      fleetEntryNumbers.add(fleetDetail.fleet_entry);

      this.registerUniqueValue(
        coverNoteNumbers,
        fleetDetail.cover_note_number,
        `${path}.cover_note_number`,
        errors,
      );

      this.validateEndorsement(
        fleetDetail.endorsement_type,
        fleetDetail.endorsement_reason,
        fleetDetail.endorsement_premium_earned,
        fleetDetail.prev_cover_note_reference_number,
        path,
        errors,
      );

      const totals = this.validateEntry(fleetDetail, path, true, errors);
      totalPremiumExcludingTax += totals.premiumExcludingTax;
      totalPremiumIncludingTax += totals.premiumIncludingTax;

      if (fleetDetail.motor_dtl) {
        this.registerUniqueValue(
          registrationNumbers,
          fleetDetail.motor_dtl.registration_number,
          `${path}.motor_dtl.registration_number`,
          errors,
        );
        this.registerUniqueValue(
          chassisNumbers,
          fleetDetail.motor_dtl.chassis_number,
          `${path}.motor_dtl.chassis_number`,
          errors,
        );
        this.registerUniqueValue(
          engineNumbers,
          fleetDetail.motor_dtl.engine_number,
          `${path}.motor_dtl.engine_number`,
          errors,
        );
      }
    });

    this.validateFleetEntrySequence(
      fleetEntryNumbers,
      fleetDetails.length,
      errors,
    );

    this.assertMoneyEqual(
      totalPremiumExcludingTax,
      fleetHeader.total_premium_excluding_tax,
      'cover_note_dtl.fleet_hdr.total_premium_excluding_tax',
      errors,
      'The fleet total excluding tax must equal the sum of all fleet risk premiums after discount and add-on premiums',
    );

    this.assertMoneyEqual(
      totalPremiumIncludingTax,
      fleetHeader.total_premium_including_tax,
      'cover_note_dtl.fleet_hdr.total_premium_including_tax',
      errors,
      'The fleet total including tax must equal the sum of all fleet risk and add-on premiums including tax',
    );
  }

  private validateStandardQuotation(
    detail: CoverNoteDetailDto,
    motorRequired: boolean,
    errors: string[],
  ): void {
    this.validateDates(
      detail.cover_note_start_date,
      detail.cover_note_end_date,
      'cover_note_dtl',
      errors,
    );

    this.validateCommonHeaderValues(
      detail.currency_code,
      detail.exchange_rate,
      detail.total_premium_excluding_tax,
      detail.total_premium_including_tax,
      detail.commision_paid,
      detail.commision_rate,
      'cover_note_dtl',
      errors,
    );

    this.validatePolicyHolders(
      detail.policy_holders ?? [],
      'cover_note_dtl.policy_holders',
      errors,
    );

    this.validateEndorsement(
      detail.endorsement_type,
      detail.endorsement_reason,
      detail.endorsement_premium_earned,
      detail.prev_cover_note_reference_number,
      'cover_note_dtl',
      errors,
    );

    const totals = this.validateEntry(
      {
        cover_note_number: detail.cover_note_number ?? '',
        prev_cover_note_reference_number:
          detail.prev_cover_note_reference_number ?? null,
        cover_note_desc: detail.cover_note_desc ?? '',
        operative_clause: detail.operative_clause ?? '',
        endorsement_type: detail.endorsement_type ?? null,
        endorsement_reason: detail.endorsement_reason ?? null,
        endorsement_premium_earned: detail.endorsement_premium_earned ?? null,
        risks_covered: detail.risks_covered ?? [],
        subject_matters_covered: detail.subject_matters_covered ?? [],
        cover_note_addons: detail.cover_note_addons ?? [],
        motor_dtl: detail.motor_dtl,
        fleet_entry: 1,
      },
      'cover_note_dtl',
      motorRequired,
      errors,
    );

    if (detail.total_premium_excluding_tax !== undefined) {
      this.assertMoneyEqual(
        totals.premiumExcludingTax,
        detail.total_premium_excluding_tax,
        'cover_note_dtl.total_premium_excluding_tax',
        errors,
        'The total excluding tax must equal the sum of risk premiums after discount and add-on premiums excluding tax',
      );
    }

    if (detail.total_premium_including_tax !== undefined) {
      this.assertMoneyEqual(
        totals.premiumIncludingTax,
        detail.total_premium_including_tax,
        'cover_note_dtl.total_premium_including_tax',
        errors,
        'The total including tax must equal the sum of risk and add-on premiums including tax',
      );
    }

    if (
      detail.exchange_rate !== undefined &&
      this.numbersEqual(detail.exchange_rate, 1, 0.000001)
    ) {
      this.validateEquivalentValuesForRateOne(
        detail.risks_covered ?? [],
        detail.cover_note_addons ?? [],
        'cover_note_dtl',
        errors,
      );
    }
  }

  private validateEntry(
    entry: QuotationEntryPayload,
    path: string,
    motorRequired: boolean,
    errors: string[],
  ): EntryFinancialTotals {
    const risks = entry.risks_covered ?? [];
    const addons = entry.cover_note_addons ?? [];
    const subjects = entry.subject_matters_covered ?? [];

    if (risks.length === 0) {
      errors.push(`${path}.risks_covered must not be empty`);
    }

    if (subjects.length === 0) {
      errors.push(`${path}.subject_matters_covered must not be empty`);
    }

    if (motorRequired && !entry.motor_dtl) {
      errors.push(`${path}.motor_dtl is required`);
    }

    if (!motorRequired && entry.motor_dtl) {
      errors.push(`${path}.motor_dtl is not allowed`);
    }

    this.validateSubjectMatters(
      subjects,
      `${path}.subject_matters_covered`,
      errors,
    );

    if (entry.motor_dtl) {
      this.validateMotorDetail(entry.motor_dtl, `${path}.motor_dtl`, errors);
    }

    const riskCodes = new Set<string>();
    const addonReferences = new Set<string>();

    let premiumExcludingTax = 0;
    let premiumIncludingTax = 0;

    risks.forEach((risk, index) => {
      this.registerUniqueValue(
        riskCodes,
        risk.risk_code,
        `${path}.risks_covered[${index}].risk_code`,
        errors,
      );

      this.validateRisk(risk, `${path}.risks_covered[${index}]`, errors);
      premiumExcludingTax += risk.premium_after_discount;
      premiumIncludingTax += risk.premium_including_tax;
    });

    addons.forEach((addon, index) => {
      this.registerUniqueValue(
        addonReferences,
        addon.addon_reference,
        `${path}.cover_note_addons[${index}].addon_reference`,
        errors,
      );

      this.validateAddon(addon, `${path}.cover_note_addons[${index}]`, errors);
      premiumExcludingTax += addon.premium_excluding_tax;
      premiumIncludingTax += addon.premium_including_tax;
    });

    return {
      premiumExcludingTax: this.roundMoney(premiumExcludingTax),
      premiumIncludingTax: this.roundMoney(premiumIncludingTax),
    };
  }

  private validateRisk(
    risk: RiskCoveredDto,
    path: string,
    errors: string[],
  ): void {
    if (risk.premium_rate > this.maximumRate) {
      errors.push(
        `${path}.premium_rate must be a decimal rate between 0 and 1`,
      );
    }

    if (risk.premium_after_discount > risk.premium_before_discount) {
      errors.push(
        `${path}.premium_after_discount cannot be greater than premium_before_discount`,
      );
    }

    const totalDiscount = this.roundMoney(
      (risk.discounts_offered ?? []).reduce(
        (sum, discount) => sum + discount.discount_amount,
        0,
      ),
    );

    const expectedAfterDiscount = this.roundMoney(
      risk.premium_before_discount - totalDiscount,
    );

    this.assertMoneyEqual(
      expectedAfterDiscount,
      risk.premium_after_discount,
      `${path}.premium_after_discount`,
      errors,
      'premium_after_discount must equal premium_before_discount minus all discounts_offered',
    );

    risk.discounts_offered?.forEach((discount, index) => {
      if (discount.discount_rate > this.maximumRate) {
        errors.push(
          `${path}.discounts_offered[${index}].discount_rate must be a decimal rate between 0 and 1`,
        );
      }

      if (discount.discount_amount > risk.premium_before_discount) {
        errors.push(
          `${path}.discounts_offered[${index}].discount_amount cannot be greater than premium_before_discount`,
        );
      }
    });

    const totalTax = this.validateTaxes(
      risk.taxes_charged ?? [],
      risk.premium_excluding_tax_equivalent,
      `${path}.taxes_charged`,
      errors,
    );

    const expectedIncludingTax = this.roundMoney(
      risk.premium_excluding_tax_equivalent + totalTax,
    );

    this.assertMoneyEqual(
      expectedIncludingTax,
      risk.premium_including_tax,
      `${path}.premium_including_tax`,
      errors,
      'premium_including_tax must equal premium_excluding_tax_equivalent plus taxes_charged',
    );
  }

  private validateAddon(
    addon: CoverNoteAddonDto,
    path: string,
    errors: string[],
  ): void {
    if (addon.addon_premium_rate > this.maximumRate) {
      errors.push(
        `${path}.addon_premium_rate must be a decimal rate between 0 and 1`,
      );
    }

    const totalTax = this.validateTaxes(
      addon.taxes_charged ?? [],
      addon.premium_excluding_tax_equivalent,
      `${path}.taxes_charged`,
      errors,
    );

    const expectedIncludingTax = this.roundMoney(
      addon.premium_excluding_tax_equivalent + totalTax,
    );

    this.assertMoneyEqual(
      expectedIncludingTax,
      addon.premium_including_tax,
      `${path}.premium_including_tax`,
      errors,
      'premium_including_tax must equal premium_excluding_tax_equivalent plus taxes_charged',
    );
  }

  private validateTaxes(
    taxes: TaxChargedDto[],
    taxablePremium: number,
    path: string,
    errors: string[],
  ): number {
    const taxCodes = new Set<string>();
    let totalTax = 0;

    taxes.forEach((tax, index) => {
      const taxPath = `${path}[${index}]`;

      this.registerUniqueValue(
        taxCodes,
        tax.tax_code,
        `${taxPath}.tax_code`,
        errors,
      );

      if (tax.tax_rate > this.maximumRate) {
        errors.push(
          `${taxPath}.tax_rate must be a decimal rate between 0 and 1`,
        );
      }

      if (tax.is_tax_exempted === 'Y') {
        if (!tax.tax_exemption_type?.trim()) {
          errors.push(
            `${taxPath}.tax_exemption_type is required when is_tax_exempted is Y`,
          );
        }

        if (!tax.tax_exemption_reference?.trim()) {
          errors.push(
            `${taxPath}.tax_exemption_reference is required when is_tax_exempted is Y`,
          );
        }

        if (!this.moneyEqual(tax.tax_amount, 0)) {
          errors.push(`${taxPath}.tax_amount must be 0 when tax is exempted`);
        }
      }

      if (tax.is_tax_exempted === 'N') {
        if (tax.tax_exemption_type) {
          errors.push(
            `${taxPath}.tax_exemption_type must be null when is_tax_exempted is N`,
          );
        }

        if (tax.tax_exemption_reference) {
          errors.push(
            `${taxPath}.tax_exemption_reference must be null when is_tax_exempted is N`,
          );
        }
      }

      if (tax.tax_amount < 0) {
        errors.push(`${taxPath}.tax_amount cannot be negative`);
      }

      if (tax.tax_amount > 0 && taxablePremium <= 0) {
        errors.push(
          `${taxPath}.tax_amount cannot be positive when the taxable premium is zero`,
        );
      }

      totalTax += tax.tax_amount;
    });

    return this.roundMoney(totalTax);
  }

  private validateSubjectMatters(
    subjects: SubjectMatterCoveredDto[],
    path: string,
    errors: string[],
  ): void {
    const references = new Set<string>();

    subjects.forEach((subject, index) => {
      this.registerUniqueValue(
        references,
        subject.subject_matter_reference,
        `${path}[${index}].subject_matter_reference`,
        errors,
      );

      if (!subject.subject_matter_desc?.trim()) {
        errors.push(`${path}[${index}].subject_matter_desc is required`);
      }
    });
  }

  private validateMotorDetail(
    motor: MotorDetailDto,
    path: string,
    errors: string[],
  ): void {
    if (motor.gross_weight < motor.tare_weight) {
      errors.push(`${path}.gross_weight cannot be less than tare_weight`);
    }
  }

  private validatePolicyHolders(
    holders: PolicyHolderDto[],
    path: string,
    errors: string[],
  ): void {
    if (holders.length === 0) {
      errors.push(`${path} must contain at least one policyholder`);
      return;
    }

    const identities = new Set<string>();

    holders.forEach((holder, index) => {
      const holderPath = `${path}[${index}]`;
      const identityKey = `${holder.policy_holder_id_type}:${holder.policy_holder_id_number
        .trim()
        .toUpperCase()}`;

      if (identities.has(identityKey)) {
        errors.push(
          `${holderPath} duplicates policyholder identity ${holder.policy_holder_id_number}`,
        );
      }

      identities.add(identityKey);

      if (!/^\+?[0-9]{9,15}$/.test(holder.policy_holder_phone_number)) {
        errors.push(
          `${holderPath}.policy_holder_phone_number must contain 9 to 15 digits, with an optional leading +`,
        );
      }

      if (!/^[A-Z]{3}$/.test(holder.country_code)) {
        errors.push(
          `${holderPath}.country_code must be a three-letter uppercase country code`,
        );
      }

      if (holder.policy_holder_type === 1 && !holder.gender) {
        errors.push(
          `${holderPath}.gender is required for an individual policyholder`,
        );
      }

      if (
        holder.policy_holder_type === 2 &&
        holder.gender !== null &&
        holder.gender !== undefined
      ) {
        errors.push(`${holderPath}.gender must be null for an organisation`);
      }
    });
  }

  private validateEndorsement(
    endorsementType: number | null | undefined,
    endorsementReason: string | null | undefined,
    endorsementPremiumEarned: number | null | undefined,
    previousCoverNoteReference: string | null | undefined,
    path: string,
    errors: string[],
  ): void {
    if (endorsementType === null || endorsementType === undefined) {
      if (
        endorsementReason !== null &&
        endorsementReason !== undefined &&
        endorsementReason.trim() !== ''
      ) {
        errors.push(
          `${path}.endorsement_reason must be null when endorsement_type is null`,
        );
      }

      if (
        endorsementPremiumEarned !== null &&
        endorsementPremiumEarned !== undefined
      ) {
        errors.push(
          `${path}.endorsement_premium_earned must be null when endorsement_type is null`,
        );
      }

      return;
    }

    if (!endorsementReason?.trim()) {
      errors.push(
        `${path}.endorsement_reason is required when endorsement_type is provided`,
      );
    }

    if (!previousCoverNoteReference?.trim()) {
      errors.push(
        `${path}.prev_cover_note_reference_number is required for an endorsement`,
      );
    }

    if (
      endorsementPremiumEarned !== null &&
      endorsementPremiumEarned !== undefined &&
      endorsementPremiumEarned < 0
    ) {
      errors.push(`${path}.endorsement_premium_earned cannot be negative`);
    }
  }

  private validateDates(
    startDate: string | undefined,
    endDate: string | undefined,
    path: string,
    errors: string[],
  ): void {
    if (!startDate || !endDate) {
      return;
    }

    const startTimestamp = Date.parse(startDate);
    const endTimestamp = Date.parse(endDate);

    if (Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)) {
      return;
    }

    if (endTimestamp <= startTimestamp) {
      errors.push(
        `${path}.cover_note_end_date must be later than cover_note_start_date`,
      );
    }
  }

  private validateCommonHeaderValues(
    currencyCode: string | undefined,
    exchangeRate: number | undefined,
    premiumExcludingTax: number | undefined,
    premiumIncludingTax: number | undefined,
    commissionPaid: number | undefined,
    commissionRate: number | undefined,
    path: string,
    errors: string[],
  ): void {
    if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
      errors.push(
        `${path}.currency_code must be a three-letter uppercase currency code`,
      );
    }

    if (exchangeRate !== undefined && exchangeRate <= 0) {
      errors.push(`${path}.exchange_rate must be greater than zero`);
    }

    if (
      premiumExcludingTax !== undefined &&
      premiumIncludingTax !== undefined &&
      premiumIncludingTax < premiumExcludingTax
    ) {
      errors.push(
        `${path}.total_premium_including_tax cannot be less than total_premium_excluding_tax`,
      );
    }

    if (commissionRate !== undefined && commissionRate > this.maximumRate) {
      errors.push(
        `${path}.commision_rate must be a decimal rate between 0 and 1`,
      );
    }

    if (
      commissionPaid !== undefined &&
      premiumExcludingTax !== undefined &&
      commissionPaid > premiumExcludingTax
    ) {
      errors.push(
        `${path}.commision_paid cannot be greater than total_premium_excluding_tax`,
      );
    }
  }

  private validateEquivalentValuesForRateOne(
    risks: RiskCoveredDto[],
    addons: CoverNoteAddonDto[],
    path: string,
    errors: string[],
  ): void {
    risks.forEach((risk, index) => {
      this.assertMoneyEqual(
        risk.sum_insured,
        risk.sum_insured_equivalent,
        `${path}.risks_covered[${index}].sum_insured_equivalent`,
        errors,
        'sum_insured_equivalent must equal sum_insured when exchange_rate is 1',
      );

      this.assertMoneyEqual(
        risk.premium_after_discount,
        risk.premium_excluding_tax_equivalent,
        `${path}.risks_covered[${index}].premium_excluding_tax_equivalent`,
        errors,
        'premium_excluding_tax_equivalent must equal premium_after_discount when exchange_rate is 1',
      );
    });

    addons.forEach((addon, index) => {
      this.assertMoneyEqual(
        addon.premium_excluding_tax,
        addon.premium_excluding_tax_equivalent,
        `${path}.cover_note_addons[${index}].premium_excluding_tax_equivalent`,
        errors,
        'premium_excluding_tax_equivalent must equal premium_excluding_tax when exchange_rate is 1',
      );
    });
  }

  private requireStandardCoverNoteFields(
    detail: CoverNoteDetailDto,
    errors: string[],
  ): void {
    const requiredFields: Array<keyof CoverNoteDetailDto> = [
      'sale_point_code',
      'cover_note_start_date',
      'cover_note_end_date',
      'cover_note_desc',
      'operative_clause',
      'payment_mode',
      'currency_code',
      'exchange_rate',
      'total_premium_excluding_tax',
      'total_premium_including_tax',
      'commision_paid',
      'commision_rate',
      'officer_name',
      'officer_title',
      'product_code',
      'risks_covered',
      'subject_matters_covered',
      'policy_holders',
    ];

    requiredFields.forEach((field) => {
      if (this.isMissing(detail[field])) {
        errors.push(`cover_note_dtl.${String(field)} is required`);
      }
    });
  }

  private rejectFleetFields(
    detail: CoverNoteDetailDto,
    errors: string[],
  ): void {
    if (detail.fleet_hdr !== undefined && detail.fleet_hdr !== null) {
      errors.push('cover_note_dtl.fleet_hdr is only allowed for MOTOR_FLEET');
    }

    if (detail.fleet_dtls !== undefined && detail.fleet_dtls !== null) {
      errors.push('cover_note_dtl.fleet_dtls is only allowed for MOTOR_FLEET');
    }
  }

  private rejectStandardCoverNoteFields(
    detail: CoverNoteDetailDto,
    errors: string[],
  ): void {
    const standardFields: Array<keyof CoverNoteDetailDto> = [
      'prev_cover_note_reference_number',
      'sale_point_code',
      'cover_note_start_date',
      'cover_note_end_date',
      'cover_note_desc',
      'operative_clause',
      'payment_mode',
      'currency_code',
      'exchange_rate',
      'total_premium_excluding_tax',
      'total_premium_including_tax',
      'commision_paid',
      'commision_rate',
      'officer_name',
      'officer_title',
      'product_code',
      'endorsement_type',
      'endorsement_reason',
      'endorsement_premium_earned',
      'risks_covered',
      'subject_matters_covered',
      'cover_note_addons',
      'policy_holders',
      'motor_dtl',
    ];

    standardFields.forEach((field) => {
      const value = detail[field];

      if (value !== undefined && value !== null) {
        errors.push(
          `cover_note_dtl.${String(field)} is not allowed at the top level for MOTOR_FLEET`,
        );
      }
    });
  }

  private validateFleetEntrySequence(
    entries: Set<number>,
    expectedSize: number,
    errors: string[],
  ): void {
    for (let expected = 1; expected <= expectedSize; expected += 1) {
      if (!entries.has(expected)) {
        errors.push(
          `cover_note_dtl.fleet_dtls must contain fleet_entry ${expected}`,
        );
      }
    }
  }

  private registerUniqueValue(
    values: Set<string>,
    value: string | null | undefined,
    path: string,
    errors: string[],
  ): void {
    const normalizedValue = value?.trim().toUpperCase();

    if (!normalizedValue) {
      return;
    }

    if (values.has(normalizedValue)) {
      errors.push(`${path} must be unique within the quotation`);
      return;
    }

    values.add(normalizedValue);
  }

  private assertMoneyEqual(
    expected: number,
    actual: number,
    path: string,
    errors: string[],
    explanation: string,
  ): void {
    if (!this.moneyEqual(expected, actual)) {
      errors.push(
        `${path} is invalid. Expected ${this.roundMoney(expected)}, received ${this.roundMoney(actual)}. ${explanation}`,
      );
    }
  }

  private isMissing(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  private moneyEqual(first: number, second: number): boolean {
    return (
      Math.abs(this.roundMoney(first) - this.roundMoney(second)) <=
      this.moneyTolerance
    );
  }

  private numbersEqual(
    first: number,
    second: number,
    tolerance: number,
  ): boolean {
    return Math.abs(first - second) <= tolerance;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
