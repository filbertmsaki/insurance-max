export type TiramisPortalRequestType =
  | 'NON_MOTOR'
  | 'MOTOR'
  | 'MOTOR_FLEET'
  | 'REINSURANCE'
  | 'POLICY'
  | 'CLAIM_NOTIFICATION'
  | 'CLAIM_INTIMATION'
  | 'CLAIM_ASSESSMENT'
  | 'DISCHARGE_VOUCHER'
  | 'CLAIM_PAYMENT'
  | 'CLAIM_REJECTION'
  | 'COVER_NOTE_VERIFICATION'
  | 'MOTOR_VERIFICATION'
  | 'NIN_VERIFICATION'
  | 'COMPANY_VERIFICATION';

export interface SubmitTiramisCommandDto {
  sourceService?: string;
  sourceCompanyId?: string | null;
  sourceUserId?: string | null;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  policyId?: string | null;
  quotationId?: string | null;
  businessReference?: string | null;
  requestId?: string | null;
  requestType: TiramisPortalRequestType;

  /**
   * Actual payload prepared by insurance-portal-service.
   */
  payload: Record<string, any>;
}

export interface TiramisSubmissionQueryCommandDto {
  transactionId?: string | null;
  requestId?: string | null;
  businessReference?: string | null;
  includePayload?: boolean;
}
