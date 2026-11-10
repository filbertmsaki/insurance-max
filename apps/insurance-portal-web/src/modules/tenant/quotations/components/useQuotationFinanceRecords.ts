import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { financeTableApi } from '@/modules/tenant/finance/api';
import type { QuotationPreviewRecord } from '../types';

/**
 * Finance records behind the quotation's invoice and receipt numbers, so they
 * can link to their pages. Uses the existing finance list endpoints: invoices
 * filter by quotation; receipts have no quotation filter, so they are found by
 * an exact receipt-number search.
 */
export function useQuotationFinanceRecords(preview: QuotationPreviewRecord) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const quotationId = preview.overview.quotation_id;
  const receiptNo = preview.payment?.receipt_number?.trim() || null;

  const invoices = useQuery({
    queryKey: ['finance', 'invoices', 'quotation', quotationId],
    queryFn: ({ signal }) =>
      financeTableApi.invoices(
        { quotation_id: quotationId, limit: 20 },
        signal,
      ),
    enabled: hasPermission('invoices:read'),
    staleTime: 30_000,
  });
  const receipts = useQuery({
    queryKey: ['finance', 'receipts', 'number', receiptNo],
    queryFn: ({ signal }) =>
      financeTableApi.receipts({ search: receiptNo!, limit: 5 }, signal),
    enabled: hasPermission('receipts:read') && Boolean(receiptNo),
    staleTime: 30_000,
  });

  const invoiceList = invoices.data?.data ?? [];
  const invoiceNo = preview.payment?.invoice_number?.trim();
  return {
    invoices: invoiceList,
    invoice: invoiceNo
      ? invoiceList.find((invoice) => invoice.invoice_no === invoiceNo)
      : undefined,
    receipt: receipts.data?.data.find((r) => r.receipt_no === receiptNo),
  };
}

export const financePaths = {
  invoice: (id: string) => `/apps/finance/invoices/${id}`,
  receipt: (id: string) => `/apps/finance/receipts/${id}`,
};
