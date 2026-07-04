import { Injectable } from '@nestjs/common';

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
      TotalPremiumExcludingTax: dto.totalPremiumExcludingTax,
      TotalPremiumIncludingTax: dto.totalPremiumIncludingTax,
      CommisionPaid: dto.commissionPaid || '0.00',
      CommisionRate: dto.commissionRate || '0.00',
      OfficerName: dto.officerName,
      OfficerTitle: dto.officerTitle,
      ProductCode: dto.productCode,
      EndorsementType: dto.endorsementType || '',
      EndorsementReason: dto.endorsementReason || '',
      EndorsementPremiumEarned: dto.endorsementPremiumEarned || '',
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

    return {
      FleetHdr: {
        FleetId: dto.fleet?.fleetId,
        FleetType: dto.fleet?.fleetType || '',
        FleetSize: dto.fleet?.fleetSize,
        ComprehensiveInsured: dto.fleet?.comprehensiveInsured || '',
        SalePointCode: dto.salePointCode,
        CoverNoteStartDate: this.formatDateTime(dto.coverNoteStartDate),
        CoverNoteEndDate: this.formatDateTime(dto.coverNoteEndDate),
        PaymentMode: dto.paymentMode,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        TotalPremiumExcludingTax: dto.totalPremiumExcludingTax,
        TotalPremiumIncludingTax: dto.totalPremiumIncludingTax,
        CommisionPaid: dto.commissionPaid || '0.00',
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

  private mapFleetItem(params: {
    item: CreateMotorFleetItemDto;
    parentDto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields;
    index: number;
  }): Record<string, any> {
    const { item, parentDto, index } = params;

    const itemRisks =
      item.risks && item.risks.length > 0 ? item.risks : parentDto.risks || [];

    const itemSubjectMatters =
      item.subjectMatters && item.subjectMatters.length > 0
        ? item.subjectMatters
        : parentDto.subjectMatters || [];

    const itemAddons =
      item.addons && item.addons.length > 0 ? item.addons : parentDto.addons || [];

    return {
      FleetEntry: item.fleetEntry || String(index + 1),
      CoverNoteNumber: item.coverNoteNumber,
      PrevCoverNoteReferenceNumber: item.prevCoverNoteReferenceNumber || '',
      CoverNoteDesc: item.coverNoteDesc || parentDto.coverNoteDesc,
      OperativeClause: item.operativeClause || parentDto.operativeClause,
      EndorsementType: item.endorsementType || '',
      EndorsementReason: item.endorsementReason || '',
      EndorsementPremiumEarned: item.endorsementPremiumEarned || '',
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
        SumInsured: risk.sumInsured,
        SumInsuredEquivalent: risk.sumInsuredEquivalent,
        PremiumRate: risk.premiumRate,
        PremiumBeforeDiscount: risk.premiumBeforeDiscount,
        PremiumAfterDiscount: risk.premiumAfterDiscount,
        PremiumExcludingTaxEquivalent: risk.premiumExcludingTaxEquivalent,
        PremiumIncludingTax: risk.premiumIncludingTax,
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
        DiscountAmount: discount.discountAmount || '0.00',
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
        AddonAmount: addon.addonAmount,
        AddonPremiumRate: addon.addonPremiumRate,
        PremiumExcludingTax: addon.premiumExcludingTax,
        PremiumExcludingTaxEquivalent: addon.premiumExcludingTaxEquivalent,
        PremiumIncludingTax: addon.premiumIncludingTax,
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
      TaxAmount: tax.taxAmount,
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

    const date = new Date(value);
    return date.toISOString().slice(0, 19);
  }

  private formatDate(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    const date = new Date(value);
    return date.toISOString().slice(0, 10);
  }
}
