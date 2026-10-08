export interface ReinsuranceRecord {
  id: string;
  treaty_no?: string | null;
  treaty_name?: string | null;
  cession_no?: string | null;
  settlement_no?: string | null;
  offer_no?: string | null;
  recovery_no?: string | null;
  claim_id?: string | null;
  cession_id?: string | null;
  expected_recovery?: string | number | null;
  admitted_recovery?: string | number | null;
  received_recovery?: string | number | null;
  outstanding_recovery?: string | number | null;
  offered_share_percent?: string | number | null;
  quoted_share_percent?: string | number | null;
  placement?: {
    placement_no?: string | null;
    risk_description?: string | null;
    amount_to_place?: string | number | null;
    premium_to_place?: string | number | null;
    currency?: string | null;
    submission_deadline?: string | null;
  } | null;
  policy_id?: string | null;
  status?: string | null;
  currency?: string | null;
  participants?: Array<{
    id: string;
    status?: string;
    participant_company_id?: string;
    share_percent?: string | number;
  }>;
  effective_from?: string | null;
  effective_to?: string | null;
  currency_code?: string | null;
  gross_premium?: string | number | null;
  ceded_premium?: string | number | null;
  ceded_sum_insured?: string | number | null;
  settlement_amount?: string | number | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface CapacityEvaluation {
  allowed?: boolean;
  exposure_amount?: string | number;
  available_capacity?: string | number;
  utilized_capacity?: string | number;
  treaty_id?: string;
  treaty_section_id?: string | null;
  messages?: string[];
  [key: string]: unknown;
}
