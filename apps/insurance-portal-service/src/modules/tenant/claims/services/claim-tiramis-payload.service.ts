import { Injectable } from '@nestjs/common';

import { ClaimAssessment } from '../entities/claim-assessment.entity';
import { ClaimClaimant } from '../entities/claim-claimant.entity';
import { ClaimDischargeVoucher } from '../entities/claim-discharge-voucher.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import { ClaimRejection } from '../entities/claim-rejection.entity';
import { ClaimantType, TiraClaimantCategory } from '../enums/claim.enums';

/** TIRA expects local (East Africa Time) timestamps without an offset. */
const TIRA_TIME_ZONE = 'Africa/Dar_es_Salaam';

export interface TiraFullClaimant {
  claimantName: string;
  claimantBirthDate: string;
  claimantCategory: number | '';
  claimantType: number | '';
  claimantIdNumber: string;
  claimantIdType: number | '';
  gender: string;
  countryCode: string;
  region: string;
  district: string;
  street: string;
  claimantPhoneNumber: string;
  claimantFax: string;
  postalAddress: string;
  emailAddress: string;
}

export interface TiraIdentityClaimant {
  claimantCategory: number | '';
  claimantType: number | '';
  claimantIdNumber: string;
  claimantIdType: number | '';
}

export interface ClaimOfficer {
  name: string;
  title: string;
}

/**
 * Builds the exact TIRAMIS v1.3 claim payloads (§9–14) from portal records.
 * Keys are the camelCase gateway DTO fields, which the gateway maps 1:1 onto
 * the XML tags. Header fields (codes, callback URL) are added server-side by
 * the TIRAMIS module and are never taken from here.
 */
/** Values TIRA accepts when a mandatory tag has nothing to report. */
export const NO_ADJUSTMENT_REASON = 'No adjustment';
export const NO_RECONCILIATION_SUMMARY = 'No reconciliation';
export const NOT_LITIGATED_REASON = 'None';

@Injectable()
export class ClaimTiramisPayloadService {
  notification(claim: InsuranceClaim, officer: ClaimOfficer) {
    return {
      claimNotificationNumber: claim.claim_notification_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      claimReportDate: this.dateTime(claim.claim_report_date),
      claimFormDullyFilled: claim.claim_form_dully_filled,
      lossDate: this.dateTime(claim.loss_date),
      lossNature: claim.loss_nature,
      lossType: claim.loss_type,
      lossLocation: claim.loss_location,
      officerName: officer.name,
      officerTitle: officer.title,
    };
  }

  intimation(
    claim: InsuranceClaim,
    intimation: ClaimIntimation,
    claimants: ClaimClaimant[],
  ) {
    return {
      claimIntimationNumber: intimation.claim_intimation_number,
      claimReferenceNumber: claim.claim_reference_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      claimIntimationDate: this.dateTime(intimation.claim_intimation_date),
      currencyCode: intimation.currency_code,
      exchangeRate: this.rate(intimation.exchange_rate),
      claimEstimatedAmount: this.money(intimation.claim_estimated_amount),
      claimReserveAmount: this.money(intimation.claim_reserve_amount),
      claimReserveMethod: intimation.claim_reserve_method,
      lossAssessmentOption: intimation.loss_assessment_option,
      assessorName: intimation.assessor_name ?? '',
      assessorIdNumber: intimation.assessor_id_number ?? '',
      assessorIdType: intimation.assessor_id_type ?? '',
      claimants: claimants.map((claimant) => this.fullClaimant(claimant)),
    };
  }

  assessment(
    claim: InsuranceClaim,
    assessment: ClaimAssessment,
    claimants: ClaimClaimant[],
  ) {
    return {
      claimAssessmentNumber: assessment.claim_assessment_number,
      claimIntimationNumber: assessment.claim_intimation_number,
      claimReferenceNumber: claim.claim_reference_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      assessmentReceivedDate: this.dateTime(
        assessment.assessment_received_date,
      ),
      assessmentReportSummary: assessment.assessment_report_summary,
      currencyCode: assessment.currency_code,
      exchangeRate: this.rate(assessment.exchange_rate),
      assessmentAmount: this.money(assessment.assessment_amount),
      approvedClaimAmount: this.money(assessment.approved_claim_amount),
      claimApprovalDate: this.dateTime(assessment.claim_approval_date),
      claimApprovalAuthority: assessment.claim_approval_authority ?? '',
      isReAssessment: assessment.is_re_assessment,
      claimants: claimants.map((claimant) => this.identityClaimant(claimant)),
    };
  }

  dischargeVoucher(claim: InsuranceClaim, voucher: ClaimDischargeVoucher) {
    // §12.1 marks every adjustment and reconciliation tag mandatory and
    // TIRA rejects empty ones (TIRA005). Without a recorded adjustment the
    // voucher reports "no adjustment" of 0, and without a reconciliation the
    // offer itself, both dated at the claimant's response.
    const respondedAt = voucher.claimant_response_date;
    const adjusted = !!voucher.adjustment_reason;
    const reconciled = !!voucher.reconciliation_summary;

    return {
      dischargeVoucherNumber: voucher.discharge_voucher_number,
      claimAssessmentNumber: voucher.claim_assessment_number,
      claimReferenceNumber: claim.claim_reference_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      dischargeVoucherDate: this.dateTime(voucher.discharge_voucher_date),
      currencyCode: voucher.currency_code,
      exchangeRate: this.rate(voucher.exchange_rate),
      claimOfferCommunicationDate: this.dateTime(
        voucher.claim_offer_communication_date,
      ),
      claimOfferAmount: this.money(voucher.claim_offer_amount),
      claimantResponseDate: this.dateTime(voucher.claimant_response_date),
      adjustmentDate: this.dateTime(
        adjusted ? voucher.adjustment_date : respondedAt,
      ),
      adjustmentReason: adjusted
        ? voucher.adjustment_reason
        : NO_ADJUSTMENT_REASON,
      adjustmentAmount: this.money(adjusted ? voucher.adjustment_amount : '0'),
      reconciliationDate: this.dateTime(
        reconciled ? voucher.reconciliation_date : respondedAt,
      ),
      reconciliationSummary: reconciled
        ? voucher.reconciliation_summary
        : NO_RECONCILIATION_SUMMARY,
      reconciledAmount: this.money(
        reconciled ? voucher.reconciled_amount : voucher.claim_offer_amount,
      ),
      offerAccepted: voucher.offer_accepted,
      claimants: voucher.claimants as unknown as TiraIdentityClaimant[],
    };
  }

  payment(claim: InsuranceClaim, payment: ClaimPayment) {
    return {
      claimPaymentNumber: payment.claim_payment_number,
      claimReferenceNumber: claim.claim_reference_number,
      claimIntimationNumber: payment.claim_intimation_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      paymentDate: this.dateTime(payment.payment_date),
      paidAmount: this.money(payment.paid_amount),
      paymentMode: payment.payment_mode,
      partiesNotified: payment.parties_notified,
      netPremiumEarned: this.money(payment.net_premium_earned),
      claimResultedLitigation: payment.claim_resulted_litigation,
      // Mandatory tag in §13.1 that TIRA refuses when empty or missing.
      litigationReason:
        payment.claim_resulted_litigation === 'Y' &&
        payment.litigation_reason?.trim()
          ? payment.litigation_reason.trim()
          : NOT_LITIGATED_REASON,
      currencyCode: payment.currency_code,
      exchangeRate: this.rate(payment.exchange_rate),
      claimants: payment.claimants as unknown as TiraIdentityClaimant[],
    };
  }

  rejection(claim: InsuranceClaim, rejection: ClaimRejection) {
    return {
      claimRejectionNumber: rejection.claim_rejection_number,
      claimReferenceNumber: claim.claim_reference_number,
      claimIntimationNumber: rejection.claim_intimation_number,
      coverNoteReferenceNumber: claim.cover_note_reference_number,
      rejectionDate: this.dateTime(rejection.rejection_date),
      rejectionReason: rejection.tira_rejection_reason ?? '',
      claimResultedLitigation: rejection.claim_resulted_litigation,
      claimAmount: this.money(rejection.claim_amount),
      currencyCode: rejection.currency_code ?? claim.currency_code,
      exchangeRate: this.rate(rejection.exchange_rate),
      claimants: rejection.claimants as unknown as TiraIdentityClaimant[],
    };
  }

  fullClaimant(claimant: ClaimClaimant): TiraFullClaimant {
    return {
      claimantName: claimant.full_name,
      claimantBirthDate: claimant.birth_date ?? '',
      claimantCategory: this.category(claimant),
      claimantType: claimant.party_type ?? '',
      claimantIdNumber: claimant.identification_number ?? '',
      claimantIdType: claimant.id_type ?? '',
      gender: claimant.gender ?? '',
      countryCode: claimant.country_code ?? '',
      region: claimant.region ?? '',
      district: claimant.district ?? '',
      street: claimant.street ?? '',
      claimantPhoneNumber: claimant.phone ?? '',
      claimantFax: claimant.fax ?? '',
      postalAddress: claimant.postal_address ?? '',
      emailAddress: claimant.email ?? '',
    };
  }

  identityClaimant(claimant: ClaimClaimant): TiraIdentityClaimant {
    return {
      claimantCategory: this.category(claimant),
      claimantType: claimant.party_type ?? '',
      claimantIdNumber: claimant.identification_number ?? '',
      claimantIdType: claimant.id_type ?? '',
    };
  }

  /** YYYY-MM-DDTHH:mm:ss in East Africa Time; '' when absent. */
  dateTime(value: Date | string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: TIRA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  }

  private category(claimant: ClaimClaimant): number {
    if (claimant.claimant_category) {
      return claimant.claimant_category;
    }

    return [ClaimantType.POLICYHOLDER, ClaimantType.INSURED].includes(
      claimant.claimant_type,
    )
      ? TiraClaimantCategory.POLICYHOLDER
      : TiraClaimantCategory.THIRD_PARTY;
  }

  private money(value: string | number | null | undefined): string {
    return Number(value ?? 0).toFixed(2);
  }

  private rate(value: string | number | null | undefined): string {
    return Number(value ?? 1).toFixed(2);
  }
}
