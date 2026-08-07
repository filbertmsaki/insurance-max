import type {
  DocumentClassification,
  WorkItemPriority,
} from '../index';

export interface EngagementEvent {
  eventId: string;
  eventType: string;
  companyId: string;
  sourceModule: string;
  sourceRecordId: string;
  occurredAt: string;
  actor: {
    type: 'USER' | 'CUSTOMER' | 'INTERMEDIARY' | 'SERVICE' | 'SYSTEM';
    id: string | null;
  };
  recipients: Array<{
    type: 'USER' | 'ROLE' | 'CUSTOMER' | 'INTERMEDIARY' | 'EMAIL' | 'PHONE';
    id: string | null;
    value: string | null;
  }>;
  templateCode: string | null;
  variables: Record<string, unknown>;
  deepLink: {
    internal: string | null;
    customer: string | null;
    intermediary: string | null;
  };
  workItem: {
    required: boolean;
    type: string | null;
    priority: WorkItemPriority | null;
    dueAt: string | null;
  } | null;
  sensitivity: DocumentClassification;
  idempotencyKey: string;
}
