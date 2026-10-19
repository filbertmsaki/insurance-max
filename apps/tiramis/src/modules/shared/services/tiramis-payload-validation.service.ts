import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

import { RequestContextService } from '@insurance-max/shared-kernel';

@Injectable()
export class TiramisPayloadValidationService {
  constructor(private readonly requestContextService: RequestContextService) {}

  validateCommonCoverNoteData(dto: any, errors: string[]) {
    this.requireString(dto.insurerCompanyCode, 'insurerCompanyCode', errors);
    this.requireString(dto.tranCompanyCode, 'tranCompanyCode', errors);

    this.requireNumberIn(dto.coverNoteType, 'coverNoteType', [1, 2, 3], errors);
    this.requireString(dto.coverNoteNumber, 'coverNoteNumber', errors);
    this.requireString(dto.salePointCode, 'salePointCode', errors);

    /**
     * TIRA CoverNoteType:
     * 1 = New
     * 2 = Renew
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
      errors.push(
        'currencyCode must be a 3-letter currency code, example: TZS',
      );
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
      this.requireNonNegativeNumber(
        tax.taxAmount,
        `${taxPath}.taxAmount`,
        errors,
      );
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

      const holderType = Number(holder.policyHolderType);
      if (holderType === 1 && this.isBlank(holder.gender)) {
        errors.push(
          `${path}.gender is required for an individual policyholder`,
        );
      }
      if (
        !this.isBlank(holder.gender) &&
        !['M', 'F'].includes(String(holder.gender).trim())
      ) {
        errors.push(`${path}.gender must be M or F`);
      }

      for (const [field, value, max] of [
        ['street', holder.street, 100],
        ['fax', holder.fax, 30],
        ['postalAddress', holder.postalAddress, 250],
        ['emailAddress', holder.emailAddress, 150],
      ] as const) {
        if (this.isBlank(value)) continue;
        if (String(value).length > max)
          errors.push(`${path}.${field} must be at most ${max} characters`);
      }
      if (
        !this.isBlank(holder.emailAddress) &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(holder.emailAddress).trim())
      ) {
        errors.push(`${path}.emailAddress must be a valid email address`);
      }

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

  /**
   * Verifies that the premium figures on the incoming risk that matches the
   * signed Portal pricing context are exactly what Portal already
   * calculated and signed. TIRAMIS never re-derives premium — it only
   * verifies what was signed by the pricing authority.
   *
   * This is a no-op when no pricing context is present on the current
   * request (e.g. the draft and preview-xml endpoints, which are not
   * gated by TiramisPricingContextGuard and may legitimately be called
   * before a pricing quote exists).
   */
  validateSignedPricingMatch(
    risks: Array<{
      riskCode?: string | null;
      premiumBeforeDiscount?: string | number | null;
      premiumExcludingTaxEquivalent?: string | number | null;
      premiumIncludingTax?: string | number | null;
      discounts?: Array<{ discountAmount?: string | number | null }> | null;
      taxes?: Array<{ taxAmount?: string | number | null }> | null;
    }>,
  ): void {
    const pricing = this.requestContextService.getServicePrincipal()?.pricing;

    if (!pricing) {
      return;
    }

    const matchedRisk =
      risks.find((risk) => risk.riskCode === pricing.riskCode) ||
      (risks.length === 1 ? risks[0] : undefined);

    if (!matchedRisk) {
      throw new BadRequestException({
        code: 'SIGNED_PRICING_VALUE_MISMATCH',
        message: 'riskCode does not match the signed Portal pricing result.',
      });
    }

    const totalDiscountAmount = (matchedRisk.discounts || []).reduce(
      (sum, discount) => sum.plus(new Decimal(discount.discountAmount ?? 0)),
      new Decimal(0),
    );

    const totalTaxAmount = (matchedRisk.taxes || []).reduce(
      (sum, tax) => sum.plus(new Decimal(tax.taxAmount ?? 0)),
      new Decimal(0),
    );

    this.assertMoneyMatches(
      matchedRisk.premiumBeforeDiscount,
      pricing.basicPremium,
      'basicPremium',
    );
    this.assertMoneyMatches(
      totalDiscountAmount,
      pricing.discountAmount,
      'discountAmount',
    );
    this.assertMoneyMatches(totalTaxAmount, pricing.taxAmount, 'taxAmount');
    this.assertMoneyMatches(
      matchedRisk.premiumExcludingTaxEquivalent,
      pricing.premiumExcludingTax,
      'premiumExcludingTaxEquivalent',
    );
    this.assertMoneyMatches(
      matchedRisk.premiumIncludingTax,
      pricing.premiumIncludingTax,
      'premiumIncludingTax',
    );
  }

  private assertMoneyMatches(
    incoming: string | number | Decimal | null | undefined,
    signed: string,
    field: string,
  ) {
    const incomingValue = new Decimal(incoming ?? 0).toDecimalPlaces(4);
    const signedValue = new Decimal(signed).toDecimalPlaces(4);

    if (!incomingValue.equals(signedValue)) {
      throw new BadRequestException({
        code: 'SIGNED_PRICING_VALUE_MISMATCH',
        message: `${field} does not match the signed Portal pricing result.`,
      });
    }
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
