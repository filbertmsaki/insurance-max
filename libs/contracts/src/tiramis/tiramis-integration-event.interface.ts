import type { RegulatoryFinalResponse } from '../issuance/regulatory-response.interface';
import type {
  TiramisIntegrationEventType,
  TiramisIntegrationSchemaVersion,
  TiramisIntegrationStatus,
} from './tiramis-integration.enums';

export interface TiramisIntegrationEvent {
  schemaVersion: typeof TiramisIntegrationSchemaVersion.V1;
  eventVersion: '1.0';
  eventId: string;
  eventSequence: number;
  transactionId: string;
  attemptId: string | null;
  attemptNumber: number | null;
  requestId: string;
  idempotencyKey: string;
  correlationId: string;
  sourceCompanyId: string;
  sourceModule: string;
  sourceRecordId: string;
  workflowRevision: number | null;
  requestType: string;
  eventType: TiramisIntegrationEventType;
  status: TiramisIntegrationStatus;
  acknowledgement: {
    id: string | null;
    statusCode: string | null;
    statusDescription: string | null;
  } | null;
  finalResponse: {
    responseId: string | null;
    statusCode: string | null;
    statusDescription: string | null;
  } | null;
  retry: {
    retryable: boolean;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt: string | null;
  };
  error: {
    code: string | null;
    message: string | null;
  } | null;
  regulatoryResponse: RegulatoryFinalResponse | null;
  occurredAt: string;
}
