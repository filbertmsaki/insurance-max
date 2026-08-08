export interface ReinsuranceRecord {
  id: string;
  treaty_no?: string | null;
  treaty_name?: string | null;
  cession_no?: string | null;
  settlement_no?: string | null;
  policy_id?: string | null;
  status?: string | null;
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
