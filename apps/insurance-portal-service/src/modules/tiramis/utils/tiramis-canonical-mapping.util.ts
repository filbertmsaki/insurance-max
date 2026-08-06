import {
  TiramisIntegrationRequestType,
  TiramisIntegrationStatus,
} from '@insurance-max/contracts';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

export function mapLegacyRequestTypeToCanonical(
  requestType: TiramisRequestType,
):
  | (typeof TiramisIntegrationRequestType)[keyof typeof TiramisIntegrationRequestType]
  | null {
  switch (requestType) {
    case TiramisRequestType.NON_MOTOR:
      return TiramisIntegrationRequestType.NON_MOTOR_COVER_NOTE;
    case TiramisRequestType.MOTOR:
      return TiramisIntegrationRequestType.MOTOR_COVER_NOTE;
    case TiramisRequestType.MOTOR_FLEET:
      return TiramisIntegrationRequestType.MOTOR_FLEET_COVER_NOTE;
    case TiramisRequestType.POLICY:
      return TiramisIntegrationRequestType.POLICY;
    case TiramisRequestType.CLAIM_NOTIFICATION:
      return TiramisIntegrationRequestType.CLAIM_NOTIFICATION;
    case TiramisRequestType.CLAIM_INTIMATION:
      return TiramisIntegrationRequestType.CLAIM_INTIMATION;
    case TiramisRequestType.CLAIM_ASSESSMENT:
      return TiramisIntegrationRequestType.CLAIM_ASSESSMENT;
    case TiramisRequestType.CLAIM_PAYMENT:
      return TiramisIntegrationRequestType.CLAIM_PAYMENT;
    case TiramisRequestType.CLAIM_REJECTION:
      return TiramisIntegrationRequestType.CLAIM_REJECTION;
    case TiramisRequestType.DISCHARGE_VOUCHER:
      return TiramisIntegrationRequestType.DISCHARGE_VOUCHER;
    case TiramisRequestType.REINSURANCE:
      return TiramisIntegrationRequestType.REINSURANCE;
    default:
      return null;
  }
}

export function mapLegacyStatusToCanonical(
  status: TiramisSubmissionStatus | string | null | undefined,
): (typeof TiramisIntegrationStatus)[keyof typeof TiramisIntegrationStatus] {
  switch (status) {
    case TiramisSubmissionStatus.DRAFT:
      return TiramisIntegrationStatus.CREATED;
    case TiramisSubmissionStatus.PENDING:
    case TiramisSubmissionStatus.SUBMITTING:
      return TiramisIntegrationStatus.QUEUED;
    case TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE:
      return TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE;
    case TiramisSubmissionStatus.ACK_ACCEPTED:
    case TiramisSubmissionStatus.ACKNOWLEDGED:
      return TiramisIntegrationStatus.ACK_ACCEPTED;
    case TiramisSubmissionStatus.ACK_FAILED:
      return TiramisIntegrationStatus.ACK_REJECTED;
    case TiramisSubmissionStatus.PENDING_FINAL:
      return TiramisIntegrationStatus.WAITING_FINAL_RESPONSE;
    case TiramisSubmissionStatus.FINAL_SUCCESS:
      return TiramisIntegrationStatus.FINAL_ACCEPTED;
    case TiramisSubmissionStatus.FINAL_FAILED:
      return TiramisIntegrationStatus.FINAL_REJECTED;
    case TiramisSubmissionStatus.RETRY_PENDING:
      return TiramisIntegrationStatus.TRANSPORT_RETRY_SCHEDULED;
    case TiramisSubmissionStatus.RETRYING:
      return TiramisIntegrationStatus.TRANSPORT_RETRYING;
    case TiramisSubmissionStatus.RETRY_EXHAUSTED:
      return TiramisIntegrationStatus.RETRY_EXHAUSTED;
    case TiramisSubmissionStatus.CALLBACK_OVERDUE:
      return TiramisIntegrationStatus.CALLBACK_OVERDUE;
    case TiramisSubmissionStatus.FAILED:
      return TiramisIntegrationStatus.TRANSPORT_FAILED;
    default:
      return TiramisIntegrationStatus.RECONCILIATION_REQUIRED;
  }
}
