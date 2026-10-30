import { BadRequestException, Injectable } from '@nestjs/common';
import { toTiraMoney } from '../../shared/utils/tira-money.util';

import type {
  CreateCoverNoteAddonDto,
  CreateCoverNoteDiscountDto,
  CreateCoverNoteRiskDto,
  CreateCoverNoteTaxDto,
  CreatePolicyHolderDto,
  CreateSubjectMatterDto,
} from '../../cover-notes/dto/create-cover-note.dto';
import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';
import type {
  CreateMotorCoverNoteDto,
  CreateMotorDetailDto,
  CreateMotorFleetItemDto,
} from '../dto/create-motor-cover-note.dto';

@Injectable()
export class TiramisMotorPayloadService {
  buildMotorCoverNotePayload(params: {
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const dto = params.dto;

    return {
      CoverNoteHdr: {
        RequestId: params.requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
        TranCompanyCode: dto.tranCompanyCode || '',
        CoverNoteType: dto.coverNoteType,
      },
      CoverNoteDtl: dto.isFleet
        ? this.buildFleetCoverNoteDtl(dto)
        : this.buildNonFleetCoverNoteDtl(dto),
    };
  }

  private buildNonFleetCoverNoteDtl(
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields,
  ): Record<string, any> {
    return {
      CoverNoteNumber: dto.coverNoteNumber,
      PrevCoverNoteReferenceNumber: dto.prevCoverNoteReferenceNumber || '',
      SalePointCode: dto.salePointCode,
      CoverNoteStartDate: this.formatDateTime(dto.coverNoteStartDate),
      CoverNoteEndDate: this.formatDateTime(dto.coverNoteEndDate),
      CoverNoteDesc: dto.coverNoteDesc,
      OperativeClause: dto.operativeClause,
      PaymentMode: dto.paymentMode,
      CurrencyCode: dto.currencyCode,
      ExchangeRate: dto.exchangeRate,
      TotalPremiumExcludingTax: toTiraMoney(dto.totalPremiumExcludingTax),
      TotalPremiumIncludingTax: toTiraMoney(dto.totalPremiumIncludingTax),
      CommisionPaid: toTiraMoney(dto.commissionPaid || 0),
      CommisionRate: dto.commissionRate || '0.00',
      OfficerName: dto.officerName,
      OfficerTitle: dto.officerTitle,
      ProductCode: dto.productCode,
      EndorsementType: dto.endorsementType || '',
      EndorsementReason: dto.endorsementReason || '',
      EndorsementPremiumEarned: toTiraMoney(dto.endorsementPremiumEarned),
      RisksCovered: this.mapRisks(dto.risks || []),
      SubjectMattersCovered: this.mapSubjectMatters(dto.subjectMatters || []),
      CoverNoteAddons: this.mapAddons(dto.addons || []),
      PolicyHolders: this.mapPolicyHolders(dto.policyHolders || []),
      MotorDtl: this.mapMotorDetail(dto.motorDetail!),
    };
  }

  private buildFleetCoverNoteDtl(
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields,
  ): Record<string, any> {
    const items = dto.fleet?.items || [];
    this.assertFleetSubmittable(dto, items);
    const totals = this.fleetPremiumTotals(dto, items);

    return {
      FleetHdr: {
        FleetId: dto.fleet?.fleetId,
        FleetType: dto.fleet?.fleetType || '',
        FleetSize: dto.fleet?.fleetSize,
        // 0 is valid (third-party-only fleet); `||` would blank it.
        ComprehensiveInsured: dto.fleet?.comprehensiveInsured ?? '',
        SalePointCode: dto.salePointCode,
        CoverNoteStartDate: this.formatDateTime(dto.coverNoteStartDate),
        CoverNoteEndDate: this.formatDateTime(dto.coverNoteEndDate),
        PaymentMode: dto.paymentMode,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        TotalPremiumExcludingTax: toTiraMoney(totals.excludingTax),
        TotalPremiumIncludingTax: toTiraMoney(totals.includingTax),
        CommisionPaid: toTiraMoney(dto.commissionPaid || 0),
        CommisionRate: dto.commissionRate || '0.00',
        OfficerName: dto.officerName,
        OfficerTitle: dto.officerTitle,
        ProductCode: dto.productCode,
        PolicyHolders: this.mapPolicyHolders(dto.policyHolders || []),
      },
      FleetDtl: items.map((item, index) =>
        this.mapFleetItem({
          item,
          parentDto: dto,
          index,
        }),
      ),
    };
  }

  /**
   * Reject fleets TIRA would refuse (§6 mandatory fields) before sending,
   * with messages naming the vehicle, instead of a blank element in the XML.
   */
  private assertFleetSubmittable(
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields,
    items: CreateMotorFleetItemDto[],
  ) {
    const issues: string[] = [];
    if (!dto.fleet?.fleetId) issues.push('FleetId is required.');
    if (!dto.fleet?.fleetType) issues.push('FleetType is required.');
    if (items.length === 0) issues.push('A fleet needs at least one vehicle.');

    (dto.policyHolders || []).forEach((holder, index) => {
      const label = `Policyholder ${index + 1}`;
      if (!holder.street?.trim())
        issues.push(`${label}: street is required for motor cover.`);
      if (String(holder.policyHolderType) === '1' && !holder.gender?.trim())
        issues.push(`${label}: gender is required for individuals.`);
    });

    items.forEach((item, index) => {
      const label = `Vehicle ${item.fleetEntry || index + 1}`;
      if (!item.motorDetail?.chassisNumber?.trim())
        issues.push(`${label}: chassis number is required.`);
      // A multi-vehicle fleet must price each vehicle; inheriting the
      // parent's (vehicle 1's) risks would duplicate its premium.
      if (items.length > 1 && !item.risks?.length)
        issues.push(`${label}: no risks covered.`);
    });

    if (Number(this.fleetPremiumTotals(dto, items).excludingTax) <= 0)
      issues.push('Fleet premium is zero; price every vehicle first.');

    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Fleet cover note is incomplete for TIRA submission.',
        errors: issues,
      });
    }
  }

  /**
   * FleetHdr totals as TIRA checks them (TIRA083/TIRA084): the sum of the
   * premiums actually sent in FleetDtl, in the cover-note currency. Stored
   * header totals use TZS equivalents and can drift from the vehicles.
   */
  private fleetPremiumTotals(
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields,
    items: CreateMotorFleetItemDto[],
  ) {
    let excludingCents = 0;
    let includingCents = 0;
    const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

    for (const item of items) {
      const { risks, addons } = this.fleetItemLines(item, dto);
      for (const risk of risks) {
        excludingCents += cents(risk.premiumAfterDiscount);
        includingCents += cents(risk.premiumIncludingTax);
      }
      for (const addon of addons) {
        excludingCents += cents(addon.premiumExcludingTax);
        includingCents += cents(addon.premiumIncludingTax);
      }
    }

    return {
      excludingTax: (excludingCents / 100).toFixed(2),
      includingTax: (includingCents / 100).toFixed(2),
    };
  }

  /** Risks and add-ons sent for one vehicle. */
  private fleetItemLines(
    item: CreateMotorFleetItemDto,
    parentDto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields,
  ) {
    // Only a single-vehicle fleet may fall back to the parent's lines; in a
    // larger fleet the parent mirrors vehicle 1 and would be duplicated.
    const inherit = (parentDto.fleet?.items?.length ?? 0) <= 1;
    const risks =
      item.risks && item.risks.length > 0
        ? item.risks
        : inherit
          ? parentDto.risks || []
          : [];
    const addons =
      item.addons && item.addons.length > 0
        ? item.addons
        : inherit
          ? parentDto.addons || []
          : [];
    return { risks, addons, inherit };
  }

  private mapFleetItem(params: {
    item: CreateMotorFleetItemDto;
    parentDto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields;
    index: number;
  }): Record<string, any> {
    const { item, parentDto, index } = params;
    const {
      risks: itemRisks,
      addons: itemAddons,
      inherit,
    } = this.fleetItemLines(item, parentDto);

    const motor = item.motorDetail;
    const itemSubjectMatters =
      item.subjectMatters && item.subjectMatters.length > 0
        ? item.subjectMatters
        : inherit && parentDto.subjectMatters?.length
          ? parentDto.subjectMatters
          : [
              {
                subjectMatterReference:
                  motor?.registrationNumber || motor?.chassisNumber || '',
                subjectMatterDesc:
                  [motor?.make, motor?.model].filter(Boolean).join(' ') ||
                  'Motor vehicle',
              },
            ];

    return {
      FleetEntry: item.fleetEntry || String(index + 1),
      CoverNoteNumber: item.coverNoteNumber,
      PrevCoverNoteReferenceNumber: item.prevCoverNoteReferenceNumber || '',
      CoverNoteDesc: item.coverNoteDesc || parentDto.coverNoteDesc,
      OperativeClause: item.operativeClause || parentDto.operativeClause,
      EndorsementType: item.endorsementType || '',
      EndorsementReason: item.endorsementReason || '',
      EndorsementPremiumEarned: toTiraMoney(item.endorsementPremiumEarned),
      RisksCovered: this.mapRisks(itemRisks),
      SubjectMattersCovered: this.mapSubjectMatters(itemSubjectMatters),
      CoverNoteAddons: this.mapAddons(itemAddons),
      MotorDtl: this.mapMotorDetail(item.motorDetail),
    };
  }

  private mapRisks(risks: CreateCoverNoteRiskDto[]): Record<string, any> {
    return {
      RiskCovered: risks.map((risk) => ({
        RiskCode: risk.riskCode,
        SumInsured: toTiraMoney(risk.sumInsured),
        SumInsuredEquivalent: toTiraMoney(risk.sumInsuredEquivalent),
        PremiumRate: risk.premiumRate,
        PremiumBeforeDiscount: toTiraMoney(risk.premiumBeforeDiscount),
        PremiumAfterDiscount: toTiraMoney(risk.premiumAfterDiscount),
        PremiumExcludingTaxEquivalent: toTiraMoney(
          risk.premiumExcludingTaxEquivalent,
        ),
        PremiumIncludingTax: toTiraMoney(risk.premiumIncludingTax),
        DiscountsOffered: this.mapDiscounts(risk.discounts || []),
        TaxesCharged: this.mapTaxes(risk.taxes || []),
      })),
    };
  }

  private mapDiscounts(
    discounts: CreateCoverNoteDiscountDto[],
  ): Record<string, any> {
    return {
      DiscountOffered: discounts.map((discount) => ({
        DiscountType: discount.discountType || '',
        DiscountRate: discount.discountRate || '0.00',
        DiscountAmount: toTiraMoney(discount.discountAmount || 0),
      })),
    };
  }

  private mapTaxes(taxes: CreateCoverNoteTaxDto[]): Record<string, any> {
    return {
      TaxCharged: taxes.map((tax) => this.mapTaxPayload(tax)),
    };
  }

  private mapSubjectMatters(
    subjectMatters: CreateSubjectMatterDto[],
  ): Record<string, any> {
    return {
      SubjectMatter: subjectMatters.map((subject) => ({
        SubjectMatterReference: subject.subjectMatterReference,
        SubjectMatterDesc: subject.subjectMatterDesc,
      })),
    };
  }

  private mapAddons(addons: CreateCoverNoteAddonDto[]): Record<string, any> {
    return {
      CoverNoteAddon: addons.map((addon) => ({
        AddonReference: addon.addonReference,
        AddonDesc: addon.addonDesc,
        AddonAmount: toTiraMoney(addon.addonAmount),
        AddonPremiumRate: addon.addonPremiumRate,
        PremiumExcludingTax: toTiraMoney(addon.premiumExcludingTax),
        PremiumExcludingTaxEquivalent: toTiraMoney(
          addon.premiumExcludingTaxEquivalent,
        ),
        PremiumIncludingTax: toTiraMoney(addon.premiumIncludingTax),
        TaxesCharged: this.mapTaxes(addon.taxes || []),
      })),
    };
  }

  private mapPolicyHolders(
    policyHolders: CreatePolicyHolderDto[],
  ): Record<string, any> {
    return {
      PolicyHolder: policyHolders.map((holder) => ({
        PolicyHolderName: holder.policyHolderName,
        PolicyHolderBirthDate: holder.policyHolderBirthDate
          ? this.formatDate(holder.policyHolderBirthDate)
          : '',
        PolicyHolderType: holder.policyHolderType,
        PolicyHolderIdNumber: holder.policyHolderIdNumber,
        PolicyHolderIdType: holder.policyHolderIdType,
        Gender: holder.gender || '',
        CountryCode: holder.countryCode,
        Region: holder.region,
        District: holder.district,
        Street: holder.street || '',
        PolicyHolderPhoneNumber: holder.phoneNumber,
        PolicyHolderFax: holder.fax || '',
        PostalAddress: holder.postalAddress || '',
        EmailAddress: holder.emailAddress || '',
      })),
    };
  }

  private mapTaxPayload(tax: CreateCoverNoteTaxDto): Record<string, any> {
    return {
      TaxCode: tax.taxCode,
      IsTaxExempted: tax.isTaxExempted || 'N',
      TaxExemptionType: tax.taxExemptionType || '',
      TaxExemptionReference: tax.taxExemptionReference || '',
      TaxRate: tax.taxRate,
      TaxAmount: toTiraMoney(tax.taxAmount),
    };
  }

  private mapMotorDetail(motor: CreateMotorDetailDto): Record<string, any> {
    return {
      MotorCategory: motor.motorCategory || '',
      MotorType: motor.motorType || '',
      RegistrationNumber: motor.registrationNumber || '',
      ChassisNumber: motor.chassisNumber,
      Make: motor.make || '',
      Model: motor.model || '',
      ModelNumber: motor.modelNumber || '',
      BodyType: motor.bodyType || '',
      Color: motor.color || '',
      EngineNumber: motor.engineNumber || '',
      EngineCapacity: motor.engineCapacity || '',
      FuelUsed: motor.fuelUsed || '',
      NumberOfAxles: motor.numberOfAxles || '',
      AxleDistance: motor.axleDistance || '',
      SittingCapacity: motor.sittingCapacity || '',
      YearOfManufacture: motor.yearOfManufacture || '',
      TareWeight: motor.tareWeight || '',
      GrossWeight: motor.grossWeight || '',
      MotorUsage: motor.motorUsage || '',
      OwnerName: motor.ownerName || '',
      OwnerCategory: motor.ownerCategory || '',
      OwnerAddress: motor.ownerAddress || '',
    };
  }

  /**
   * TIRA examples use local datetime format:
   * YYYY-MM-DDTHH:mm:ss
   *
   * If the incoming value is already formatted like that,
   * keep it as-is to avoid timezone shifting.
   */
  private formatDateTime(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 19);
      }
    }

    return this.toTanzaniaIso(value).slice(0, 19);
  }

  /**
   * TIRA dates are Tanzania local time (EAT, UTC+3, no DST). `toISOString`
   * alone is UTC and would turn 23:59:59 into 20:59:59.
   */
  private toTanzaniaIso(value: Date | string): string {
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    return new Date(new Date(value).getTime() + EAT_OFFSET_MS).toISOString();
  }

  private formatDate(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    return this.toTanzaniaIso(value).slice(0, 10);
  }
}
