import { Injectable } from '@nestjs/common';
import {
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimNotificationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateClaimantDto,
  CreateDischargeVoucherDto,
} from '../dto/create-claim.dto';

@Injectable()
export class TiramisClaimPayloadService {
  buildClaimNotification(dto: CreateClaimNotificationDto, requestId: string) {
    return {
      ClaimNotificationHdr: this.buildHeader(dto, requestId, {
        TranCompanyCode: dto.tranCompanyCode || '',
      }),
      ClaimNotificationDtl: {
        ClaimNotificationNumber: dto.claimNotificationNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        ClaimReportDate: this.formatDateTime(dto.claimReportDate),
        ClaimFormDullyFilled: dto.claimFormDullyFilled || '',
        LossDate: this.formatDateTime(dto.lossDate),
        LossNature: dto.lossNature || '',
        LossType: dto.lossType || '',
        LossLocation: dto.lossLocation || '',
        OfficerName: dto.officerName,
        OfficerTitle: dto.officerTitle,
      },
    };
  }

  buildClaimIntimation(dto: CreateClaimIntimationDto, requestId: string) {
    return {
      ClaimIntimationHdr: this.buildHeader(dto, requestId),
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
        AssessorName: dto.assessorName || '',
        AssessorIdNumber: dto.assessorIdNumber || '',
        AssessorIdType: dto.assessorIdType || '',
        Claimants: {
          Claimant: dto.claimants.map((claimant) => this.mapClaimant(claimant)),
        },
      },
    };
  }

  buildClaimAssessment(dto: CreateClaimAssessmentDto, requestId: string) {
    return {
      ClaimAssessmentHdr: this.buildHeader(dto, requestId),
      ClaimAssessmentDtl: {
        ClaimAssessmentNumber: dto.claimAssessmentNumber,
        ClaimIntimationNumber: dto.claimIntimationNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        AssessmentReceivedDate: this.formatDateTime(dto.assessmentReceivedDate),
        AssessmentReportSummary: dto.assessmentReportSummary || '',
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        AssessmentAmount: dto.assessmentAmount,
        ApprovedClaimAmount: dto.approvedClaimAmount,
        ClaimApprovalDate: dto.claimApprovalDate
          ? this.formatDateTime(dto.claimApprovalDate)
          : '',
        ClaimApprovalAuthority: dto.claimApprovalAuthority || '',
        IsReAssessment: dto.isReAssessment || '',
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) =>
            this.mapClaimant(claimant),
          ),
        },
      },
    };
  }

  buildDischargeVoucher(dto: CreateDischargeVoucherDto, requestId: string) {
    return {
      DischargeVoucherHdr: this.buildHeader(dto, requestId),
      DischargeVoucherDtl: {
        DischargeVoucherNumber: dto.dischargeVoucherNumber,
        ClaimAssessmentNumber: dto.claimAssessmentNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        DischargeVoucherDate: this.formatDateTime(dto.dischargeVoucherDate),
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        ClaimOfferCommunicationDate: dto.claimOfferCommunicationDate
          ? this.formatDateTime(dto.claimOfferCommunicationDate)
          : '',
        ClaimOfferAmount: dto.claimOfferAmount,
        ClaimantResponseDate: dto.claimantResponseDate
          ? this.formatDateTime(dto.claimantResponseDate)
          : '',
        AdjustmentDate: dto.adjustmentDate
          ? this.formatDateTime(dto.adjustmentDate)
          : '',
        AdjustmentReason: dto.adjustmentReason || '',
        AdjustmentAmount: dto.adjustmentAmount || '',
        ReconciliationDate: dto.reconciliationDate
          ? this.formatDateTime(dto.reconciliationDate)
          : '',
        ReconciliationSummary: dto.reconciliationSummary || '',
        ReconciledAmount: dto.reconciledAmount || '',
        OfferAccepted: dto.offerAccepted || '',
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) =>
            this.mapClaimant(claimant),
          ),
        },
      },
    };
  }

  buildClaimPayment(dto: CreateClaimPaymentDto, requestId: string) {
    return {
      ClaimPaymentHdr: this.buildHeader(dto, requestId),
      ClaimPaymentDtl: {
        ClaimPaymentNumber: dto.claimPaymentNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        ClaimIntimationNumber: dto.claimIntimationNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        PaymentDate: this.formatDateTime(dto.paymentDate),
        PaidAmount: dto.paidAmount,
        PaymentMode: dto.paymentMode,
        PartiesNotified: dto.partiesNotified || '',
        NetPremiumEarned: dto.netPremiumEarned || '',
        ClaimResultedLitigation: dto.claimResultedLitigation || '',
        LitigationReason: dto.litigationReason || '',
        CurrencyCode: dto.currencyCode,
        ExchangeRate: dto.exchangeRate,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) =>
            this.mapClaimant(claimant),
          ),
        },
      },
    };
  }

  buildClaimRejection(dto: CreateClaimRejectionDto, requestId: string) {
    return {
      ClaimRejectionHdr: this.buildHeader(dto, requestId),
      ClaimRejectionDtl: {
        ClaimRejectionNumber: dto.claimRejectionNumber,
        ClaimReferenceNumber: dto.claimReferenceNumber,
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber,
        RejectionDate: this.formatDateTime(dto.rejectionDate),
        RejectionReason: dto.rejectionReason,
        Claimants: {
          Claimant: (dto.claimants || []).map((claimant) =>
            this.mapClaimant(claimant),
          ),
        },
      },
    };
  }

  private buildHeader(
    dto: {
      companyCode: string;
      systemCode: string;
      callbackUrl: string;
      insurerCompanyCode: string;
    },
    requestId: string,
    extra: Record<string, any> = {},
  ) {
    return {
      RequestId: requestId,
      CompanyCode: dto.companyCode,
      SystemCode: dto.systemCode,
      CallBackUrl: dto.callbackUrl,
      InsurerCompanyCode: dto.insurerCompanyCode,
      ...extra,
    };
  }

  private mapClaimant(claimant: CreateClaimantDto) {
    return {
      ClaimantName: claimant.claimantName,
      ClaimantBirthDate: claimant.claimantBirthDate
        ? this.formatDate(claimant.claimantBirthDate)
        : '',
      ClaimantCategory: claimant.claimantCategory,
      ClaimantType: claimant.claimantType,
      ClaimantIdNumber: claimant.claimantIdNumber,
      ClaimantIdType: claimant.claimantIdType,
      Gender: claimant.gender || '',
      CountryCode: claimant.countryCode,
      Region: claimant.region,
      District: claimant.district,
      Street: claimant.street || '',
      ClaimantPhoneNumber: claimant.claimantPhoneNumber,
      ClaimantFax: claimant.claimantFax || '',
      PostalAddress: claimant.postalAddress || '',
      EmailAddress: claimant.emailAddress || '',
    };
  }

  private formatDateTime(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 19);
  }

  private formatDate(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 10);
  }
}
