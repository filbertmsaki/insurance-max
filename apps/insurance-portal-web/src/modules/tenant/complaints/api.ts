import { apiClient } from '@/modules/shared/api/client';
import type { ComplaintComment, ComplaintRecord } from './types';

export const complaintsApi = {
  list: () =>
    apiClient.get<ComplaintRecord[]>('/tenant/complaints').then((r) => r.data),
  get: (id: string) =>
    apiClient
      .get<ComplaintRecord>(`/tenant/complaints/${id}`)
      .then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<ComplaintRecord>('/tenant/complaints', data)
      .then((r) => r.data),
  comments: (id: string) =>
    apiClient
      .get<ComplaintComment[]>(`/tenant/complaints/${id}/comments`)
      .then((r) => r.data),
  acknowledge: (id: string) =>
    apiClient
      .post<ComplaintRecord>(`/tenant/complaints/${id}/acknowledge`)
      .then((r) => r.data),
  assign: (id: string, assigned_user_id: string) =>
    apiClient
      .post<ComplaintRecord>(`/tenant/complaints/${id}/assign`, {
        assigned_user_id,
      })
      .then((r) => r.data),
  addComment: (id: string, body: string, is_customer_visible = false) =>
    apiClient
      .post<ComplaintComment>(`/tenant/complaints/${id}/add-comment`, {
        body,
        is_customer_visible,
      })
      .then((r) => r.data),
  decide: (
    id: string,
    action: 'resolve' | 'escalate' | 'close' | 'reopen' | 'cancel' | 'appeal',
    reason: string,
  ) =>
    apiClient
      .post<ComplaintRecord>(`/tenant/complaints/${id}/${action}`, { reason })
      .then((r) => r.data),
};
