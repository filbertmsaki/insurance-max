import { Injectable } from '@nestjs/common';
import { Quotation } from '../entities/quotation.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationDisplayStatus } from '../enums/quotation-display-status.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';

export interface ResolvedQuotationDisplayStatus {
  displayStatus: QuotationDisplayStatus;
  displayLabel: string;
}

@Injectable()
export class QuotationDisplayStatusResolver {
  resolve(quotation: Pick<
    Quotation,
    'status' | 'approval_status' | 'payment_status' | 'tira_status'
  >): ResolvedQuotationDisplayStatus {
    if (quotation.status === QuotationStatus.COMPLETED) {
      return this.status(QuotationDisplayStatus.COMPLETED, 'Completed');
    }

    if (quotation.status === QuotationStatus.CANCELLED) {
      return this.status(QuotationDisplayStatus.CANCELLED, 'Cancelled');
    }

    if (quotation.status === QuotationStatus.EXPIRED) {
      return this.status(QuotationDisplayStatus.EXPIRED, 'Expired');
    }

    if (quotation.tira_status === TiraStatus.REJECTED) {
      return this.status(
        QuotationDisplayStatus.REJECTED_BY_TIRAMIS,
        'Rejected by TIRAMIS',
      );
    }

    if (
      quotation.status === QuotationStatus.FAILED ||
      quotation.tira_status === TiraStatus.FAILED
    ) {
      return this.status(
        QuotationDisplayStatus.TIRAMIS_SUBMISSION_FAILED,
        'TIRAMIS Submission Failed',
      );
    }

    if (quotation.status === QuotationStatus.TIRA_PROCESSING) {
      return this.status(
        QuotationDisplayStatus.PROCESSING_AT_TIRAMIS,
        'Processing at TIRAMIS',
      );
    }

    if (quotation.status === QuotationStatus.SUBMITTED_TO_TIRA) {
      return this.status(
        QuotationDisplayStatus.SUBMITTED_TO_TIRAMIS,
        'Submitted to TIRAMIS',
      );
    }

    if (quotation.status === QuotationStatus.SUBMITTING_TO_TIRA) {
      return this.status(
        QuotationDisplayStatus.SUBMITTING_TO_TIRAMIS,
        'Submitting to TIRAMIS',
      );
    }

    if (quotation.approval_status === ApprovalStatus.PENDING) {
      return this.status(
        QuotationDisplayStatus.PENDING_APPROVAL,
        'Pending Approval',
      );
    }

    if (quotation.approval_status === ApprovalStatus.CHANGES_REQUESTED) {
      return this.status(
        QuotationDisplayStatus.CHANGES_REQUESTED,
        'Changes Requested',
      );
    }

    if (quotation.approval_status === ApprovalStatus.REJECTED) {
      return this.status(
        QuotationDisplayStatus.APPROVAL_REJECTED,
        'Approval Rejected',
      );
    }

    switch (quotation.payment_status) {
      case PaymentStatus.NOT_INITIATED:
        return this.status(
          QuotationDisplayStatus.PAYMENT_REQUIRED,
          'Payment Required',
        );
      case PaymentStatus.REQUESTED:
        return this.status(
          QuotationDisplayStatus.AWAITING_PAYMENT,
          'Awaiting Payment',
        );
      case PaymentStatus.PROCESSING:
        return this.status(
          QuotationDisplayStatus.PAYMENT_PROCESSING,
          'Payment Processing',
        );
      case PaymentStatus.PARTIALLY_PAID:
        return this.status(
          QuotationDisplayStatus.PARTIALLY_PAID,
          'Partially Paid',
        );
      case PaymentStatus.FAILED:
        return this.status(
          QuotationDisplayStatus.PAYMENT_FAILED,
          'Payment Failed',
        );
      case PaymentStatus.EXPIRED:
        return this.status(
          QuotationDisplayStatus.PAYMENT_REQUEST_EXPIRED,
          'Payment Request Expired',
        );
      case PaymentStatus.REFUNDED:
        return this.status(
          QuotationDisplayStatus.PAYMENT_REQUIRED,
          'Payment Required',
        );
    }

    if (quotation.status === QuotationStatus.READY_FOR_SUBMISSION) {
      return this.status(
        QuotationDisplayStatus.READY_FOR_TIRA_SUBMISSION,
        'Ready for TIRAMIS Submission',
      );
    }

    return this.status(QuotationDisplayStatus.DRAFT, 'Draft');
  }

  private status(
    displayStatus: QuotationDisplayStatus,
    displayLabel: string,
  ): ResolvedQuotationDisplayStatus {
    return { displayStatus, displayLabel };
  }
}
