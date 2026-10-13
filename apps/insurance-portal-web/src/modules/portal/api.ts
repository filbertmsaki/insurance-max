import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  CommunicationMessageRecord,
  CommunicationThreadRecord,
  DocumentRecord,
  SignatureRequestRecord,
} from '@/modules/tenant/engagement/api';
import type {
  MotorVerificationRequest,
  VerificationResult,
} from '@/modules/tenant/verifications/api';
import type {
  QuotationDraftRecordPayload,
  QuotationPayload,
  QuotationSubmitResponse,
} from '@/modules/tenant/quotations/types';
import type {
  CustomerPayload,
  CustomerRecord,
} from '@/modules/tenant/customers/types';

export type PortalAudience = 'customer' | 'intermediary';

/** Flattened server-table params: page, limit, search, sortBy, sortOrder, filters. */
export type PortalTableParams = Record<string, string | number | undefined>;

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
  gender?: 'M' | 'F' | null;
  date_of_birth?: string | null;
  company_name?: string | null;
  policy_holder_type?: number | null;
  id_type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  id_number?: string | null;
  nida_no?: string | null;
  voter_no?: string | null;
  passport_no?: string | null;
  driving_license_no?: string | null;
  zanid_no?: string | null;
  tin?: string | null;
  registration_no?: string | null;
  incorporation_certificate_no?: string | null;
  vrn?: string | null;
  display_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  country?: string | null;
  country_code?: string | null;
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

/** Maps the portal `{ items, meta }` page shape onto the shared table contract. */
function toPaginated<T>(response: PortalPagedResponse<T>): PaginatedResponse<T> {
  const { page, limit, total } = response.meta;
  const totalPages =
    response.meta.total_pages ?? (total > 0 ? Math.ceil(total / limit) : 0);
  return {
    data: response.items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
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
  product_code: string;
  tiramis_product_code: string | null;
  category: { id: string; name: string } | null;
}

export interface CustomerPortalRisk {
  id: string;
  risk_code: string;
  tiramis_risk_code: string | null;
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
    /** INTERNAL = policy on this platform, TIRA = found in the national register. */
    source?: 'INTERNAL' | 'TIRA';
  }>;
}

export interface CreateQuotationDraftPayload {
  insurer_company_id?: string;
  category_id: string;
  product_id: string;
  branch_id?: string | null;
  sub_class_id?: string | null;
  quotation_type: 'MOTOR' | 'NON_MOTOR';
  quotation_flow: 'NON_MOTOR' | 'MOTOR_SINGLE' | 'MOTOR_FLEET';
  channel_type: 'DIRECT' | 'BROKER' | 'AGENCY' | 'BANCASSURANCE' | 'API';
  is_fleet: boolean;
  current_wizard_step?: string | null;
  draft_payload: Record<string, unknown>;
}

export interface IntermediaryDistributionLocations {
  company_type: string;
  branches: Array<{ id: string; name: string; code: string }>;
  sale_points: Array<{
    id: string;
    branch_id: string | null;
    code: string;
    name: string | null;
  }>;
}

export interface IntermediarySettlementReport {
  from_date: string | null;
  to_date: string | null;
  groups: Array<{
    insurer_company_id: string;
    insurer_name: string | null;
    branch_id: string | null;
    branch_name: string;
    sale_point_id: string | null;
    sale_point_code: string | null;
    sale_point_name: string;
    status: string;
    transaction_count: number;
    commission_amount: string;
    paid_amount: string;
    balance_amount: string;
  }>;
  totals: {
    transaction_count: number;
    commission_amount: number;
    paid_amount: number;
    balance_amount: number;
  };
}

export interface PortalRiskRecord {
  id: string;
  risk_name: string;
  risk_code?: string;
}

export interface CustomerCompanyContext {
  company_id: string;
  customer_id: string;
  portal_account_id: string;
  branch_id: string;
  sale_point_code: string;
  sale_point_name: string | null;
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

export type PortalRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PortalPolicyRequestType =
  | 'ENDORSEMENT'
  | 'CANCELLATION'
  | 'RENEWAL';

export interface PortalPolicyRequestPayload {
  policy_id: string;
  request_type: PortalPolicyRequestType;
  subject: string;
  description: string;
  requested_changes?: Record<string, unknown>;
}

export interface PortalAdminTransitionPayload {
  status: PortalRequestStatus;
  reason?: string;
}

export interface PortalAdminCompletePayload {
  reason?: string;
  result_type?: string;
  result_id?: string;
  result_reference?: string;
}

export interface PortalPaymentProofReviewPayload {
  status: 'VERIFIED' | 'REJECTED';
  reason?: string;
}

function basePath(audience: PortalAudience) {
  return `/${audience}`;
}

export const portalApi = {
  intermediaryPartnerRelationships: () =>
    apiClient
      .get<IntermediaryPartnerRelationship[]>('/partner-relationships')
      .then((r) => r.data),
  relationshipInsurers: () =>
    apiClient
      .get<
        Array<{ id: string; name: string; tira_license_number: string | null }>
      >('/partner-relationships/insurers')
      .then((r) => r.data),
  requestInsurerAppointment: (
    insurer_company_id: string,
    request_note?: string,
  ) =>
    apiClient
      .post('/partner-relationships/requests', {
        insurer_company_id,
        request_note,
      })
      .then((r) => r.data),
  withdrawInsurerAppointment: (id: string, reason: string) =>
    apiClient
      .patch(`/partner-relationships/${id}/withdraw`, { reason })
      .then((r) => r.data),
  listIntermediaryInsurers: () =>
    apiClient
      .get<IntermediaryInsurerRecord[]>('/intermediary/insurers')
      .then((response) => response.data),
  getIntermediaryDistributionLocations: () =>
    apiClient
      .get<IntermediaryDistributionLocations>(
        '/intermediary/distribution-locations',
      )
      .then((response) => response.data),
  getIntermediarySettlementReport: (params?: {
    from_date?: string;
    to_date?: string;
  }) =>
    apiClient
      .get<IntermediarySettlementReport>(
        '/intermediary/commission-settlement-report',
        { params },
      )
      .then((response) => response.data),

  listIntermediaryProductRisks: (
    insurerId: string,
    productId: string,
    branchId?: string,
  ) =>
    apiClient
      .get<
        PortalRiskRecord[]
      >(`/intermediary/insurers/${insurerId}/products/${productId}/risks`, { params: branchId ? { branch_id: branchId } : undefined })
      .then((response) => response.data),

  compareIntermediaryQuotations: (quotationIds: string[]) =>
    apiClient
      .post<
        IntermediaryQuotationComparison[]
      >('/intermediary/quotations/compare', { quotation_ids: quotationIds })
      .then((response) => response.data),

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

  /** Server-table page of a portal business list, normalised from `{ items, meta }`. */
  pageBusinessRecords: (
    audience: PortalAudience,
    resource: string,
    params: PortalTableParams,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<PortalBusinessRecord>> =>
    apiClient
      .get<PortalPagedResponse<PortalBusinessRecord>>(
        resource === 'requests'
          ? '/portal/requests'
          : `${basePath(audience)}/${resource}`,
        { params, signal },
      )
      .then(({ data }) => toPaginated(data)),

  getBusinessRecord: (audience: PortalAudience, resource: string, id: string) =>
    apiClient
      .get<PortalBusinessRecord>(
        resource === 'requests'
          ? `/portal/requests/${id}`
          : `${basePath(audience)}/${resource}/${id}`,
      )
      .then((response) => response.data),

  getIntermediaryCustomer: (id: string) =>
    apiClient
      .get<CustomerRecord>(`/intermediary/customers/${id}`)
      .then((response) => response.data),

  createIntermediaryCustomer: (payload: CustomerPayload) =>
    apiClient
      .post<CustomerRecord>('/intermediary/customers', payload)
      .then((response) => response.data),

  updateIntermediaryCustomer: (id: string, payload: Partial<CustomerPayload>) =>
    apiClient
      .patch<CustomerRecord>(`/intermediary/customers/${id}`, payload)
      .then((response) => response.data),

  deleteIntermediaryCustomer: (id: string) =>
    apiClient
      .delete(`/intermediary/customers/${id}`)
      .then((response) => response.data),

  /**
   * Server-side paged portal lists. Sending `page` switches these endpoints
   * to `{ data, pagination }`; scope (own records only) is applied server-side.
   */
  pageDocuments: (
    audience: PortalAudience,
    params: PortalTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<DocumentRecord>>(
        `${basePath(audience)}/documents`,
        { params, signal },
      )
      .then((response) => response.data),

  pageNotifications: (
    audience: PortalAudience,
    params: PortalTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<PortalNotificationRecord>>(
        `${basePath(audience)}/notifications`,
        { params, signal },
      )
      .then((response) => response.data),

  pageMessages: (
    audience: PortalAudience,
    params: PortalTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<CommunicationThreadRecord>>(
        `${basePath(audience)}/messages`,
        { params, signal },
      )
      .then((response) => response.data),

  pageSignatures: (
    audience: PortalAudience,
    params: PortalTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<SignatureRequestRecord>>(
        `${basePath(audience)}/signatures`,
        { params, signal },
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
      .post<CustomerCompanyContext>(`/customer/companies/${companyId}/context`)
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

  verifyCustomerMotor: (payload: MotorVerificationRequest) =>
    apiClient
      .post<VerificationResult>('/customer/verifications/motor', payload)
      .then((response) => response.data),

  createQuotationDraft: (
    payload: CreateQuotationDraftPayload,
    audience: PortalAudience = 'customer',
  ) =>
    apiClient
      .post<{ id: string }>(`${basePath(audience)}/quotations/drafts`, payload)
      .then((response) => response.data),

  updateQuotationDraft: (
    audience: PortalAudience,
    id: string,
    payload: CreateQuotationDraftPayload & { expected_updated_at?: string },
  ) =>
    apiClient
      .put<PortalBusinessRecord>(
        `${basePath(audience)}/quotations/drafts/${id}`,
        payload,
      )
      .then((response) => response.data),

  finalizeQuotation: (
    audience: PortalAudience,
    id: string,
    payload: Record<string, unknown>,
  ) =>
    apiClient
      .post<PortalBusinessRecord>(
        `${basePath(audience)}/quotations/drafts/${id}/finalize`,
        payload,
      )
      .then((response) => response.data),

  deleteQuotationDraft: (audience: PortalAudience, id: string) =>
    apiClient
      .delete(`${basePath(audience)}/quotations/drafts/${id}`)
      .then((response) => response.data),

  createPolicyRequest: (payload: PortalPolicyRequestPayload) =>
    apiClient
      .post<PortalBusinessRecord>('/portal/requests/policy', payload)
      .then((response) => response.data),

  submitQuotationDirect: (payload: {
    draft: QuotationDraftRecordPayload;
    payload: QuotationPayload;
  }) =>
    apiClient
      .post<QuotationSubmitResponse>('/customer/quotations/submit', payload)
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

  listAdminRequests: (params?: {
    search?: string;
    status?: PortalRequestStatus | string;
    request_type?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient
      .get<PortalPagedResponse<PortalBusinessRecord>>(
        '/tenant/portal/requests',
        {
          params,
        },
      )
      .then((response) => response.data),

  /** Server-table page of company portal requests, normalised from `{ items, meta }`. */
  pageAdminRequests: (
    params: PortalTableParams,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<PortalBusinessRecord>> =>
    apiClient
      .get<PortalPagedResponse<PortalBusinessRecord>>(
        '/tenant/portal/requests',
        { params, signal },
      )
      .then(({ data }) => toPaginated(data)),

  getAdminRequest: (id: string) =>
    apiClient
      .get<PortalBusinessRecord>(`/tenant/portal/requests/${id}`)
      .then((response) => response.data),

  assignAdminRequest: (
    id: string,
    payload: { assigned_to: string; message?: string },
  ) =>
    apiClient
      .post<PortalBusinessRecord>(
        `/tenant/portal/requests/${id}/assign`,
        payload,
      )
      .then((response) => response.data),

  transitionAdminRequest: (id: string, payload: PortalAdminTransitionPayload) =>
    apiClient
      .post<PortalBusinessRecord>(
        `/tenant/portal/requests/${id}/transition`,
        payload,
      )
      .then((response) => response.data),

  completeAdminRequest: (id: string, payload: PortalAdminCompletePayload) =>
    apiClient
      .post<PortalBusinessRecord>(
        `/tenant/portal/requests/${id}/complete`,
        payload,
      )
      .then((response) => response.data),

  reviewPaymentProof: (id: string, payload: PortalPaymentProofReviewPayload) =>
    apiClient
      .post<PortalBusinessRecord>(
        `/tenant/portal/requests/${id}/payment-proof/review`,
        payload,
      )
      .then((response) => response.data),

  downloadAdminRequestAttachment: async (
    id: string,
    fallbackName = 'attachment',
  ) => {
    const response = await apiClient.get<Blob>(
      `/tenant/portal/attachments/${id}/download`,
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

export interface IntermediaryInsurerRecord {
  relationship_id: string;
  insurer_company_id: string;
  insurer_name: string | null;
  partner_type: string;
  products: Array<{
    id: string;
    company_id: string;
    category_id: string;
    category?: { id: string; name: string } | null;
    product_code: string;
    product_name: string;
    business_line: string;
    supports_fleet: boolean;
    tiramis_product_code?: string | null;
    partner_scope: {
      allowed_operations: string[];
      branch_ids: string[] | null;
      commission_rate?: string | null;
      branches: Array<{ id: string; name: string; code: string }>;
    };
  }>;
}

export interface IntermediaryQuotationComparison {
  id: string;
  quotation_no: string;
  insurer_company_id: string;
  insurer_name?: string | null;
  product_id: string;
  product_name?: string;
  category_name?: string;
  status: string;
  currency: string | null;
  premium_excluding_tax: string | null;
  premium_including_tax: string | null;
  cover_note_start_date: string | null;
  cover_note_end_date: string | null;
  created_at: string;
}

export interface IntermediaryPartnerRelationship {
  id: string;
  partner_type: string;
  status: string;
  scope_mode: string;
  start_date: string | null;
  end_date: string | null;
  agreement_reference: string | null;
  insurer_company?: { id: string; name: string };
}
