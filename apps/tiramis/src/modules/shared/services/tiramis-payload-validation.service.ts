import { Injectable } from '@nestjs/common';

@Injectable()
export class TiramisPayloadValidationService {
  validateCommonCoverNoteData(dto: any, errors: string[]) {
    this.requireString(dto.insurerCompanyCode, 'insurerCompanyCode', errors);
    this.requireString(dto.tranCompanyCode, 'tranCompanyCode', errors);

    this.requireNumberIn(dto.coverNoteType, 'coverNoteType', [1, 2, 3], errors);
    this.requireString(dto.coverNoteNumber, 'coverNoteNumber', errors);
    this.requireString(dto.salePointCode, 'salePointCode', errors);

    /**
     * TIRA CoverNoteType:
     * 1 = New
     * 2 = Renewal
     * 3 = Endorsement
     *
     * Previous Cover Note Reference is optional for new business,
     * but required for renewal and endorsement.
     */
    if ([2, 3].includes(Number(dto.coverNoteType))) {
      this.requireString(
        dto.prevCoverNoteReferenceNumber,
        'prevCoverNoteReferenceNumber is required for renewal or endorsement',
        errors,
      );
    }

    this.requireDate(dto.coverNoteStartDate, 'coverNoteStartDate', errors);
    this.requireDate(dto.coverNoteEndDate, 'coverNoteEndDate', errors);

    this.validateDateRange(
      dto.coverNoteStartDate,
      dto.coverNoteEndDate,
      errors,
    );

    this.requireString(dto.coverNoteDesc, 'coverNoteDesc', errors);
    this.requireString(dto.operativeClause, 'operativeClause', errors);

    this.requireNumberIn(dto.paymentMode, 'paymentMode', [1, 2, 3], errors);
    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (
      !this.isBlank(dto.currencyCode) &&
      String(dto.currencyCode).trim().length !== 3
    ) {
      errors.push('currencyCode must be a 3-letter currency code, example: TZS');
    }

    this.requirePositiveNumber(dto.exchangeRate, 'exchangeRate', errors);

    this.requirePositiveNumber(
      dto.totalPremiumExcludingTax,
      'totalPremiumExcludingTax',
      errors,
    );

    this.requirePositiveNumber(
      dto.totalPremiumIncludingTax,
      'totalPremiumIncludingTax',
      errors,
    );

    const totalExcludingTax = this.toNumber(dto.totalPremiumExcludingTax);
    const totalIncludingTax = this.toNumber(dto.totalPremiumIncludingTax);

    if (
      totalExcludingTax !== null &&
      totalIncludingTax !== null &&
      totalIncludingTax < totalExcludingTax
    ) {
      errors.push(
        'totalPremiumIncludingTax cannot be less than totalPremiumExcludingTax',
      );
    }

    this.requireString(dto.officerName, 'officerName', errors);
    this.requireString(dto.officerTitle, 'officerTitle', errors);
    this.requireString(dto.productCode, 'productCode', errors);

    if (!this.isBlank(dto.endorsementType) && Number(dto.coverNoteType) !== 3) {
      errors.push(
        'endorsementType should only be provided when coverNoteType is 3',
      );
    }

    if (Number(dto.coverNoteType) === 3) {
      this.requireNumber(dto.endorsementType, 'endorsementType', errors);
      this.requireString(dto.endorsementReason, 'endorsementReason', errors);
    }
  }

  validateRisks(risks: any[], path: string, errors: string[]) {
    if (!risks || risks.length === 0) {
      errors.push(`${path} must contain at least one risk`);
      return;
    }

    risks.forEach((risk, index) => {
      const riskPath = `${path}[${index}]`;

      this.requireString(risk.riskCode, `${riskPath}.riskCode`, errors);

      this.requireNonNegativeNumber(
        risk.sumInsured,
        `${riskPath}.sumInsured`,
        errors,
      );

      this.requireNonNegativeNumber(
        risk.sumInsuredEquivalent,
        `${riskPath}.sumInsuredEquivalent`,
        errors,
      );

      this.requireNonNegativeNumber(
        risk.premiumRate,
        `${riskPath}.premiumRate`,
        errors,
      );

      this.requirePositiveNumber(
        risk.premiumBeforeDiscount,
        `${riskPath}.premiumBeforeDiscount`,
        errors,
      );

      this.requirePositiveNumber(
        risk.premiumAfterDiscount,
        `${riskPath}.premiumAfterDiscount`,
        errors,
      );

      this.requirePositiveNumber(
        risk.premiumExcludingTaxEquivalent,
        `${riskPath}.premiumExcludingTaxEquivalent`,
        errors,
      );

      this.requirePositiveNumber(
        risk.premiumIncludingTax,
        `${riskPath}.premiumIncludingTax`,
        errors,
      );

      const premiumBeforeDiscount = this.toNumber(risk.premiumBeforeDiscount);
      const premiumAfterDiscount = this.toNumber(risk.premiumAfterDiscount);

      if (
        premiumBeforeDiscount !== null &&
        premiumAfterDiscount !== null &&
        premiumAfterDiscount > premiumBeforeDiscount
      ) {
        errors.push(
          `${riskPath}.premiumAfterDiscount cannot be greater than premiumBeforeDiscount`,
        );
      }

      this.validateTaxes(risk.taxes || [], `${riskPath}.taxes`, errors);

      if (risk.discounts && Array.isArray(risk.discounts)) {
        risk.discounts.forEach((discount: any, discountIndex: number) => {
          const discountPath = `${riskPath}.discounts[${discountIndex}]`;

          if (!this.isBlank(discount.discountType)) {
            this.requireNumber(
              discount.discountType,
              `${discountPath}.discountType`,
              errors,
            );
          }

          if (!this.isBlank(discount.discountRate)) {
            this.requireNonNegativeNumber(
              discount.discountRate,
              `${discountPath}.discountRate`,
              errors,
            );
          }

          if (!this.isBlank(discount.discountAmount)) {
            this.requireNonNegativeNumber(
              discount.discountAmount,
              `${discountPath}.discountAmount`,
              errors,
            );
          }
        });
      }
    });
  }

  validateTaxes(taxes: any[], path: string, errors: string[]) {
    if (!taxes || taxes.length === 0) {
      errors.push(`${path} must contain at least one tax entry`);
      return;
    }

    taxes.forEach((tax, index) => {
      const taxPath = `${path}[${index}]`;

      this.requireString(tax.taxCode, `${taxPath}.taxCode`, errors);

      const isTaxExempted = String(tax.isTaxExempted || 'N').toUpperCase();

      if (!['Y', 'N'].includes(isTaxExempted)) {
        errors.push(`${taxPath}.isTaxExempted must be Y or N`);
      }

      if (isTaxExempted === 'Y') {
        this.requireString(
          tax.taxExemptionType,
          `${taxPath}.taxExemptionType`,
          errors,
        );

        this.requireString(
          tax.taxExemptionReference,
          `${taxPath}.taxExemptionReference`,
          errors,
        );
      }

      this.requireNonNegativeNumber(tax.taxRate, `${taxPath}.taxRate`, errors);
      this.requireNonNegativeNumber(tax.taxAmount, `${taxPath}.taxAmount`, errors);
    });
  }

  validateSubjectMatters(
    subjectMatters: any[],
    path: string,
    errors: string[],
  ) {
    if (!subjectMatters || subjectMatters.length === 0) {
      errors.push(`${path} must contain at least one subject matter`);
      return;
    }

    subjectMatters.forEach((subject, index) => {
      const subjectPath = `${path}[${index}]`;

      this.requireString(
        subject.subjectMatterReference,
        `${subjectPath}.subjectMatterReference`,
        errors,
      );

      this.requireString(
        subject.subjectMatterDesc,
        `${subjectPath}.subjectMatterDesc`,
        errors,
      );
    });
  }

  validateAddons(addons: any[], path: string, errors: string[]) {
    if (!addons || addons.length === 0) {
      return;
    }

    addons.forEach((addon, index) => {
      const addonPath = `${path}[${index}]`;

      this.requireString(
        addon.addonReference,
        `${addonPath}.addonReference`,
        errors,
      );

      this.requireString(addon.addonDesc, `${addonPath}.addonDesc`, errors);

      this.requirePositiveNumber(
        addon.addonAmount,
        `${addonPath}.addonAmount`,
        errors,
      );

      this.requirePositiveNumber(
        addon.addonPremiumRate,
        `${addonPath}.addonPremiumRate`,
        errors,
      );

      this.requirePositiveNumber(
        addon.premiumExcludingTax,
        `${addonPath}.premiumExcludingTax`,
        errors,
      );

      this.requirePositiveNumber(
        addon.premiumExcludingTaxEquivalent,
        `${addonPath}.premiumExcludingTaxEquivalent`,
        errors,
      );

      this.requirePositiveNumber(
        addon.premiumIncludingTax,
        `${addonPath}.premiumIncludingTax`,
        errors,
      );

      this.validateTaxes(addon.taxes || [], `${addonPath}.taxes`, errors);
    });
  }

  validatePolicyHolders(policyHolders: any[], errors: string[]) {
    if (!policyHolders || policyHolders.length === 0) {
      errors.push('policyHolders must contain at least one policyholder');
      return;
    }

    policyHolders.forEach((holder, index) => {
      const path = `policyHolders[${index}]`;

      this.requireString(
        holder.policyHolderName,
        `${path}.policyHolderName`,
        errors,
      );

      this.requireDate(
        holder.policyHolderBirthDate,
        `${path}.policyHolderBirthDate`,
        errors,
      );

      this.requireNumber(
        holder.policyHolderType,
        `${path}.policyHolderType`,
        errors,
      );

      this.requireString(
        holder.policyHolderIdNumber,
        `${path}.policyHolderIdNumber`,
        errors,
      );

      this.requireNumber(
        holder.policyHolderIdType,
        `${path}.policyHolderIdType`,
        errors,
      );

      this.requireString(holder.countryCode, `${path}.countryCode`, errors);

      if (
        !this.isBlank(holder.countryCode) &&
        String(holder.countryCode).trim().length !== 3
      ) {
        errors.push(`${path}.countryCode must be ISO alpha-3, example: TZA`);
      }

      this.requireString(holder.region, `${path}.region`, errors);
      this.requireString(holder.district, `${path}.district`, errors);
      this.requireString(holder.phoneNumber, `${path}.phoneNumber`, errors);
    });
  }

  validateDateRange(
    startDate: Date | string,
    endDate: Date | string,
    errors: string[],
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    if (end <= start) {
      errors.push('coverNoteEndDate must be greater than coverNoteStartDate');
    }
  }

  requireString(value: unknown, fieldName: string, errors: string[]) {
    if (this.isBlank(value)) {
      errors.push(`${fieldName} is required`);
    }
  }

  requireDate(value: unknown, fieldName: string, errors: string[]) {
    if (this.isBlank(value)) {
      errors.push(`${fieldName} is required`);
      return;
    }

    const date = new Date(value as any);

    if (Number.isNaN(date.getTime())) {
      errors.push(`${fieldName} must be a valid date`);
    }
  }

  requireNumber(value: unknown, fieldName: string, errors: string[]) {
    if (this.isBlank(value)) {
      errors.push(`${fieldName} is required`);
      return;
    }

    const parsed = this.toNumber(value);

    if (parsed === null) {
      errors.push(`${fieldName} must be a valid number`);
    }
  }

  requireNumberIn(
    value: unknown,
    fieldName: string,
    allowedValues: number[],
    errors: string[],
  ) {
    this.requireNumber(value, fieldName, errors);

    if (this.isBlank(value)) {
      return;
    }

    const parsed = Number(value);

    if (!allowedValues.includes(parsed)) {
      errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
  }

  requirePositiveNumber(value: unknown, fieldName: string, errors: string[]) {
    if (this.isBlank(value)) {
      errors.push(`${fieldName} is required`);
      return;
    }

    const parsed = this.toNumber(value);

    if (parsed === null) {
      errors.push(`${fieldName} must be a valid number`);
      return;
    }

    if (parsed <= 0) {
      errors.push(`${fieldName} must be greater than 0`);
    }
  }

  requireNonNegativeNumber(
    value: unknown,
    fieldName: string,
    errors: string[],
  ) {
    if (this.isBlank(value)) {
      errors.push(`${fieldName} is required`);
      return;
    }

    const parsed = this.toNumber(value);

    if (parsed === null) {
      errors.push(`${fieldName} must be a valid number`);
      return;
    }

    if (parsed < 0) {
      errors.push(`${fieldName} cannot be negative`);
    }
  }

  toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  isBlank(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    );
  }
}
