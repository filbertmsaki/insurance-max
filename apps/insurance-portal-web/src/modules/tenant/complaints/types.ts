export interface ComplaintRecord {
  id: string;
  complaint_no: string;
  category: string;
  subject: string;
  description?: string | null;
  priority: string;
  status: string;
  reported_channel?: string | null;
  assigned_user_id?: string | null;
  assigned_team?: string | null;
  acknowledgement_due_at?: string | null;
  resolution_due_at?: string | null;
  regulatory_reportable?: boolean;
  customer_acceptance_status?: string | null;
  resolution?: string | null;
  closure_reason?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  preventive_action?: string | null;
  appeal_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ComplaintComment {
  id: string;
  body: string;
  is_customer_visible?: boolean;
  created_at?: string;
  created_by?: string | null;
}
