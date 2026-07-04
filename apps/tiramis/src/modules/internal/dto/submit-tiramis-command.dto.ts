export type TiramisPortalRequestType = 'NON_MOTOR' | 'MOTOR' | 'MOTOR_FLEET';

export interface SubmitTiramisCommandDto {
  sourceService?: string;
  sourceCompanyId?: string | null;
  sourceUserId?: string | null;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  policyId?: string | null;
  quotationId?: string | null;
  businessReference?: string | null;
  requestType: TiramisPortalRequestType;
  /**
   * Actual payload prepared by insurance-portal-service.
   *
   * NON_MOTOR    => CreateCoverNoteDto
   * MOTOR        => CreateMotorCoverNoteDto with isFleet=false
   * MOTOR_FLEET  => CreateMotorCoverNoteDto with isFleet=true
   */
  payload: Record<string, any>;
}

export interface TiramisSubmissionQueryCommandDto {
  transactionId?: string | null;
  requestId?: string | null;
  businessReference?: string | null;
  includePayload?: boolean;
}
