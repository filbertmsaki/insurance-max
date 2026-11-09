import { apiClient } from '@/modules/shared/api/client';

/** Limits shared by auto-approval rules and direct approvers. Empty = any. */
export interface ApprovalScope {
  payment_modes: number[];
  product_ids: string[];
  quotation_flows: string[];
  branch_ids: string[];
  /** Every risk on the quotation must be one of these codes. */
  risk_codes: string[];
  max_total_premium: number | null;
  max_discount_percent: number | null;
}

export interface AutoApprovalRule extends ApprovalScope {
  id: string;
  name: string;
  enabled: boolean;
  /** Create the payment invoice at completion (skip Request Payment). */
  auto_request_payment?: boolean;
  /** Cash: also record the payment so the quotation is Paid (verified later). */
  auto_record_cash_payment?: boolean;
}

export interface DirectApprover extends ApprovalScope {
  user_id: string;
  enabled: boolean;
  /** Create the payment invoice at completion (skip Request Payment). */
  auto_request_payment?: boolean;
  /** Cash: also record the payment so the quotation is Paid (verified later). */
  auto_record_cash_payment?: boolean;
}

export interface QuotationApprovalPolicy {
  auto_approval: { enabled: boolean; rules: AutoApprovalRule[] };
  direct_approval: { enabled: boolean; approvers: DirectApprover[] };
  /** Read-only: the caller is the only policy administrator. */
  self_edit_allowed?: boolean;
}

export function emptyScope(): ApprovalScope {
  return {
    payment_modes: [],
    product_ids: [],
    quotation_flows: [],
    branch_ids: [],
    risk_codes: [],
    max_total_premium: null,
    max_discount_percent: null,
  };
}

export const approvalPolicyApi = {
  get: () =>
    apiClient
      .get<QuotationApprovalPolicy>('/tenant/quotation-approval-policy')
      .then((response) => response.data),
  update: (policy: QuotationApprovalPolicy) =>
    apiClient
      .put<QuotationApprovalPolicy>('/tenant/quotation-approval-policy', policy)
      .then((response) => response.data),
};
