import { BadRequestException } from '@nestjs/common';
import { approvalFields, APPROVAL_HASH } from './finance-approval.types';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  isFinanceDate,
} from './finance-configuration.types';
import {
  candidateAmount,
  candidateRevision,
  candidateText,
} from './finance-journal-candidate.types';
export const BILLING_EVENT = 'source.quotation.billing-snapshotted.v1';
export const BILLING_SCHEMA = 'FINANCE_QUOTATION_BILLING_V1';
export const BILLING_HOLDS = Object.freeze([
  'UNRESOLVED_ACCOUNTING_POLICIES',
  'B43_CURRENCY_FOUNDATION_PENDING',
  'B44_CORE_REPORTING_PENDING',
  'B45_FOUNDATION_ACCEPTANCE_PENDING',
  'LEGAL_RECOGNITION_UNASSIGNED',
  'LEGACY_EFFECTS_NOT_RECONCILED',
]);
export interface BillingProfile {
  schema: 'FINANCE_QUOTATION_BILLING_RULES_V1';
  purpose: 'MEMORANDUM_ONLY';
  recognition: 'HELD_INACTIVE';
  maxLines: number;
}
export interface BillingComponents {
  gross: string;
  discount: string;
  tax: string | null;
  charges: string;
  total: string;
}
export interface BillingLine extends BillingComponents {
  key: string;
  description: string;
}
export interface QuotationBillingSnapshot {
  schema: typeof BILLING_SCHEMA;
  quotationId: string;
  quotationNumber: string;
  sourceCompanyId: string;
  sourceRevision: number;
  workflowRevision: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceSourceRevision: number | null;
  invoiceStateVersion: number | null;
  policyId: string | null;
  sourceStatus:
    | 'DRAFT'
    | 'REQUESTED'
    | 'ISSUED'
    | 'PAID'
    | 'PARTIALLY_PAID'
    | 'OVERPAID'
    | 'VOIDED'
    | 'CANCELLED';
  billingDate: string;
  currency: string;
  decimalScale: number;
  taxPresentation: 'EXCLUSIVE' | 'INCLUSIVE' | 'UNSPLIT';
  productId: string;
  customerId: string;
  branchId: string | null;
  pricingResultHash: string | null;
  finalizationHash: string;
  paymentReference: {
    id: string;
    currency: string;
    amount: string;
    state: 'REQUESTED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  } | null;
  legacyJournalEvidence: {
    state: 'NOT_ASSESSED' | 'DECLARED_NONE' | 'PRESENT';
    references: { id: string; hash: string }[];
  };
  components: BillingComponents;
  lines: BillingLine[];
}
function fail(): never {
  throw new BadRequestException(
    'An exact, balanced, explicitly scoped quotation memorandum snapshot is required; rounding and accounting elections are unsupported.',
  );
}
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && FINANCE_UUID.test(v);
const digest = (v: unknown): v is string =>
  typeof v === 'string' && APPROVAL_HASH.test(v);
export function billingProfile(value: unknown, deps: string[]): BillingProfile {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, ['schema', 'purpose', 'recognition', 'maxLines']);
  if (
    p.schema !== 'FINANCE_QUOTATION_BILLING_RULES_V1' ||
    p.purpose !== 'MEMORANDUM_ONLY' ||
    p.recognition !== 'HELD_INACTIVE' ||
    !Number.isInteger(p.maxLines) ||
    Number(p.maxLines) < 1 ||
    Number(p.maxLines) > 500 ||
    !['DEC-01', 'DEC-12', 'DEC-14'].every((d) => deps.includes(d))
  )
    fail();
  return p as unknown as BillingProfile;
}
export function normalizeQuotationBilling(
  value: unknown,
): QuotationBillingSnapshot {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'quotationId',
    'quotationNumber',
    'sourceCompanyId',
    'sourceRevision',
    'workflowRevision',
    'invoiceId',
    'invoiceNumber',
    'invoiceSourceRevision',
    'invoiceStateVersion',
    'policyId',
    'sourceStatus',
    'billingDate',
    'currency',
    'decimalScale',
    'taxPresentation',
    'productId',
    'customerId',
    'branchId',
    'pricingResultHash',
    'finalizationHash',
    'paymentReference',
    'legacyJournalEvidence',
    'components',
    'lines',
  ]);
  if (
    p.invoiceId === null
      ? p.invoiceSourceRevision !== null || p.invoiceStateVersion !== null
      : !candidateRevision(p.invoiceSourceRevision) ||
        !candidateRevision(p.invoiceStateVersion) ||
        Number(p.invoiceSourceRevision) > Number(p.workflowRevision)
  )
    fail();
  if (
    p.schema !== BILLING_SCHEMA ||
    ![p.quotationId, p.sourceCompanyId, p.productId, p.customerId].every(
      uuid,
    ) ||
    !candidateText(p.quotationNumber) ||
    !candidateRevision(p.sourceRevision) ||
    !candidateRevision(p.workflowRevision) ||
    !(p.invoiceId === null || uuid(p.invoiceId)) ||
    !(p.policyId === null || uuid(p.policyId)) ||
    !(p.branchId === null || uuid(p.branchId)) ||
    !(p.invoiceNumber === null || candidateText(p.invoiceNumber)) ||
    (p.invoiceId === null) !== (p.invoiceNumber === null) ||
    ![
      'DRAFT',
      'REQUESTED',
      'ISSUED',
      'PAID',
      'PARTIALLY_PAID',
      'OVERPAID',
      'VOIDED',
      'CANCELLED',
    ].includes(p.sourceStatus as string) ||
    !isFinanceDate(p.billingDate) ||
    typeof p.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !Number.isInteger(p.decimalScale) ||
    Number(p.decimalScale) < 0 ||
    Number(p.decimalScale) > 12 ||
    !['EXCLUSIVE', 'INCLUSIVE', 'UNSPLIT'].includes(
      p.taxPresentation as string,
    ) ||
    !(p.pricingResultHash === null || digest(p.pricingResultHash)) ||
    !digest(p.finalizationHash) ||
    !Array.isArray(p.lines) ||
    p.lines.length < 1 ||
    p.lines.length > 500
  )
    fail();
  const taxPresentation = p.taxPresentation;
  const scale = Number(p.decimalScale),
    keys = ['gross', 'discount', 'tax', 'charges', 'total'];
  function components(
    v: unknown,
    line = false,
  ): { value: BillingComponents; units: Record<string, bigint> } {
    approvalFields(v, line ? [...keys, 'key', 'description'] : keys);
    const units: Record<string, bigint> = {};
    for (const k of keys) {
      if (k === 'tax' && taxPresentation === 'UNSPLIT') {
        if (v[k] !== null) fail();
        units[k] = 0n;
      } else {
        if (v[k] === null) fail();
        const amount = candidateAmount(v[k], scale);
        v[k] = amount.stored;
        units[k] = amount.units;
      }
    }
    if (
      units.discount > units.gross ||
      units.total !==
        units.gross -
          units.discount +
          units.charges +
          (taxPresentation === 'EXCLUSIVE' ? units.tax : 0n) ||
      (taxPresentation === 'INCLUSIVE' &&
        units.tax > units.gross - units.discount)
    )
      fail();
    return { value: v as unknown as BillingComponents, units };
  }
  const header = components(p.components),
    totals: Record<string, bigint> = Object.fromEntries(
      keys.map((k) => [k, 0n]),
    ),
    seen = new Set();
  for (const line of p.lines) {
    const normalized = components(line, true);
    if (
      !candidateText(line.key, 80) ||
      seen.has(line.key) ||
      !candidateText(line.description, 500)
    )
      fail();
    seen.add(line.key);
    for (const k of keys) totals[k] += normalized.units[k];
  }
  if (keys.some((k) => totals[k] !== header.units[k])) fail();
  if (p.paymentReference !== null) {
    approvalFields(p.paymentReference, ['id', 'currency', 'amount', 'state']);
    if (
      !uuid(p.paymentReference.id) ||
      p.paymentReference.currency !== p.currency ||
      !['REQUESTED', 'ACTIVE', 'EXPIRED', 'CANCELLED'].includes(
        p.paymentReference.state as string,
      )
    )
      fail();
    p.paymentReference.amount = candidateAmount(
      p.paymentReference.amount,
      scale,
    ).stored;
  }
  approvalFields(p.legacyJournalEvidence, ['state', 'references']);
  const evidence = p.legacyJournalEvidence;
  if (
    !['NOT_ASSESSED', 'DECLARED_NONE', 'PRESENT'].includes(
      evidence.state as string,
    ) ||
    !Array.isArray(evidence.references) ||
    evidence.references.length > 100 ||
    (evidence.state === 'PRESENT') !== evidence.references.length > 0
  )
    fail();
  const refs = new Set();
  for (const r of evidence.references) {
    approvalFields(r, ['id', 'hash']);
    if (!uuid(r.id) || !digest(r.hash) || refs.has(r.id)) fail();
    refs.add(r.id);
  }
  return p as unknown as QuotationBillingSnapshot;
}
