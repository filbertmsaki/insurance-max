export type TiramisPortalNotificationEventType =
  | 'TIRAMIS_ACK_RECEIVED'
  | 'TIRAMIS_ACK_FAILED'
  | 'TIRAMIS_FINAL_RESPONSE_RECEIVED'
  | 'TIRAMIS_FINAL_SUCCESS'
  | 'TIRAMIS_FINAL_FAILED'
  | 'TIRAMIS_FINAL_CALLBACK_OVERDUE'
  | 'TIRAMIS_RESPONSE_ACK_SENT'
  | 'TIRAMIS_CALLBACK_REJECTED'
  | 'TIRAMIS_SUBMISSION_FAILED';

export interface TiramisPortalNotificationEventDto {
  eventType: TiramisPortalNotificationEventType;
  sourceService: 'tiramis-service';
  sourceCompanyId?: string | null;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  businessReference?: string | null;
  tiramisTransactionId?: string | null;
  requestId: string;
  responseId?: string | null;
  serviceType?: string | null;
  rootElement?: string | null;
  statusCode?: string | null;
  statusDescription?: string | null;
  transactionStatus?: string | null;
  attemptStatus?: string | null;
  coverNoteReferenceNumber?: string | null;
  policyReferenceNumber?: string | null;
  stickerNumber?: string | null;
  errorMessage?: string | null;
  occurredAt: string;
}
