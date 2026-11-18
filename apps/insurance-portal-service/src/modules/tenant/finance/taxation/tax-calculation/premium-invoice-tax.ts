import type { Invoice } from '../../receivables/invoices/entities/invoice.entity';
import { validatedInvoiceTax } from './quotation-invoice-tax';
import { validatedEndorsementInvoiceTax } from './endorsement-invoice-tax';

/** One validation entry point for the premium invoice consumers. */
export const hasPremiumInvoiceTax = (source: string) =>
  ['QUOTATION', 'ENDORSEMENT'].includes(source);
export function validatedPremiumInvoiceTax(invoice: Invoice) {
  return invoice.source_type === 'ENDORSEMENT'
    ? validatedEndorsementInvoiceTax(invoice)
    : validatedInvoiceTax(invoice);
}
