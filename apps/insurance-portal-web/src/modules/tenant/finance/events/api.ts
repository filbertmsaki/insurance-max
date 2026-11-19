import { apiClient } from '@/modules/shared/api/client';

export const FINANCE_EVENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
  'BLOCKED',
  'DEAD_LETTER',
] as const;
export type FinanceEventStatus = (typeof FINANCE_EVENT_STATUSES)[number];

export interface FinanceEventSummary {
  total: number;
  counts: Record<FinanceEventStatus, number>;
  oldestOpenAgeSeconds: number | null;
  retrying: number;
  totalAttempts: number;
  latency24h: {
    samples: number;
    avgSeconds: number | null;
    p95Seconds: number | null;
  };
  byType: Array<{ event_type: string; status: string; n: number }>;
  accountingOutcomes: Array<{ accounting_outcome: string; n: number }>;
  replays: { awaiting_approval: number; approved: number };
  alerts: Array<{ level: 'critical' | 'warning'; message: string }>;
  contracts: Array<{
    eventType: string;
    schemaVersions: number[];
    consumer: string;
    role: string;
  }>;
}

export interface FinanceEventRow {
  id: string;
  event_type: string;
  schema_version: number;
  aggregate_type: string;
  aggregate_id: string;
  event_key: string;
  status: FinanceEventStatus;
  attempt_count: number;
  failure_class: string | null;
  last_error: string | null;
  created_at: string;
  published_at: string | null;
  age_seconds: number;
  business_outcome: string | null;
  accounting_outcome: string | null;
  accounting_reference: string | null;
}

export interface FinanceEventPage {
  items: FinanceEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FinanceReplayRequest {
  id: string;
  outbox_event_id: string;
  status: string;
  reason: string;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decision_note: string | null;
  execution_result: string | null;
  event_type?: string;
  event_status?: string;
  audit?: Array<{ action: string; actor_id: string; recorded_at: string }>;
}

export interface FinanceEventDetail {
  event: FinanceEventRow & { payload: Record<string, unknown> };
  outcomes: Array<{
    id: string;
    consumer: string;
    idempotency_key: string;
    source_type: string;
    source_id: string;
    source_revision: string | null;
    operation: string;
    business_outcome: string;
    business_reference: string | null;
    accounting_outcome: string;
    accounting_reference: string | null;
    detail: string | null;
    processed_at: string;
  }>;
  attempts: Array<{
    id: string;
    claim_generation: string;
    trigger: string;
    result: string;
    failure_class: string | null;
    error: string | null;
    started_at: string;
    finished_at: string;
  }>;
  replays: FinanceReplayRequest[];
}

const base = '/tenant/finance/events';

export const financeEventsApi = {
  summary: () =>
    apiClient.get<FinanceEventSummary>(`${base}/summary`).then((r) => r.data),
  list: (params: {
    status?: string;
    eventType?: string;
    page: number;
    pageSize: number;
  }) =>
    apiClient
      .get<FinanceEventPage>(base, { params })
      .then((r) => r.data),
  detail: (id: string) =>
    apiClient.get<FinanceEventDetail>(`${base}/${id}`).then((r) => r.data),
  replays: (status?: string) =>
    apiClient
      .get<FinanceReplayRequest[]>(`${base}/replays`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),
  requestReplay: (id: string, reason: string) =>
    apiClient
      .post<FinanceReplayRequest>(`${base}/${id}/replay-requests`, { reason })
      .then((r) => r.data),
  decideReplay: (
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) =>
    apiClient
      .post<FinanceReplayRequest>(`${base}/replays/${requestId}/decision`, {
        decision,
        note,
      })
      .then((r) => r.data),
  executeReplay: (requestId: string) =>
    apiClient
      .post<FinanceReplayRequest>(`${base}/replays/${requestId}/execute`)
      .then((r) => r.data),
  cancelReplay: (requestId: string) =>
    apiClient
      .post<FinanceReplayRequest>(`${base}/replays/${requestId}/cancel`)
      .then((r) => r.data),
};
