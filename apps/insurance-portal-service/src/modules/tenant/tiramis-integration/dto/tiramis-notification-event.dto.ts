import type { RegulatoryFinalResponse } from '@insurance-max/contracts';

export interface TiramisNotificationEventDto {
  eventType: string;

  sourceService?: string | null;
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
  regulatoryResponse?: RegulatoryFinalResponse | null;

  errorMessage?: string | null;
  occurredAt?: string | null;
}
