import { apiClient } from '@/modules/shared/api/client';

export type PortalInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REVOKED'
  | 'EXPIRED';

export type PortalInvitationDeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface PortalInvitationRecord {
  id: string;
  actor_type: 'CUSTOMER' | 'INTERMEDIARY';
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: PortalInvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  delivery_status: PortalInvitationDeliveryStatus;
  delivery_attempts: number;
  last_delivery_error: string | null;
  next_delivery_attempt_at: string | null;
  sent_at: string | null;
  resend_count: number;
  created_at: string;
}

export interface PortalInvitationPage {
  data: PortalInvitationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PortalInvitationFilters {
  status?: PortalInvitationStatus;
  delivery_status?: PortalInvitationDeliveryStatus;
  page?: number;
  limit?: number;
}

const BASE = '/tenant/portal/invitations';

export const portalInvitationsApi = {
  list: (filters: PortalInvitationFilters) =>
    apiClient
      .get<PortalInvitationPage>(BASE, { params: filters })
      .then((response) => response.data),

  resend: (id: string) =>
    apiClient
      .post<PortalInvitationRecord>(`${BASE}/${id}/resend`)
      .then((response) => response.data),

  revoke: (id: string, reason?: string) =>
    apiClient
      .post<PortalInvitationRecord>(`${BASE}/${id}/revoke`, { reason })
      .then((response) => response.data),
};
