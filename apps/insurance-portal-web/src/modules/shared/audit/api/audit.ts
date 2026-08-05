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
  action?: string;
  event_category?: string;
  resource?: string;
  user_id?: string;
  status?: string;
  request_id?: string;
  correlation_id?: string;
  start_date?: string;
  end_date?: string;
}

export const auditApi = {
  search: (filters: AuditFilters) =>
    apiClient
      .get<PaginatedResponse<AuditLog>>('/audit-logs', {
        params: filters,
      })
      .then((response) => response.data),

  findOne: (id: string) =>
    apiClient.get<AuditLog>(`/audit-logs/${id}`).then((response) => response.data),
};
