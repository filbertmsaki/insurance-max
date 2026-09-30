import { apiClient } from '@/modules/shared/api/client';

export interface RegulatoryAuthorityRecord {
  id: string;
  authority_code: string;
  authority_name: string;
  authority_type: string;
  jurisdiction_code: string;
  registration_reference?: string | null;
  submission_channel?: string | null;
  contact_email?: string | null;
  active: boolean;
}

export interface RegulatoryObligationRecord {
  id: string;
  obligation_reference: string;
  period_start: string;
  period_end: string;
  due_at: string;
  status: string;
  assigned_user_id?: string | null;
  assigned_role_id?: string | null;
  days_remaining?: number;
  warning_sent_days?: number[];
  definition?: {
    obligation_code: string;
    obligation_name: string;
    obligation_type: string;
    frequency: string;
    report_code?: string | null;
    requires_approval?: boolean;
    requires_submission_evidence?: boolean;
  } | null;
  authority?: RegulatoryAuthorityRecord | null;
  active_return?: {
    id: string;
    return_no: string;
    status: string;
    version_number?: number;
  } | null;
  active_levy_assessment?: {
    id: string;
    assessment_no: string;
    status: string;
  } | null;
  allowed_actions?: string[];
}

export interface RegulatoryReturnRecord {
  id: string;
  return_no: string;
  return_code?: string | null;
  version_number: number;
  status: string;
  period_start: string;
  period_end: string;
  due_at?: string | null;
  report_definition_code?: string | null;
  report_definition_version?: number | null;
  source_cutoff_at?: string | null;
  source_projection_sequence?: string | null;
  reconciliation_status: string;
  reconciliation_summary?: Record<string, unknown> | null;
  validation_results?: Record<string, unknown> | null;
  submissions: RegulatorySubmissionRecord[];
  versions: Array<{
    id: string;
    return_no: string;
    version_number: number;
    status: string;
    created_at: string;
  }>;
  read_only: boolean;
  active_levy_assessment?: RegulatoryLevyAssessmentRecord | null;
  obligation_instance?: {
    id: string;
    obligation_reference: string;
    due_at?: string | null;
    status: string;
  } | null;
  parameters?: Record<string, unknown>;
  return_snapshot?: Record<string, unknown> | null;
}

export interface RegulatorySubmissionRecord {
  id: string;
  submission_no: string;
  submission_channel: string;
  submission_reference?: string | null;
  status: string;
  acknowledgement_reference?: string | null;
  acknowledgement_code?: string | null;
  acknowledgement_message?: string | null;
  evidence_document_id?: string | null;
  submitted_at: string;
  acknowledged_at?: string | null;
}

export interface RegulatoryLevyAssessmentRecord {
  id: string;
  assessment_no: string;
  period_start: string;
  period_end: string;
  status: string;
  basis_amount: string;
  rate_value: string;
  assessed_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  currency_code: string;
  reconciliation_status: string;
  finance_payment_reference?: string | null;
  approved_at?: string | null;
  created_at: string;
}

/** Regulatory authorities, calendar, returns and levies (`/tenant/regulatory`). */
export const regulatoryApi = {
  getAuthorities() {
    return apiClient
      .get<RegulatoryAuthorityRecord[]>('/tenant/regulatory/authorities')
      .then((response) => response.data);
  },

  getRegulatoryCalendar() {
    return apiClient
      .get<RegulatoryObligationRecord[]>('/tenant/regulatory/calendar')
      .then((response) => response.data);
  },

  generateRegulatoryCalendar(year: number) {
    return apiClient
      .post(`/tenant/regulatory/calendar/generate/${year}`)
      .then((response) => response.data);
  },

  getRegulatoryReturns() {
    return apiClient
      .get<RegulatoryReturnRecord[]>('/tenant/regulatory/returns')
      .then((response) => response.data);
  },

  getRegulatoryReturn(id: string) {
    return apiClient
      .get<RegulatoryReturnRecord>(`/tenant/regulatory/returns/${id}`)
      .then((response) => response.data);
  },

  validateReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/validate`)
      .then((response) => response.data);
  },

  reconcileReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/reconcile`)
      .then((response) => response.data);
  },

  submitReturnForReview(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/submit-review`)
      .then((response) => response.data);
  },

  approveReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/approve`)
      .then((response) => response.data);
  },

  createReturnCorrection(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/create-correction`)
      .then((response) => response.data);
  },

  recordSubmission(
    id: string,
    payload: {
      submission_channel: string;
      submission_reference?: string;
      evidence_document_id?: string;
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
      acknowledged_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/record-submission`, payload)
      .then((response) => response.data);
  },

  getLevyAssessments() {
    return apiClient
      .get<
        RegulatoryLevyAssessmentRecord[]
      >('/tenant/regulatory/levy-assessments')
      .then((response) => response.data);
  },
};
