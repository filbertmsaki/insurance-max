export interface ClaimsPage<T> {
  data?: T[];
  items?: T[];
  total?: number;
  meta?: {
    totalItems?: number;
    itemCount?: number;
    itemsPerPage?: number;
    totalPages?: number;
    currentPage?: number;
  };
}

export interface ClaimCustomer {
  id?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  display_name?: string | null;
}

export interface ClaimPolicy {
  id: string;
  policy_no?: string | null;
  cover_note_no?: string | null;
}

export interface ClaimUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ClaimRecord {
  id: string;
  claim_no: string;
  claim_notification_number?: string | null;
  status: string;
  priority?: string | null;
  claim_stage?: string | null;
  coverage_status?: string | null;
  settlement_status?: string | null;
  fraud_status?: string | null;
  liability_status?: string | null;
  loss_date?: string | null;
  claim_report_date?: string | null;
  loss_nature?: string | null;
  loss_type?: string | null;
  loss_location?: string | null;
  description?: string | null;
  estimated_amount?: string | number | null;
  approved_amount?: string | number | null;
  paid_amount?: string | number | null;
  outstanding_reserve?: string | number | null;
  gross_incurred_amount?: string | number | null;
  net_incurred_amount?: string | number | null;
  currency_code?: string | null;
  assigned_user_id?: string | null;
  tiramis_status?: string | null;
  policy?: ClaimPolicy | null;
  customer?: ClaimCustomer | null;
  assigned_user?: ClaimUser | null;
  claimants?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  reserves?: Array<Record<string, unknown>>;
  assessments?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  status_history?: Array<Record<string, unknown>>;
  created_at?: string;
  updated_at?: string;
}

export interface ClaimListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  branch_id?: string;
  assigned_user_id?: string;
  policy_id?: string;
  from?: string;
  to?: string;
}
