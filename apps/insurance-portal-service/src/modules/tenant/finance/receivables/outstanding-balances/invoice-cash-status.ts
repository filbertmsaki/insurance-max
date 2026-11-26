import { InvoiceStatus } from '@insurance-max/contracts';
import type { Invoice } from '../invoices/entities/invoice.entity';
import { financialDecimal } from '../../foundation/currencies/finance-currency-controls';

/** Policy issuance and commission accrual follow confirmed cash against the billed premium. */
export function invoiceCashStatus(
  i: Pick<
    Invoice,
    'status' | 'paid_amount' | 'total_amount' | 'balance_amount'
  >,
) {
  if (
    ![
      InvoiceStatus.PAID,
      InvoiceStatus.OVERPAID,
      InvoiceStatus.PARTIALLY_PAID,
    ].some((status) => status === i.status) ||
    i.paid_amount == null ||
    i.total_amount == null
  )
    return i.status;
  const paid = financialDecimal(i.paid_amount),
    total = financialDecimal(i.total_amount);
  if (paid.gte(total) && financialDecimal(i.balance_amount ?? '0').isZero())
    return paid.gt(total) ? InvoiceStatus.OVERPAID : InvoiceStatus.PAID;
  return paid.gt(0) ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.ISSUED;
}
