import { Injectable } from '@nestjs/common';

import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';
import type { CreateDischargeVoucherDto } from '../dto/create-discharge-voucher.dto';
import { TiramisDischargeVoucherEntity } from '../entities/tiramis-discharge-voucher.entity';

@Injectable()
export class TiramisDischargeVoucherPayloadService {
  buildDischargeVoucherPayload(params: {
    dto: CreateDischargeVoucherDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      DischargeVoucherHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      DischargeVoucherDtl: {
        DischargeVoucherNumber: dto.dischargeVoucherNumber,
        ClaimAssessmentNumber: dto.claimAssessmentNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        DischargeVoucherDate: this.formatDateTime(dto.dischargeVoucherDate),
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        ClaimOfferCommunicationDate: this.formatOptionalDateTime(
          dto.claimOfferCommunicationDate,
        ),
        ClaimOfferAmount: dto.claimOfferAmount,
        ClaimantResponseDate: this.formatOptionalDateTime(
          dto.claimantResponseDate,
        ),
        AdjustmentDate: this.formatOptionalDateTime(dto.adjustmentDate),
        AdjustmentReason: dto.adjustmentReason,
        AdjustmentAmount: dto.adjustmentAmount,
        ReconciliationDate: this.formatOptionalDateTime(dto.reconciliationDate),
        ReconciliationSummary: dto.reconciliationSummary,
        ReconciledAmount: dto.reconciledAmount,
        OfferAccepted: dto.offerAccepted,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) => ({
            ClaimantName: claimant.claimantName,
            ClaimantBirthDate: claimant.claimantBirthDate
              ? this.formatDate(claimant.claimantBirthDate)
              : '',
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
            Gender: claimant.gender || '',
            CountryCode: claimant.countryCode,
            Region: claimant.region || '',
            District: claimant.district,
            Street: claimant.street || '',
            ClaimantPhoneNumber: claimant.claimantPhoneNumber,
            ClaimantFax: claimant.claimantFax || '',
            PostalAddress: claimant.postalAddress || '',
            EmailAddress: claimant.emailAddress || '',
          })),
        },
      },
    };
  }

  buildDischargeVoucherPayloadFromEntity(
    claim: TiramisDischargeVoucherEntity,
  ): Record<string, any> {
    return {
      DischargeVoucherHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
      },
      DischargeVoucherDtl: {
        DischargeVoucherNumber: claim.dischargeVoucherNumber,
        ClaimAssessmentNumber: claim.claimAssessmentNumber,
        ClaimReferenceNumber: claim.claimReferenceNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        DischargeVoucherDate: claim.dischargeVoucherDate
          ? this.formatDateTime(claim.dischargeVoucherDate)
          : '',
        CurrencyCode: claim.currencyCode,
        ExchangeRate: claim.exchangeRate,
        ClaimOfferCommunicationDate: this.formatOptionalDateTime(
          claim.claimOfferCommunicationDate,
        ),
        ClaimOfferAmount: claim.claimOfferAmount,
        ClaimantResponseDate: this.formatOptionalDateTime(
          claim.claimantResponseDate,
        ),
        AdjustmentDate: this.formatOptionalDateTime(claim.adjustmentDate),
        AdjustmentReason: claim.adjustmentReason,
        AdjustmentAmount: claim.adjustmentAmount,
        ReconciliationDate: this.formatOptionalDateTime(
          claim.reconciliationDate,
        ),
        ReconciliationSummary: claim.reconciliationSummary,
        ReconciledAmount: claim.reconciledAmount,
        OfferAccepted: claim.offerAccepted,
        Claimants: {
          Claimant: (claim.claimants || []).map((claimant: any) => ({
            ClaimantName: claimant.claimantName,
            ClaimantBirthDate: claimant.claimantBirthDate
              ? this.formatDate(claimant.claimantBirthDate)
              : '',
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
            Gender: claimant.gender || '',
            CountryCode: claimant.countryCode,
            Region: claimant.region || '',
            District: claimant.district,
            Street: claimant.street || '',
            ClaimantPhoneNumber: claimant.claimantPhoneNumber,
            ClaimantFax: claimant.claimantFax || '',
            PostalAddress: claimant.postalAddress || '',
            EmailAddress: claimant.emailAddress || '',
          })),
        },
      },
    };
  }

  private formatOptionalDateTime(value?: Date | string | null): string {
    if (!value) {
      return '';
    }

    return this.formatDateTime(value);
  }

  private formatDateTime(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 19);
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T00:00:00`;
      }
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 19);
  }

  private formatDate(value: Date | string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
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
