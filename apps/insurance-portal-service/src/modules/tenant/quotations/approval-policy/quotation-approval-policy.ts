import { SHORT_TERM_COVER } from '@insurance-max/contracts';
/**
 * Configurable quotation approval: automatic approval rules and per-user
 * direct ("Complete and Approve") authority. Stored as one JSON value in the
 * existing `company_configs` table — no schema of its own.
 *
 * This module is pure (no Nest/TypeORM) so the rules are unit-testable.
 */

export const QUOTATION_APPROVAL_POLICY_KEY = 'quotation_approval_policy';

/** Approve one's own eligible quotation without a second approver. */
export const QUOTATION_DIRECT_APPROVE_PERMISSION = 'quotations:direct-approve';
/** View and edit the approval policy. */
export const QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION =
  'quotations:approval-policy:manage';

/** Limits shared by auto-approval rules and direct approvers. Empty = any. */
export interface ApprovalScope {
  /** TIRA payment modes (1 = Cash, 2 = Cheque, 3 = EFT …). */
  payment_modes: number[];
  product_ids: string[];
  /** MOTOR_SINGLE | MOTOR_FLEET | NON_MOTOR | SHORT_TERM */
  quotation_flows: string[];
  branch_ids: string[];
  /** Risk codes; every risk on the quotation must be listed. */
  risk_codes: string[];
  /** Total premium including tax, quotation currency. */
  max_total_premium: number | null;
  /** Largest discount on any risk, percent of its premium before discount. */
  max_discount_percent: number | null;
}

export interface AutoApprovalRule extends ApprovalScope {
  id: string;
  name: string;
  enabled: boolean;
  /** Create the payment invoice at completion (skips "Request Payment"). */
  auto_request_payment: boolean;
  /**
   * Cash quotations: also record the cash payment, post the receipt and
   * allocate it, so the quotation is Paid at once. Each such payment is
   * flagged for later cash verification by Finance.
   */
  auto_record_cash_payment: boolean;
}

export interface DirectApprover extends ApprovalScope {
  user_id: string;
  enabled: boolean;
  /** Their completed quotations get the payment invoice automatically. */
  auto_request_payment: boolean;
  /**
   * Cash quotations: also record the cash payment, post the receipt and
   * allocate it, so the quotation is Paid at once. Each such payment is
   * flagged for later cash verification by Finance.
   */
  auto_record_cash_payment: boolean;
}

export interface QuotationApprovalPolicy {
  auto_approval: { enabled: boolean; rules: AutoApprovalRule[] };
  direct_approval: { enabled: boolean; approvers: DirectApprover[] };
}

/** What the rules look at, read from the saved quotation. */
export interface ApprovalFacts {
  payment_mode: number | null;
  product_id: string;
  quotation_flow: string;
  branch_id: string | null;
  /** Codes of every risk covered (all vehicles). */
  risk_codes: string[];
  total_premium: number;
  max_discount_percent: number;
}

export const EMPTY_APPROVAL_POLICY: QuotationApprovalPolicy = {
  auto_approval: { enabled: false, rules: [] },
  direct_approval: { enabled: false, approvers: [] },
};

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => String(item ?? '').trim()))].filter(
        Boolean,
      )
    : [];

const numbers = (value: unknown): number[] =>
  Array.isArray(value)
    ? [...new Set(value.map(Number))].filter((item) => Number.isFinite(item))
    : [];

const limit = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function normalizeScope(raw: Record<string, unknown>): ApprovalScope {
  return {
    payment_modes: numbers(raw.payment_modes),
    product_ids: strings(raw.product_ids),
    quotation_flows: strings(raw.quotation_flows),
    branch_ids: strings(raw.branch_ids),
    risk_codes: strings(raw.risk_codes).map((code) => code.toUpperCase()),
    max_total_premium: limit(raw.max_total_premium),
    max_discount_percent: limit(raw.max_discount_percent),
  };
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Accepts any stored/submitted shape and returns a well-formed policy. */
export function normalizeApprovalPolicy(
  value: unknown,
): QuotationApprovalPolicy {
  const raw = record(value);
  const auto = record(raw.auto_approval);
  const direct = record(raw.direct_approval);
  const rules = Array.isArray(auto.rules) ? auto.rules : [];
  const approvers = Array.isArray(direct.approvers) ? direct.approvers : [];
  const seenUsers = new Set<string>();

  return {
    auto_approval: {
      enabled: auto.enabled === true,
      rules: rules.map((item, index) => {
        const rule = record(item);
        return {
          ...normalizeScope(rule),
          id: String(rule.id ?? '').trim() || `rule-${index + 1}`,
          name: String(rule.name ?? '').trim() || `Rule ${index + 1}`,
          enabled: rule.enabled !== false,
          auto_request_payment:
            rule.auto_request_payment === true ||
            rule.auto_record_cash_payment === true,
          auto_record_cash_payment: rule.auto_record_cash_payment === true,
        };
      }),
    },
    direct_approval: {
      enabled: direct.enabled === true,
      approvers: approvers
        .map((item) => {
          const approver = record(item);
          return {
            ...normalizeScope(approver),
            user_id: String(approver.user_id ?? '').trim(),
            enabled: approver.enabled !== false,
            auto_request_payment:
              approver.auto_request_payment === true ||
              approver.auto_record_cash_payment === true,
            auto_record_cash_payment:
              approver.auto_record_cash_payment === true,
          };
        })
        // One entry per user; the first wins.
        .filter((approver) => {
          if (!approver.user_id || seenUsers.has(approver.user_id)) {
            return false;
          }
          seenUsers.add(approver.user_id);
          return true;
        }),
    },
  };
}

/**
 * Why the quotation falls outside a scope, or null when it is within it.
 * Every configured limit must pass; an empty list means "any".
 */
export function approvalScopeViolation(
  scope: ApprovalScope,
  facts: ApprovalFacts,
): string | null {
  if (
    scope.payment_modes.length &&
    (facts.payment_mode === null ||
      !scope.payment_modes.includes(facts.payment_mode))
  ) {
    return 'The payment method is not covered.';
  }
  if (
    scope.product_ids.length &&
    !scope.product_ids.includes(facts.product_id)
  ) {
    return 'The product is not covered.';
  }
  if (
    scope.quotation_flows.length &&
    !scope.quotation_flows.includes(facts.quotation_flow) &&
    !(
      isShortTermQuotation(facts) &&
      scope.quotation_flows.includes(SHORT_TERM_QUOTATION_TYPE)
    )
  ) {
    return 'The quotation type is not covered.';
  }
  if (
    scope.branch_ids.length &&
    (!facts.branch_id || !scope.branch_ids.includes(facts.branch_id))
  ) {
    return 'The branch is not covered.';
  }
  // Every risk must be covered, so a "Short-Term only" rule never matches a
  // quotation that also carries another cover.
  if (
    scope.risk_codes.length &&
    (facts.risk_codes.length === 0 ||
      facts.risk_codes.some(
        (code) => !scope.risk_codes.includes(code.toUpperCase()),
      ))
  ) {
    return 'The risk (cover) is not covered.';
  }
  if (
    scope.max_total_premium !== null &&
    facts.total_premium - scope.max_total_premium > 0.004
  ) {
    return `The premium exceeds the approval limit of ${scope.max_total_premium}.`;
  }
  if (
    scope.max_discount_percent !== null &&
    facts.max_discount_percent - scope.max_discount_percent > 0.000001
  ) {
    return `The discount exceeds the approval limit of ${scope.max_discount_percent}%.`;
  }
  return null;
}

/** The first enabled automatic-approval rule the quotation satisfies. */
export function matchAutoApprovalRule(
  policy: QuotationApprovalPolicy,
  facts: ApprovalFacts,
): AutoApprovalRule | null {
  if (!policy.auto_approval.enabled) return null;
  return (
    policy.auto_approval.rules.find(
      (rule) => rule.enabled && approvalScopeViolation(rule, facts) === null,
    ) ?? null
  );
}

/**
 * Whether `userId` may directly approve: listed and enabled in the policy and
 * the quotation within their limits. The permission is checked by the caller.
 */
export function directApprovalViolation(
  policy: QuotationApprovalPolicy,
  userId: string,
  facts: ApprovalFacts,
): string | null {
  if (!policy.direct_approval.enabled) {
    return 'Direct approval is not enabled for this company.';
  }
  const approver = policy.direct_approval.approvers.find(
    (item) => item.user_id === userId,
  );
  if (!approver || !approver.enabled) {
    return 'You are not authorised to approve quotations directly.';
  }
  return approvalScopeViolation(approver, facts);
}

/**
 * Short-Term (In-Transit) is not a line of its own: it is a Single or Fleet
 * motor quotation on the Private Vehicle transit risk. Selecting it as a
 * quotation type matches quotations whose every risk is that transit risk.
 */
export const SHORT_TERM_QUOTATION_TYPE = 'SHORT_TERM';
export const SHORT_TERM_RISK_CODE: string = SHORT_TERM_COVER.riskCode;

export function isShortTermQuotation(facts: ApprovalFacts): boolean {
  return (
    facts.risk_codes.length > 0 &&
    facts.risk_codes.every(
      (code) => code.toUpperCase() === SHORT_TERM_RISK_CODE,
    )
  );
}

/**
 * Whether the payment invoice should be created automatically when this
 * quotation is completed by `userId`: an enabled automatic rule with
 * "create invoice automatically" that covers the quotation, or the user's own
 * enabled direct-approval entry with that option and limits covering it.
 * Only the request is automated — payment is still recorded in Finance.
 */
export function autoPaymentRequestSource(
  policy: QuotationApprovalPolicy,
  userId: string | null | undefined,
  facts: ApprovalFacts,
): {
  source: 'RULE' | 'USER';
  rule?: AutoApprovalRule;
  /** Cash quotation and the matching entry also records the payment. */
  recordCash: boolean;
} | null {
  if (policy.auto_approval.enabled) {
    const rule = policy.auto_approval.rules.find(
      (item) =>
        item.enabled &&
        item.auto_request_payment &&
        approvalScopeViolation(item, facts) === null,
    );
    if (rule) {
      return {
        source: 'RULE',
        rule,
        recordCash:
          rule.auto_record_cash_payment &&
          facts.payment_mode === CASH_PAYMENT_MODE,
      };
    }
  }
  if (userId && policy.direct_approval.enabled) {
    const approver = policy.direct_approval.approvers.find(
      (item) => item.user_id === userId,
    );
    if (
      approver?.enabled &&
      approver.auto_request_payment &&
      approvalScopeViolation(approver, facts) === null
    ) {
      return {
        source: 'USER',
        recordCash:
          approver.auto_record_cash_payment &&
          facts.payment_mode === CASH_PAYMENT_MODE,
      };
    }
  }
  return null;
}

/** TIRA payment mode for cash. */
export const CASH_PAYMENT_MODE = 1;
