import {
  FINANCE_DOCUMENT_TYPES,
  FINANCE_METHOD_CODES,
} from '@insurance-max/contracts';
import { setupObject, setupText, setupUuid } from './finance-setup.types';

export function operatingSettingsIssues(
  answers: Record<string, unknown>,
  currencies?: string[],
  accounts?: string[],
) {
  const issues: string[] = [];
  const rows = (key: string) => {
    const values = answers[key];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.length > 250 ||
      !values.every(setupObject)
    ) {
      issues.push('Supply valid rows for ' + key + '.');
      return [];
    }
    return values as Record<string, unknown>[];
  };
  const numberRules = rows('numbering');
  const types = numberRules.map((r) => r.documentType);
  if (
    types.length !== FINANCE_DOCUMENT_TYPES.length ||
    !FINANCE_DOCUMENT_TYPES.every((t) => types.includes(t)) ||
    new Set(numberRules.map((r) => r.prefix)).size !== numberRules.length ||
    numberRules.some(
      (r) =>
        !setupText(r.prefix, 10) ||
        !/^[A-Z][A-Z0-9]*$/.test(r.prefix) ||
        !['YEAR', 'MONTH', 'LIFETIME'].includes(String(r.reset)) ||
        !Number.isInteger(r.width) ||
        Number(r.width) < 1 ||
        Number(r.width) > 12,
    )
  )
    issues.push(
      'Define a distinct alphanumeric prefix, reset cycle and digit width for each financial document.',
    );
  const terms = rows('paymentTerms');
  if (
    new Set(terms.map((r) => r.code)).size !== terms.length ||
    terms.some(
      (r) =>
        !setupText(r.code, 30) ||
        !/^[A-Z0-9_]+$/.test(r.code) ||
        !setupText(r.label, 100) ||
        !['CUSTOMER', 'SUPPLIER'].includes(String(r.party)) ||
        !Number.isInteger(r.days) ||
        Number(r.days) < 0 ||
        Number(r.days) > 3660 ||
        typeof r.isDefault !== 'boolean',
    ) ||
    ['CUSTOMER', 'SUPPLIER'].some(
      (p) => terms.filter((r) => r.party === p && r.isDefault).length !== 1,
    )
  )
    issues.push(
      'Define customer and supplier terms with unique codes, calendar days and one default per party type.',
    );
  const assignments = answers.termAssignments ?? [];
  if (
    !Array.isArray(assignments) ||
    assignments.length > 500 ||
    assignments.some(
      (r) =>
        !setupObject(r) ||
        !setupUuid(r.partyId) ||
        !terms.some((t) => t.code === r.termCode && t.party === r.party),
    ) ||
    new Set(assignments.map((r) => r?.party + '/' + r?.partyId)).size !==
      assignments.length
  )
    issues.push(
      'Assign at most one applicable term to each customer or supplier.',
    );
  const methods = rows('paymentMethods');
  if (
    new Set(methods.map((r) => r.method)).size !== methods.length ||
    methods.some(
      (r) =>
        !FINANCE_METHOD_CODES.some((m) => m === r.method) ||
        !['INCOMING', 'OUTGOING', 'BOTH'].includes(String(r.direction)) ||
        typeof r.referenceRequired !== 'boolean' ||
        !setupText(r.accountCode, 64) ||
        (accounts && !accounts.includes(r.accountCode)),
    ) ||
    ['INCOMING', 'OUTGOING'].some(
      (d) => !methods.some((r) => r.direction === d || r.direction === 'BOTH'),
    )
  )
    issues.push(
      'Enable incoming and outgoing payment methods and select a posting account from the reviewed chart for each.',
    );
  const approval = rows('approvalLimits');
  if (
    approval.some(
      (r) =>
        ![
          'REFUND',
          'COMMISSION_PAYMENT',
          'COMMISSION_ACCRUAL',
          'RECONCILIATION',
          'CLAIM_PAYMENT',
          'REINSURANCE_SETTLEMENT',
        ].includes(String(r.action)) ||
        !setupText(r.currency, 3) ||
        !/^[A-Z]{3}$/.test(r.currency) ||
        (currencies && !currencies.includes(r.currency)) ||
        !setupText(r.role, 100) ||
        !setupText(r.maximum, 40) ||
        !/^(?:0|[1-9]\d{0,22})(?:\.\d{1,4})?$/.test(r.maximum) ||
        !/[1-9]/.test(r.maximum),
    ) ||
    new Set(approval.map((r) => [r.action, r.currency, r.role].join('/')))
      .size !== approval.length ||
    [
      'REFUND',
      'COMMISSION_PAYMENT',
      'COMMISSION_ACCRUAL',
      'RECONCILIATION',
    ].some((a) => !approval.some((r) => r.action === a))
  )
    issues.push(
      'Assign an approval role, currency and positive maximum to each financial approval action.',
    );
  return issues;
}
