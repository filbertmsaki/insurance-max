import { apiClient } from '@/modules/shared/api/client';
import type {
  CommunicationMessageRecord,
  CommunicationThreadRecord,
  DocumentRecord,
  SignatureRequestRecord,
} from '@/modules/tenant/engagement/api';

export type PortalAudience = 'customer' | 'intermediary';

export interface PortalNotificationRecord {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PortalProfileRecord {
  id: string;
  customer_no?: string;
  customer_type?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  country?: string | null;
  region?: string | null;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
  postal_address?: string | null;
  kyc_status?: string | null;
  status?: string | null;
  name?: string;
  slug?: string;
  company_type?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address?: Record<string, unknown> | null;
  tira_license_number?: string | null;
  tira_license_status?: string | null;
}

export interface PortalPageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
}

export interface PortalPagedResponse<T> {
  items: T[];
  meta: PortalPageMeta;
}

export type PortalBusinessRecord = Record<string, unknown> & { id: string };

function basePath(audience: PortalAudience) {
  return `/${audience}`;
}

export const portalApi = {
  getProfile: (audience: PortalAudience) =>
    apiClient
      .get<PortalProfileRecord>(`${basePath(audience)}/profile`)
      .then((response) => response.data),

  listBusinessRecords: (
    audience: PortalAudience,
    resource: string,
    params?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) =>
    apiClient
      .get<
        PortalPagedResponse<PortalBusinessRecord>
      >(resource === 'requests' ? '/portal/requests' : `${basePath(audience)}/${resource}`, { params })
      .then((response) => response.data),

  listDocuments: (audience: PortalAudience) =>
    apiClient
      .get<DocumentRecord[]>(`${basePath(audience)}/documents`)
      .then((response) => response.data),

  getDocument: (audience: PortalAudience, id: string) =>
    apiClient
      .get<DocumentRecord>(`${basePath(audience)}/documents/${id}`)
      .then((response) => response.data),

  downloadDocument: async (
    audience: PortalAudience,
    id: string,
    fallbackName = 'document',
  ) => {
    const response = await apiClient.get<Blob>(
      `${basePath(audience)}/documents/${id}/download`,
      {
        responseType: 'blob',
      },
    );

    const blob = new Blob([response.data], {
      type:
        (response.headers['content-type'] as string | undefined) ??
        'application/octet-stream',
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fallbackName;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  },

  listNotifications: (audience: PortalAudience) =>
    apiClient
      .get<PortalNotificationRecord[]>(`${basePath(audience)}/notifications`)
      .then((response) => response.data),

  markNotificationRead: (audience: PortalAudience, id: string) =>
    apiClient
      .post(`${basePath(audience)}/notifications/${id}/read`)
      .then((response) => response.data),

  listMessages: (audience: PortalAudience) =>
    apiClient
      .get<CommunicationThreadRecord[]>(`${basePath(audience)}/messages`)
      .then((response) => response.data),

  getMessageThread: (audience: PortalAudience, id: string) =>
    apiClient
      .get<CommunicationThreadRecord>(`${basePath(audience)}/messages/${id}`)
      .then((response) => response.data),

  listMessageEntries: (audience: PortalAudience, id: string) =>
    apiClient
      .get<
        CommunicationMessageRecord[]
      >(`${basePath(audience)}/messages/${id}/messages`)
      .then((response) => response.data),

  postMessage: (
    audience: PortalAudience,
    id: string,
    payload: { body_text: string; subject?: string; channel?: string },
  ) =>
    apiClient
      .post<CommunicationMessageRecord>(
        `${basePath(audience)}/messages/${id}/messages`,
        payload,
      )
      .then((response) => response.data),

  listSignatures: (audience: PortalAudience) =>
    apiClient
      .get<SignatureRequestRecord[]>(`${basePath(audience)}/signatures`)
      .then((response) => response.data),

  getSignature: (audience: PortalAudience, id: string) =>
    apiClient
      .get<SignatureRequestRecord>(`${basePath(audience)}/signatures/${id}`)
      .then((response) => response.data),
};
