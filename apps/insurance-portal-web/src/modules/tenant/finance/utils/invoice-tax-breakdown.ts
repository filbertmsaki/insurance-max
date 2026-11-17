import type { FinanceInvoice } from '../types';
interface Charge {
  code: string;
  name: string;
  category: string;
  rate: string;
  baseAmount: string;
  amount: string;
  exempt: boolean;
  exemptionReference: string | null;
}
interface Breakdown {
  schema: string;
  gross: string;
  discount: string;
  net: string;
  tax: string;
  levies: string;
  fees: string;
  total: string;
  rounding?: string;
  lines: { key: string; direction?: string; charges: Charge[] }[];
}
export function invoiceTaxBreakdown(invoice: FinanceInvoice): Breakdown | null {
  const found = (invoice.items ?? [])
    .map((i) => i.line_snapshot?.tax_breakdown)
    .filter(Boolean);
  if (found.length !== 1) return null;
  const b = found[0] as Breakdown;
  return ((invoice.source_type === 'QUOTATION' &&
    b.schema === 'QUOTATION_INVOICE_TAX_V1') ||
    (invoice.source_type === 'ENDORSEMENT' &&
      b.schema === 'ENDORSEMENT_INVOICE_TAX_V1')) &&
    Array.isArray(b.lines)
    ? b
    : null;
}
