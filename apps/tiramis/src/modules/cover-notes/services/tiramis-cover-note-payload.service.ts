import { Injectable } from '@nestjs/common';
import { toTiraMoney } from '../../shared/utils/tira-money.util';

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
        RisksCovered: {
          RiskCovered: dto.risks.map((risk) => ({
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
            DiscountsOffered: {
              DiscountOffered: (risk.discounts || []).map((discount) => ({
                DiscountType: discount.discountType || '',
                DiscountRate: discount.discountRate || '0.00',
                DiscountAmount: toTiraMoney(discount.discountAmount || 0),
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
            AddonAmount: toTiraMoney(addon.addonAmount),
            AddonPremiumRate: addon.addonPremiumRate,
            PremiumExcludingTax: toTiraMoney(addon.premiumExcludingTax),
            PremiumExcludingTaxEquivalent: toTiraMoney(
              addon.premiumExcludingTaxEquivalent,
            ),
            PremiumIncludingTax: toTiraMoney(addon.premiumIncludingTax),
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
        TotalPremiumExcludingTax: toTiraMoney(
          coverNote.totalPremiumExcludingTax,
        ),
        TotalPremiumIncludingTax: toTiraMoney(
          coverNote.totalPremiumIncludingTax,
        ),
        CommisionPaid: toTiraMoney(coverNote.commissionPaid || 0),
        CommisionRate: coverNote.commissionRate || '0.00',
        OfficerName: coverNote.officerName,
        OfficerTitle: coverNote.officerTitle,
        ProductCode: coverNote.productCode,
        EndorsementType: coverNote.endorsementType || '',
        EndorsementReason: coverNote.endorsementReason || '',
        EndorsementPremiumEarned: toTiraMoney(
          coverNote.endorsementPremiumEarned,
        ),
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
      TaxAmount: toTiraMoney(tax.taxAmount),
    };
  }

  /**
   * TIRA examples use local datetime format:
   * YYYY-MM-DDTHH:mm:ss
   *
   * Do not convert submitted local Tanzania time to UTC.
   * If the incoming value is already in TIRA format, keep it as-is.
   */
  private formatDateTime(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      /**
       * Already formatted like:
       * 2026-07-04T10:00:00
       * 2026-07-04T10:00:00+03:00
       * 2026-07-04T10:00:00.000+03:00
       *
       * Keep only YYYY-MM-DDTHH:mm:ss.
       */
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 19);
      }

      /**
       * If user submits only date:
       * 2026-07-04
       *
       * Convert it to start of day.
       */
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T00:00:00`;
      }
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    /**
     * Fallback for Date objects.
     * This still uses ISO because Date object has no original local timezone string.
     * Prefer sending string values from portal:
     * YYYY-MM-DDTHH:mm:ss
     */
    return date.toISOString().slice(0, 19);
  }

  /**
   * TIRA policyholder birth date uses:
   * YYYY-MM-DD
   *
   * Keep submitted date as-is when already formatted.
   */
  private formatDate(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }
}
