import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';

/** Flattened server-table params: page, limit, search, sortBy, sortOrder, filters. */
export type EngagementTableParams = Record<string, string | number | undefined>;

function fetchPage<T>(url: string) {
  return (params: EngagementTableParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<T>>(url, { params, signal })
      .then((response) => response.data);
}

export interface DocumentVersionRecord {
  id: string;
  version_number: number;
  status: string;
  detected_mime_type: string;
  file_size: number;
  uploaded_at: string;
  scan_status: string;
  original_file_name: string | null;
}

export interface DocumentLinkRecord {
  id: string;
  link_type: string;
  linked_record_type: string;
  linked_record_id: string;
  customer_visible: boolean;
  intermediary_visible: boolean;
  label: string | null;
  created_at: string;
}

export interface DocumentAccessEventRecord {
  id: string;
  actor_type: string;
  action: string;
  access_channel: string;
  result: string;
  failure_reason: string | null;
  occurred_at: string;
}

export interface DocumentRecord {
  id: string;
  document_no: string | null;
  title: string | null;
  document_type: string | null;
  classification: string;
  status: string;
  owner_type: string;
  owner_id: string | null;
  customer_visible: boolean;
  intermediary_visible: boolean;
  retention_until: string | null;
  created_at: string;
  file_name?: string | null;
  current_version_id: string | null;
  current_version?: DocumentVersionRecord | null;
  links?: DocumentLinkRecord[];
}

export interface DocumentTemplateVersionRecord {
  id: string;
  version_number: number;
  status: string;
  template_hash: string;
  template_content: string;
  sample_data: Record<string, unknown> | null;
  variable_schema: Record<string, unknown>;
  approved_at: string | null;
  created_at: string;
}

export interface DocumentTemplateRecord {
  id: string;
  template_code: string;
  template_name: string;
  document_type: string;
  engine: string;
  scope: string;
  status: string;
  active_version_id: string | null;
  created_at: string;
  versions?: DocumentTemplateVersionRecord[];
}

export interface SignatureParticipantRecord {
  id: string;
  participant_type: string;
  participant_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  signing_order: number | null;
  status: string;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
}

export interface SignatureEventRecord {
  id: string;
  event_type: string;
  actor_type: string;
  notes: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SignatureRequestRecord {
  id: string;
  request_no: string;
  document_id: string;
  document_version_id: string;
  status: string;
  signature_provider: string;
  signing_order_required: boolean;
  expires_at: string | null;
  completion_document_version_id: string | null;
  created_at: string;
  completed_at: string | null;
  participants?: SignatureParticipantRecord[];
  events?: SignatureEventRecord[];
}

export interface NotificationRecord {
  id: string;
  notification_no: string | null;
  type: string;
  priority: string;
  severity: string;
  title: string;
  message: string;
  deep_link: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface NotificationPreferenceRecord {
  id: string;
  event_code: string;
  channel: string;
  mode: string;
  quiet_hours_from: string | null;
  quiet_hours_to: string | null;
  marketing_consent: boolean;
  transactional_required: boolean;
}

export interface CommunicationThreadRecord {
  id: string;
  thread_no: string;
  thread_type: string;
  subject: string;
  resource_type: string | null;
  resource_id: string | null;
  customer_visible: boolean;
  intermediary_visible: boolean;
  closed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationMessageRecord {
  id: string;
  thread_id: string;
  direction: string;
  status: string;
  channel: string;
  subject: string | null;
  body_text: string | null;
  sender_type: string | null;
  recipient_type: string | null;
  created_at: string;
}

export interface WorkItemRecord {
  id: string;
  work_item_no: string | null;
  work_item_type: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_user_id: string | null;
  assigned_role: string | null;
  assigned_team: string | null;
  queue_code: string | null;
  source_module: string | null;
  source_record_id: string | null;
  resource_type: string;
  resource_id: string;
  due_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  deep_link: string | null;
  sla_status: string;
}

export interface WorkItemEventRecord {
  id: string;
  event_type: string;
  actor_type: string;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const engagementApi = {
  /** Server-side paged lists (`?page=` switches the endpoint to `{ data, pagination }`). */
  pageDocuments: fetchPage<DocumentRecord>('/tenant/documents'),
  pageDocumentTemplates: fetchPage<DocumentTemplateRecord>(
    '/tenant/document-templates',
  ),
  pageSignatureRequests: fetchPage<SignatureRequestRecord>(
    '/tenant/signature-requests',
  ),
  pageNotifications: fetchPage<NotificationRecord>('/tenant/notifications'),
  pageCommunicationThreads: fetchPage<CommunicationThreadRecord>(
    '/tenant/communications/threads',
  ),
  pageWorkItems: fetchPage<WorkItemRecord>('/tenant/work-items'),

  listDocuments: () =>
    apiClient
      .get<DocumentRecord[]>('/tenant/documents')
      .then((response) => response.data),

  getDocument: (id: string) =>
    apiClient
      .get<DocumentRecord>(`/tenant/documents/${id}`)
      .then((response) => response.data),

  getDocumentVersions: (id: string) =>
    apiClient
      .get<DocumentVersionRecord[]>(`/tenant/documents/${id}/versions`)
      .then((response) => response.data),

  getDocumentLinks: (id: string) =>
    apiClient
      .get<DocumentLinkRecord[]>(`/tenant/documents/${id}/links`)
      .then((response) => response.data),

  /** Access history table for one document (server-side paging). */
  pageDocumentAccessHistory: (
    id: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<
        PaginatedResponse<DocumentAccessEventRecord>
      >(`/tenant/documents/${id}/access-history`, { params, signal })
      .then((response) => response.data),

  createUploadSession: (payload: {
    title: string;
    document_type: string;
    classification: string;
    resource_type: string;
    resource_id: string;
    customer_visible: boolean;
    intermediary_visible: boolean;
  }) =>
    apiClient
      .post<{
        id: string;
        token: string;
        expires_at: string;
        maximum_bytes: number;
        allowed_mime_types: string[];
      }>('/tenant/documents/upload-sessions', payload)
      .then((response) => response.data),

  completeUploadSession: (token: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<DocumentRecord>(
        `/tenant/documents/upload-sessions/${token}/complete`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      )
      .then((response) => response.data);
  },

  archiveDocument: (id: string) =>
    apiClient
      .post(`/tenant/documents/${id}/archive`)
      .then((response) => response.data),

  restoreDocument: (id: string) =>
    apiClient
      .post(`/tenant/documents/${id}/restore`)
      .then((response) => response.data),

  rescanDocument: (id: string) =>
    apiClient
      .post(`/tenant/documents/${id}/rescan`)
      .then((response) => response.data),

  generateDocument: (payload: {
    template_code: string;
    document_type: string;
    title: string;
    source_snapshot: Record<string, unknown>;
    resource_type: string;
    resource_id: string;
    customer_visible?: boolean;
    intermediary_visible?: boolean;
    public_verification_enabled?: boolean;
    idempotency_key: string;
  }) =>
    apiClient
      .post<DocumentRecord>('/tenant/documents/generate', payload)
      .then((response) => response.data),

  downloadDocument: async (id: string, fallbackName = 'document') => {
    const response = await apiClient.get<Blob>(
      `/tenant/documents/${id}/download`,
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

  listNotifications: () =>
    apiClient
      .get<NotificationRecord[]>('/tenant/notifications')
      .then((response) => response.data),

  getNotificationUnreadSummary: () =>
    apiClient
      .get<{
        count: number;
        latest: NotificationRecord[];
      }>('/tenant/notifications/unread-count')
      .then((response) => response.data),

  markNotificationRead: (id: string) =>
    apiClient
      .post(`/tenant/notifications/${id}/read`)
      .then((response) => response.data),

  markNotificationUnread: (id: string) =>
    apiClient
      .post(`/tenant/notifications/${id}/unread`)
      .then((response) => response.data),

  dismissNotification: (id: string) =>
    apiClient
      .post(`/tenant/notifications/${id}/dismiss`)
      .then((response) => response.data),

  markAllNotificationsRead: () =>
    apiClient
      .post('/tenant/notifications/read-all')
      .then((response) => response.data),

  listNotificationPreferences: () =>
    apiClient
      .get<NotificationPreferenceRecord[]>('/tenant/notification-preferences')
      .then((response) => response.data),

  updateNotificationPreferences: (
    items: Array<Omit<NotificationPreferenceRecord, 'id'>>,
  ) =>
    apiClient
      .put<
        NotificationPreferenceRecord[]
      >('/tenant/notification-preferences', { items })
      .then((response) => response.data),

  listDocumentTemplates: () =>
    apiClient
      .get<DocumentTemplateRecord[]>('/tenant/document-templates')
      .then((response) => response.data),

  createDocumentTemplate: (payload: {
    template_code: string;
    template_name: string;
    document_type: string;
    engine?: string;
    scope?: string;
  }) =>
    apiClient
      .post<DocumentTemplateRecord>('/tenant/document-templates', payload)
      .then((response) => response.data),

  getDocumentTemplate: (id: string) =>
    apiClient
      .get<DocumentTemplateRecord>(`/tenant/document-templates/${id}`)
      .then((response) => response.data),

  createDocumentTemplateVersion: (
    id: string,
    payload: {
      template_content: string;
      variable_schema: Record<string, unknown>;
      sample_data?: Record<string, unknown>;
    },
  ) =>
    apiClient
      .post<DocumentTemplateVersionRecord>(
        `/tenant/document-templates/${id}/versions`,
        payload,
      )
      .then((response) => response.data),

  previewDocumentTemplateVersion: (
    id: string,
    source_snapshot?: Record<string, unknown>,
  ) =>
    apiClient
      .post<{
        rendered: string;
        source_snapshot: Record<string, unknown>;
        template_hash: string;
      }>(`/tenant/document-template-versions/${id}/preview`, {
        source_snapshot,
      })
      .then((response) => response.data),

  submitDocumentTemplateVersion: (id: string) =>
    apiClient
      .post(`/tenant/document-template-versions/${id}/submit-approval`)
      .then((response) => response.data),

  approveDocumentTemplateVersion: (id: string) =>
    apiClient
      .post(`/tenant/document-template-versions/${id}/approve`)
      .then((response) => response.data),

  publishDocumentTemplateVersion: (id: string) =>
    apiClient
      .post(`/tenant/document-template-versions/${id}/publish`)
      .then((response) => response.data),

  retireDocumentTemplateVersion: (id: string) =>
    apiClient
      .post(`/tenant/document-template-versions/${id}/retire`)
      .then((response) => response.data),

  listSignatureRequests: () =>
    apiClient
      .get<SignatureRequestRecord[]>('/tenant/signature-requests')
      .then((response) => response.data),

  createSignatureRequest: (payload: {
    document_id: string;
    signature_provider?: string;
    signing_order_required?: boolean;
    expires_at?: string;
    participants: Array<{
      participant_type: string;
      participant_id?: string;
      name: string;
      email?: string;
      phone?: string;
      signing_order?: number;
    }>;
  }) =>
    apiClient
      .post<{
        request: SignatureRequestRecord;
        participants: SignatureParticipantRecord[];
      }>('/tenant/signature-requests', payload)
      .then((response) => response.data),

  getSignatureRequest: (id: string) =>
    apiClient
      .get<SignatureRequestRecord>(`/tenant/signature-requests/${id}`)
      .then((response) => response.data),

  sendSignatureRequest: (id: string) =>
    apiClient
      .post<{
        request: SignatureRequestRecord;
        issued_tokens: Array<{
          participant_id: string;
          name: string;
          token: string;
        }>;
      }>(`/tenant/signature-requests/${id}/send`)
      .then((response) => response.data),

  remindSignatureRequest: (id: string) =>
    apiClient
      .post<SignatureRequestRecord>(`/tenant/signature-requests/${id}/remind`)
      .then((response) => response.data),

  cancelSignatureRequest: (id: string, reason: string) =>
    apiClient
      .post<SignatureRequestRecord>(`/tenant/signature-requests/${id}/cancel`, {
        reason,
      })
      .then((response) => response.data),

  reconcileSignatureRequest: (id: string) =>
    apiClient
      .post<SignatureRequestRecord>(
        `/tenant/signature-requests/${id}/reconcile`,
      )
      .then((response) => response.data),

  verifyPublicDocument: (code: string) =>
    apiClient
      .get<{
        document_no: string | null;
        title: string | null;
        document_type: string | null;
        status: string;
        created_at: string;
        verified_at: string | null;
        file_name: string | null;
        mime_type: string | null;
        current_version: number | null;
      }>(`/documents/verify/${code}`, {
        skipAuthRefresh: true,
        suppressErrorToast: true,
      })
      .then((response) => response.data),

  getPublicSignature: (token: string) =>
    apiClient
      .get<{
        token: string;
        participant: SignatureParticipantRecord;
        request: SignatureRequestRecord;
        document: DocumentRecord | null;
      }>(`/signatures/${token}`, {
        skipAuthRefresh: true,
        suppressErrorToast: true,
      })
      .then((response) => response.data),

  respondPublicSignature: (
    token: string,
    payload: {
      decision: 'SIGN' | 'DECLINE';
      decline_reason?: string;
      name?: string;
    },
  ) =>
    apiClient
      .post(`/signatures/${token}/respond`, payload, {
        skipAuthRefresh: true,
        suppressErrorToast: true,
      })
      .then((response) => response.data),

  listCommunicationThreads: () =>
    apiClient
      .get<CommunicationThreadRecord[]>('/tenant/communications/threads')
      .then((response) => response.data),

  createCommunicationThread: (payload: {
    subject: string;
    thread_type?: string;
    resource_type?: string;
    resource_id?: string;
  }) =>
    apiClient
      .post<CommunicationThreadRecord>(
        '/tenant/communications/threads',
        payload,
      )
      .then((response) => response.data),

  getCommunicationThread: (id: string) =>
    apiClient
      .get<CommunicationThreadRecord>(`/tenant/communications/threads/${id}`)
      .then((response) => response.data),

  listCommunicationMessages: (id: string) =>
    apiClient
      .get<
        CommunicationMessageRecord[]
      >(`/tenant/communications/threads/${id}/messages`)
      .then((response) => response.data),

  postCommunicationMessage: (
    id: string,
    payload: {
      body_text: string;
      subject?: string;
      channel?: string;
      recipient_type?: string;
      recipient_id?: string;
      internal_only?: boolean;
    },
  ) =>
    apiClient
      .post<CommunicationMessageRecord>(
        `/tenant/communications/threads/${id}/messages`,
        payload,
      )
      .then((response) => response.data),

  closeCommunicationThread: (id: string) =>
    apiClient
      .post(`/tenant/communications/threads/${id}/close`)
      .then((response) => response.data),

  reopenCommunicationThread: (id: string) =>
    apiClient
      .post(`/tenant/communications/threads/${id}/reopen`)
      .then((response) => response.data),

  listWorkItems: (view?: string) =>
    apiClient
      .get<WorkItemRecord[]>('/tenant/work-items', {
        params: view ? { view } : undefined,
      })
      .then((response) => response.data),

  listMyWorkItems: () =>
    apiClient
      .get<WorkItemRecord[]>('/tenant/work-items/my')
      .then((response) => response.data),

  listWorkItemQueues: () =>
    apiClient
      .get<
        Array<{
          queue_code: string;
          open_count: number;
          in_progress_count: number;
        }>
      >('/tenant/work-items/queues')
      .then((response) => response.data),

  getWorkItem: (id: string) =>
    apiClient
      .get<WorkItemRecord>(`/tenant/work-items/${id}`)
      .then((response) => response.data),

  getWorkItemTimeline: (id: string) =>
    apiClient
      .get<WorkItemEventRecord[]>(`/tenant/work-items/${id}/timeline`)
      .then((response) => response.data),

  claimWorkItem: (id: string) =>
    apiClient
      .post(`/tenant/work-items/${id}/claim`)
      .then((response) => response.data),

  startWorkItem: (id: string) =>
    apiClient
      .post(`/tenant/work-items/${id}/start`)
      .then((response) => response.data),

  executeWorkItem: (id: string) =>
    apiClient
      .post(`/tenant/work-items/${id}/execute`)
      .then((response) => response.data),

  commentOnWorkItem: (id: string, comment: string) =>
    apiClient
      .post(`/tenant/work-items/${id}/comment`, { comment })
      .then((response) => response.data),

  cancelWorkItem: (id: string, reason: string) =>
    apiClient
      .post(`/tenant/work-items/${id}/cancel`, { reason })
      .then((response) => response.data),
};
