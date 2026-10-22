import { apiClient } from '@/modules/shared/api/client';

import type { PaginatedResponse } from '@/modules/shared/api/pagination';

export interface AuditLog {
  id: string;
  user_id: string | null;
  company_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  status: 'success' | 'failure';

  company_membership_id: string | null;
  branch_id: string | null;
  session_id: string | null;

  request_id: string | null;
  correlation_id: string | null;

  actor_type: string;
  actor_service: string | null;
  event_category: string | null;

  reason: string | null;

  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  changed_fields: string[] | null;

  created_at: string;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  action?: string;
  event_category?: string;
  resource?: string;
  resource_id?: string;
  user_id?: string;
  status?: string;
  request_id?: string;
  correlation_id?: string;
  start_date?: string;
  end_date?: string;
}

export const auditApi = {
  /** GET /audit-logs — always paged server-side (limit max 100). */
  search: (filters: AuditFilters, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<AuditLog>>('/apps/audit-logs', {
        params: filters,
        signal,
      })
      .then((response) => response.data),

  findOne: (id: string) =>
    apiClient
      .get<AuditLog>(`/apps/audit-logs/${id}`)
      .then((response) => response.data),

  verifyChain: () =>
    apiClient
      .get<{
        valid: boolean;
        totalEvents: number;
        brokenEventId: string | null;
        brokenEventNo: string | null;
        reason: string | null;
      }>('/apps/audit-logs/verify-chain/status')
      .then((response) => response.data),
};
