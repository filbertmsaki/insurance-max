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

export interface CustomerInsuranceCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  description: string | null;
  tira_ready: boolean;
}

export interface CustomerPortalProduct {
  id: string;
  name: string;
  description: string | null;
  business_line: string;
  supports_fleet: boolean;
  category: { id: string; name: string } | null;
}

export interface CustomerPortalRisk {
  id: string;
  name: string;
  description: string | null;
  product_id: string;
}

export interface CustomerPortalVehicle {
  id: string;
  company_id: string;
  company_name: string;
  registration_no: string | null;
  chassis_no: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  manufacture_year: number | null;
  status: string;
  latest_policy_expiry: string | null;
  latest_policy_status: string | null;
}

export interface CustomerCoverCheckResult {
  active: boolean;
  matches: Array<{
    insurance_company: string;
    cover_type: string | null;
    effective_date: string;
    expiry_date: string;
    vehicle: {
      registration_no: string | null;
      chassis_no: string | null;
      make: string | null;
      model: string | null;
    };
    status: string;
  }>;
}

export interface CreateQuotationDraftPayload {
  category_id: string;
  product_id: string;
  sub_class_id?: string | null;
  quotation_type: 'MOTOR' | 'NON_MOTOR';
  quotation_flow: 'NON_MOTOR' | 'MOTOR_SINGLE' | 'MOTOR_FLEET';
  channel_type: 'DIRECT' | 'BROKER' | 'AGENCY' | 'BANCASSURANCE' | 'API';
  is_fleet: boolean;
  current_wizard_step?: string | null;
  draft_payload: Record<string, unknown>;
}

export interface PortalPaymentProofPayload {
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_reference?: string;
  description: string;
}

export interface PortalPaymentProofResponse {
  request: PortalBusinessRecord;
  payment_proof: {
    id: string;
    invoice_id: string;
    amount: string;
    currency: string;
    payment_reference: string | null;
    payment_date: string;
    status: string;
  };
  attachment_required: boolean;
  required_document_type: string;
  message: string;
}

export interface PortalClaimNotificationPayload {
  policy_id: string;
  loss_date: string;
  loss_location: string;
  loss_description: string;
  police_reference?: string;
  estimated_loss_amount?: number;
}

export interface PortalComplaintPayload {
  claim_id?: string;
  policy_id?: string;
  customer_id?: string;
  category: string;
  subject: string;
  description: string;
  priority?: string;
}

export interface PortalRequestAttachment {
  id: string;
  document_type: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

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

  getBusinessRecord: (audience: PortalAudience, resource: string, id: string) =>
    apiClient
      .get<PortalBusinessRecord>(
        resource === 'requests'
          ? `/portal/requests/${id}`
          : `${basePath(audience)}/${resource}/${id}`,
      )
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

  listCustomerCompanies: () =>
    apiClient
      .get<CustomerInsuranceCompany[]>('/customer/companies')
      .then((response) => response.data),

  listCustomerCompanyProducts: (companyId: string) =>
    apiClient
      .get<CustomerPortalProduct[]>(`/customer/companies/${companyId}/products`)
      .then((response) => response.data),

  listCustomerCompanyProductRisks: (companyId: string, productId: string) =>
    apiClient
      .get<
        CustomerPortalRisk[]
      >(`/customer/companies/${companyId}/products/${productId}/risks`)
      .then((response) => response.data),

  ensureCustomerCompanyContext: (companyId: string) =>
    apiClient
      .post(`/customer/companies/${companyId}/context`)
      .then((response) => response.data),

  listCustomerVehicles: () =>
    apiClient
      .get<CustomerPortalVehicle[]>('/customer/vehicles')
      .then((response) => response.data),

  checkVehicleCover: (payload: {
    registration_number?: string;
    chassis_number?: string;
    motorCategory?: 1 | 2;
  }) =>
    apiClient
      .post<CustomerCoverCheckResult>('/customer/cover/check', payload)
      .then((response) => response.data),

  createQuotationDraft: (payload: CreateQuotationDraftPayload) =>
    apiClient
      .post<{ id: string }>('/customer/quotations/drafts', payload)
      .then((response) => response.data),

  createPaymentProof: (payload: PortalPaymentProofPayload) =>
    apiClient
      .post<PortalPaymentProofResponse>(
        '/portal/requests/payment-proofs',
        payload,
      )
      .then((response) => response.data),

  createClaimNotification: (payload: PortalClaimNotificationPayload) =>
    apiClient
      .post<PortalBusinessRecord>('/portal/requests/claims', payload)
      .then((response) => response.data),

  createComplaint: (payload: PortalComplaintPayload) =>
    apiClient
      .post<PortalBusinessRecord>('/portal/complaints', payload)
      .then((response) => response.data),

  cancelRequest: (id: string) =>
    apiClient
      .post<PortalBusinessRecord>(`/portal/requests/${id}/cancel`)
      .then((response) => response.data),

  resubmitRequest: (id: string) =>
    apiClient
      .post<PortalBusinessRecord>(`/portal/requests/${id}/resubmit`)
      .then((response) => response.data),

  uploadRequestAttachment: (
    id: string,
    payload: { document_type: string; file: File },
  ) => {
    const formData = new FormData();
    formData.append('document_type', payload.document_type);
    formData.append('file', payload.file);

    return apiClient
      .post<PortalRequestAttachment>(
        `/portal/requests/${id}/attachments`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      )
      .then((response) => response.data);
  },

  downloadRequestAttachment: async (
    id: string,
    fallbackName = 'attachment',
  ) => {
    const response = await apiClient.get<Blob>(
      `/portal/attachments/${id}/download`,
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
};
