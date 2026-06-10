import { apiClient } from './client'
import type { UserSession } from '@/types'

export const sessionsApi = {
  getSessions: () => apiClient.get<UserSession[]>('/sessions').then((r) => r.data),

  revokeSession: (id: string) =>
    apiClient.delete(`/sessions/${id}`).then((r) => r.data),

  revokeAllSessions: () =>
    apiClient.delete('/sessions/all').then((r) => r.data),
}
