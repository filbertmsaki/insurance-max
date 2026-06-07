import { Injectable } from '@nestjs/common';

import type { CreateCoverNoteDto } from '../dto/create-cover-note.dto';
import { TiramisCoverNoteEntity } from '../entities/tiramis-cover-note.entity';
import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';

@Injectable()
export class TiramisCoverNotePayloadService {
  buildFromDto(params: {
    dto: CreateCoverNoteDto & TiramisResolvedRequestDtoFields;
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
      CoverNoteDtl: {
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
        RisksCovered: {
          RiskCovered: dto.risks.map((risk) => ({
            RiskCode: risk.riskCode,
            SumInsured: risk.sumInsured,
            SumInsuredEquivalent: risk.sumInsuredEquivalent,
            PremiumRate: risk.premiumRate,
            PremiumBeforeDiscount: risk.premiumBeforeDiscount,
            PremiumAfterDiscount: risk.premiumAfterDiscount,
            PremiumExcludingTaxEquivalent:
              risk.premiumExcludingTaxEquivalent,
            PremiumIncludingTax: risk.premiumIncludingTax,
            DiscountsOffered: {
              DiscountOffered: (risk.discounts || []).map((discount) => ({
                DiscountType: discount.discountType || '',
                DiscountRate: discount.discountRate || '0.00',
                DiscountAmount: discount.discountAmount || '0.00',
              })),
            },
            TaxesCharged: {
              TaxCharged: (risk.taxes || []).map((tax) =>
                this.mapTaxPayload(tax),
              ),
            },
          })),
        },
        SubjectMattersCovered: {
          SubjectMatter: (dto.subjectMatters || []).map((subject) => ({
            SubjectMatterReference: subject.subjectMatterReference,
            SubjectMatterDesc: subject.subjectMatterDesc,
          })),
        },
        CoverNoteAddons: {
          CoverNoteAddon: (dto.addons || []).map((addon) => ({
            AddonReference: addon.addonReference,
            AddonDesc: addon.addonDesc,
            AddonAmount: addon.addonAmount,
            AddonPremiumRate: addon.addonPremiumRate,
            PremiumExcludingTax: addon.premiumExcludingTax,
            PremiumExcludingTaxEquivalent:
              addon.premiumExcludingTaxEquivalent,
            PremiumIncludingTax: addon.premiumIncludingTax,
            TaxesCharged: {
              TaxCharged: (addon.taxes || []).map((tax) =>
                this.mapTaxPayload(tax),
              ),
            },
          })),
        },
        PolicyHolders: {
          PolicyHolder: dto.policyHolders.map((holder) => ({
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
        },
      },
    };
  }

  buildFromEntity(coverNote: TiramisCoverNoteEntity): Record<string, any> {
    return {
      CoverNoteHdr: {
        RequestId: coverNote.requestId,
        CompanyCode: coverNote.companyCode,
        SystemCode: coverNote.systemCode,
        CallBackUrl: coverNote.callbackUrl,
        InsurerCompanyCode: coverNote.insurerCompanyCode,
        TranCompanyCode: coverNote.tranCompanyCode || '',
        CoverNoteType: coverNote.coverNoteType,
      },
      CoverNoteDtl: {
        CoverNoteNumber: coverNote.coverNoteNumber,
        PrevCoverNoteReferenceNumber:
          coverNote.prevCoverNoteReferenceNumber || '',
        SalePointCode: coverNote.salePointCode,
        CoverNoteStartDate: this.formatDateTime(coverNote.coverNoteStartDate),
        CoverNoteEndDate: this.formatDateTime(coverNote.coverNoteEndDate),
        CoverNoteDesc: coverNote.coverNoteDesc,
        OperativeClause: coverNote.operativeClause,
        PaymentMode: coverNote.paymentMode,
        CurrencyCode: coverNote.currencyCode,
        ExchangeRate: coverNote.exchangeRate,
        TotalPremiumExcludingTax: coverNote.totalPremiumExcludingTax,
        TotalPremiumIncludingTax: coverNote.totalPremiumIncludingTax,
        CommisionPaid: coverNote.commissionPaid || '0.00',
        CommisionRate: coverNote.commissionRate || '0.00',
        OfficerName: coverNote.officerName,
        OfficerTitle: coverNote.officerTitle,
        ProductCode: coverNote.productCode,
        EndorsementType: coverNote.endorsementType || '',
        EndorsementReason: coverNote.endorsementReason || '',
        EndorsementPremiumEarned: coverNote.endorsementPremiumEarned || '',
      },
    };
  }

  private mapTaxPayload(tax: {
    taxCode: string;
    isTaxExempted?: string;
    taxExemptionType?: string | null;
    taxExemptionReference?: string | null;
    taxRate: string;
    taxAmount: string;
  }) {
    return {
      TaxCode: tax.taxCode,
      IsTaxExempted: tax.isTaxExempted || 'N',
      TaxExemptionType: tax.taxExemptionType || '',
      TaxExemptionReference: tax.taxExemptionReference || '',
      TaxRate: tax.taxRate,
      TaxAmount: tax.taxAmount,
    };
  }

  private formatDateTime(value: Date | string): string {
    const date = new Date(value);
    return date.toISOString().slice(0, 19);
  }

  private formatDate(value: Date | string): string {
    const date = new Date(value);
    return date.toISOString().slice(0, 10);
  }
}
