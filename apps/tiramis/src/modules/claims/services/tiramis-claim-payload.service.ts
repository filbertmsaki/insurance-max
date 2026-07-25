import { Injectable } from '@nestjs/common';

import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';
import type { CreateClaimAssessmentDto } from '../dto/create-claim-assessment.dto';
import type { CreateClaimPaymentDto } from '../dto/create-claim-payment.dto';
import type { CreateClaimRejectionDto } from '../dto/create-claim-rejection.dto';
import type { CreateClaimIntimationDto } from '../dto/create-claim-intimation.dto';
import { TiramisClaimEntity } from '../entities/tiramis-claim.entity';
import type { CreateClaimNotificationDto } from '../dto/create-claim-notification.dto';

@Injectable()
export class TiramisClaimPayloadService {
  buildClaimNotificationPayload(params: {
    dto: CreateClaimNotificationDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ClaimNotificationHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
        TranCompanyCode: dto.tranCompanyCode,
      },
      ClaimNotificationDtl: {
        ClaimNotificationNumber: dto.claimNotificationNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        ClaimReportDate: this.formatDateTime(dto.claimReportDate),
        ClaimFormDullyFilled: dto.claimFormDullyFilled,
        LossDate: this.formatDateTime(dto.lossDate),
        LossNature: dto.lossNature,
        LossType: dto.lossType,
        LossLocation: dto.lossLocation,
        OfficerName: dto.officerName,
        OfficerTitle: dto.officerTitle,
      },
    };
  }

  buildClaimNotificationPayloadFromEntity(
    claim: TiramisClaimEntity,
  ): Record<string, any> {
    return {
      ClaimNotificationHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
        TranCompanyCode: claim.tranCompanyCode,
      },
      ClaimNotificationDtl: {
        ClaimNotificationNumber: claim.claimNotificationNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        ClaimReportDate: claim.claimReportDate
          ? this.formatDateTime(claim.claimReportDate)
          : '',
        ClaimFormDullyFilled: claim.claimFormDullyFilled,
        LossDate: claim.lossDate ? this.formatDateTime(claim.lossDate) : '',
        LossNature: claim.lossNature,
        LossType: claim.lossType,
        LossLocation: claim.lossLocation,
        OfficerName: claim.officerName,
        OfficerTitle: claim.officerTitle,
      },
    };
  }

  buildClaimIntimationPayload(params: {
    dto: CreateClaimIntimationDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ClaimIntimationHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      ClaimIntimationDtl: {
        ClaimIntimationNumber: dto.claimIntimationNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        ClaimIntimationDate: this.formatDateTime(dto.claimIntimationDate),
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        ClaimEstimatedAmount: dto.claimEstimatedAmount,
        ClaimReserveAmount: dto.claimReserveAmount,
        ClaimReserveMethod: dto.claimReserveMethod,
        LossAssessmentOption: dto.lossAssessmentOption,
        AssessorName: dto.assessorName,
        AssessorIdNumber: dto.assessorIdNumber,
        AssessorIdType: dto.assessorIdType,
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

  buildClaimIntimationPayloadFromEntity(
    claim: TiramisClaimEntity,
  ): Record<string, any> {
    return {
      ClaimIntimationHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
      },
      ClaimIntimationDtl: {
        ClaimIntimationNumber: claim.claimIntimationNumber,
        ClaimReferenceNumber: claim.claimReferenceNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        ClaimIntimationDate: claim.claimIntimationDate
          ? this.formatDateTime(claim.claimIntimationDate)
          : '',
        CurrencyCode: claim.currencyCode,
        ExchangeRate: claim.exchangeRate,
        ClaimEstimatedAmount: claim.claimEstimatedAmount,
        ClaimReserveAmount: claim.claimReserveAmount,
        ClaimReserveMethod: claim.claimReserveMethod,
        LossAssessmentOption: claim.lossAssessmentOption,
        AssessorName: claim.assessorName,
        AssessorIdNumber: claim.assessorIdNumber,
        AssessorIdType: claim.assessorIdType,
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

  buildClaimAssessmentPayload(params: {
    dto: CreateClaimAssessmentDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ClaimAssessmentHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      ClaimAssessmentDtl: {
        ClaimAssessmentNumber: dto.claimAssessmentNumber,
        ClaimIntimationNumber: dto.claimIntimationNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        AssessmentReceivedDate: this.formatDateTime(dto.assessmentReceivedDate),
        AssessmentReportSummary: dto.assessmentReportSummary,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        AssessmentAmount: dto.assessmentAmount,
        ApprovedClaimAmount: dto.approvedClaimAmount,
        ClaimApprovalDate: this.formatDateTime(dto.claimApprovalDate),
        ClaimApprovalAuthority: dto.claimApprovalAuthority,
        IsReAssessment: dto.isReAssessment,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
  }

  buildClaimAssessmentPayloadFromEntity(
    claim: TiramisClaimEntity,
  ): Record<string, any> {
    return {
      ClaimAssessmentHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
      },
      ClaimAssessmentDtl: {
        ClaimAssessmentNumber: claim.claimAssessmentNumber,
        ClaimIntimationNumber: claim.claimIntimationNumber,
        ClaimReferenceNumber: claim.claimReferenceNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        AssessmentReceivedDate: claim.assessmentReceivedDate
          ? this.formatDateTime(claim.assessmentReceivedDate)
          : '',
        AssessmentReportSummary: claim.assessmentReportSummary,
        CurrencyCode: claim.currencyCode,
        ExchangeRate: claim.exchangeRate,
        AssessmentAmount: claim.assessmentAmount,
        ApprovedClaimAmount: claim.approvedClaimAmount,
        ClaimApprovalDate: claim.claimApprovalDate
          ? this.formatDateTime(claim.claimApprovalDate)
          : '',
        ClaimApprovalAuthority: claim.claimApprovalAuthority,
        IsReAssessment: claim.isReAssessment,
        Claimants: {
          Claimant: (claim.claimants || []).map((claimant: any) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
  }

  buildClaimPaymentPayload(params: {
    dto: CreateClaimPaymentDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ClaimPaymentHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      ClaimPaymentDtl: {
        ClaimPaymentNumber: dto.claimPaymentNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        ClaimIntimationNumber: dto.claimIntimationNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        PaymentDate: this.formatDateTime(dto.paymentDate),
        PaidAmount: dto.paidAmount,
        PaymentMode: dto.paymentMode,
        PartiesNotified: dto.partiesNotified,
        NetPremiumEarned: dto.netPremiumEarned,
        ClaimResultedLitigation: dto.claimResultedLitigation,
        LitigationReason: dto.litigationReason,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
  }

  buildClaimPaymentPayloadFromEntity(
    claim: TiramisClaimEntity,
  ): Record<string, any> {
    return {
      ClaimPaymentHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
      },
      ClaimPaymentDtl: {
        ClaimPaymentNumber: claim.claimPaymentNumber,
        ClaimReferenceNumber: claim.claimReferenceNumber,
        ClaimIntimationNumber: claim.claimIntimationNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        PaymentDate: claim.paymentDate
          ? this.formatDateTime(claim.paymentDate)
          : '',
        PaidAmount: claim.paidAmount,
        PaymentMode: claim.paymentMode,
        PartiesNotified: claim.partiesNotified,
        NetPremiumEarned: claim.netPremiumEarned,
        ClaimResultedLitigation: claim.claimResultedLitigation,
        LitigationReason: claim.litigationReason,
        CurrencyCode: claim.currencyCode,
        ExchangeRate: claim.exchangeRate,
        Claimants: {
          Claimant: (claim.claimants || []).map((claimant: any) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
  }

  buildClaimRejectionPayload(params: {
    dto: CreateClaimRejectionDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const { dto, requestId } = params;

    return {
      ClaimRejectionHdr: {
        RequestId: requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
      },
      ClaimRejectionDtl: {
        ClaimRejectionNumber: dto.claimRejectionNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        ClaimIntimationNumber: dto.claimIntimationNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        RejectionDate: this.formatDateTime(dto.rejectionDate),
        RejectionReason: dto.rejectionReason,
        ClaimResultedLitigation: dto.claimResultedLitigation,
        ClaimAmount: dto.claimAmount,
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
  }

  buildClaimRejectionPayloadFromEntity(
    claim: TiramisClaimEntity,
  ): Record<string, any> {
    return {
      ClaimRejectionHdr: {
        RequestId: claim.requestId,
        CompanyCode: claim.companyCode,
        SystemCode: claim.systemCode,
        CallBackUrl: claim.callbackUrl,
        InsurerCompanyCode: claim.insurerCompanyCode,
      },
      ClaimRejectionDtl: {
        ClaimRejectionNumber: claim.claimRejectionNumber,
        ClaimReferenceNumber: claim.claimReferenceNumber,
        ClaimIntimationNumber: claim.claimIntimationNumber,
        CoverNoteReferenceNumber: claim.coverNoteReferenceNumber,
        RejectionDate: claim.rejectionDate
          ? this.formatDateTime(claim.rejectionDate)
          : '',
        RejectionReason: claim.rejectionReason,
        ClaimResultedLitigation: claim.claimResultedLitigation,
        ClaimAmount: claim.claimAmount,
        CurrencyCode: claim.currencyCode,
        ExchangeRate: claim.exchangeRate,
        Claimants: {
          Claimant: (claim.claimants || []).map((claimant: any) => ({
            ClaimantCategory: claimant.claimantCategory ?? '',
            ClaimantType: claimant.claimantType ?? '',
            ClaimantIdNumber: claimant.claimantIdNumber || '',
            ClaimantIdType: claimant.claimantIdType ?? '',
          })),
        },
      },
    };
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
