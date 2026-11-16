import { BadRequestException } from '@nestjs/common';
import { validatedInvoiceTax } from '../utils/quotation-invoice-tax';
import type { Invoice } from '../entities/invoice.entity';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import {
  BILLING_SCHEMA,
  normalizeQuotationBilling,
  type QuotationBillingSnapshot,
} from './finance-quotation-billing.types';

/** Structural port for the existing QuotationInvoiceService output; no DB read or live hook. */
export interface LegacyQuotationInvoice {
  id: string;
  company_id: string;
  quotation_id: string | null;
  source_type: string;
  source_record_id: string | null;
  source_revision: number | null;
  invoice_type: string;
  invoice_no: string;
  currency: string;
  customer_id: string;
  branch_id: string | null;
  policy_id: string | null;
  status: string;
  state_version: number;
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  charges_amount: string;
  total_amount: string;
  pricing_result_hash: string | null;
  source_snapshot_hash: string | null;
  items: {
    source_line_type: string | null;
    source_line_id: string | null;
    total_amount: string;
    line_snapshot?: Record<string, unknown> | null;
    line_hash?: string | null;
  }[];
}
export function quotationBillingFromLegacyInvoice(
  invoice: LegacyQuotationInvoice,
  context: Pick<
    QuotationBillingSnapshot,
    | 'quotationNumber'
    | 'sourceRevision'
    | 'workflowRevision'
    | 'billingDate'
    | 'decimalScale'
    | 'productId'
    | 'paymentReference'
    | 'legacyJournalEvidence'
  >,
): QuotationBillingSnapshot {
  if (
    invoice.source_type !== 'QUOTATION' ||
    invoice.invoice_type !== 'QUOTATION' ||
    !invoice.quotation_id ||
    invoice.quotation_id !== invoice.source_record_id ||
    !invoice.source_revision ||
    invoice.source_revision > context.workflowRevision ||
    !invoice.source_snapshot_hash
  )
    throw new BadRequestException(
      'Original quotation invoice source evidence is required.',
    );
  const b = validatedInvoiceTax(invoice as unknown as Invoice);
  const sum = (a: string[]) =>
    a.reduce((n, v) => n.plus(v), DecimalUtil.value(0)).toFixed(2);
  return normalizeQuotationBilling({
    ...context,
    schema: BILLING_SCHEMA,
    quotationId: invoice.quotation_id,
    sourceCompanyId: invoice.company_id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_no,
    invoiceSourceRevision: invoice.source_revision,
    invoiceStateVersion: invoice.state_version,
    policyId: invoice.policy_id,
    sourceStatus: invoice.status,
    currency: invoice.currency,
    taxPresentation: 'EXCLUSIVE',
    customerId: invoice.customer_id,
    branchId: invoice.branch_id,
    pricingResultHash: invoice.pricing_result_hash,
    finalizationHash: invoice.source_snapshot_hash,
    components: {
      gross: b.gross,
      discount: b.discount,
      tax: b.statutory,
      charges: b.fees,
      total: b.total,
    },
    lines: b.lines.map((l) => ({
      key: l.key,
      description: l.description,
      gross: l.gross,
      discount: l.discount,
      tax: sum(
        l.charges
          .filter((c) => ['TAX', 'LEVY', 'STAMP_DUTY'].includes(c.category))
          .map((c) => c.amount),
      ),
      charges: sum(
        l.charges
          .filter((c) => !['TAX', 'LEVY', 'STAMP_DUTY'].includes(c.category))
          .map((c) => c.amount),
      ),
      total: l.total,
    })),
  });
}
