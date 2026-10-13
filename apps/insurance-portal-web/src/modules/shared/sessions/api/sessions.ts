import { apiClient } from '@/modules/shared/api/client';
import type { UserSession } from '@/types';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';

export const sessionsApi = {
  getSessions: () =>
    apiClient.get<UserSession[]>('/sessions').then((r) => r.data),

  /** GET /sessions?page=… — server-side table page of my active sessions */
  listSessions: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<UserSession>>('/sessions', { params, signal })
      .then((r) => r.data),

  revokeSession: (id: string) =>
    apiClient.delete(`/sessions/${id}`).then((r) => r.data),

  revokeOtherSessions: () =>
    apiClient.delete('/sessions/others').then((r) => r.data),

  revokeAllSessions: () =>
    apiClient.delete('/sessions/all').then((r) => r.data),
};
