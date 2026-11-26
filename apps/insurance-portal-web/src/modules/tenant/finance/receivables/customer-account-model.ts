import Decimal from 'decimal.js';

export function collectionPercent(amount: string, billed: string) {
  if (!billed || !amount || !new Decimal(billed).gt(0)) return '—';
  return (
    new Decimal(amount)
      .div(billed)
      .times(100)
      .toFixed(2, Decimal.ROUND_HALF_UP) + '%'
  );
}

export const openingColumns = [
  'customerCode',
  'reference',
  'invoiceDate',
  'dueDate',
  'amount',
];
export const names: Record<string, string> = {
  CATEGORY: 'Customer category',
  PROFILE: 'Customer financial profile and credit limit',
  PAYER_MANDATE: 'Third-party payer mandate',
  POLICY: 'Receivables accounting policy',
  DEBIT_NOTE: 'Debit note',
  CREDIT_NOTE: 'Credit note',
  CREDIT_APPLICATION: 'Apply a credit note',
  CREDIT_REFUND: 'Refund unused credit',
  ADVANCE: 'Record a customer advance',
  ADVANCE_APPLICATION: 'Apply an advance',
  ADVANCE_RELEASE: 'Release an advance for refund',
  IMPAIRMENT: 'Assess impairment',
  WRITE_OFF: 'Write off an invoice',
  OPENING_IMPORT: 'Import opening customer invoices',
  OPENING_VOID: 'Correct an unused opening import',
  RECONCILIATION: 'Reconcile an external statement',
  REVERSAL: 'Reverse a customer document',
};
export type Choice = { value: string; label: string };
export type Info = Record<string, string>;
export type Payload = Record<string, unknown>;
export interface ArRow {
  id: string;
  kind: string;
  sequence: string;
  customer_id: string;
  currency: string;
  effective_date: string;
  state: string;
  reference: string;
  amount: string;
  maker_id: string;
  approval_state?: string;
  candidate_id?: string;
  review_reason?: string;
  memorandum_hash?: string;
  data: Payload & { lines: Info[]; openingItems?: Info[] };
}
export interface ArReport {
  totals: Info[];
  aging: Info[];
  agingTotals: Info;
  lines: Info[];
  control: Info;
  balanceExceptions: Info[];
}
export interface Register {
  customers: (Info & { portal_enabled?: boolean })[];
  profiles?: Info[];
  invoices: Info[];
  receipts: Info[];
  documents: ArRow[];
  cases: Info[];
  reminders: Info[];
  staff: Info[];
  roles: Info[];
  evidence: Info[];
  terms: Info[];
  refunds: Info[];
  cashExceptions?: Info[];
  currencies: string[];
  dimensions:
    | { fields: { code: string; label: string; options?: Choice[] }[] }
    | { code: string; label: string; options?: Choice[] }[];
  today: string;
}
export const choices = (rows: object[], label = 'label', id = 'id') =>
  rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { value: String(r[id]), label: String(r[label] ?? r[id]) };
  });
export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export type Send = (
  path: string,
  body: Payload,
  native?: boolean,
) => Promise<void>;
