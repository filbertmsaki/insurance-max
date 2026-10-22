import { Link } from 'react-router-dom';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { EmptyState } from '@/components/shared/DetailSections';
import {
  displayValue,
  formatDateTime,
  formatMoney,
} from '@/components/shared/detailFormat';
import { financeTableApi } from '@/modules/tenant/finance/api';
import type { FinancePaymentTransaction } from '@/modules/tenant/finance/types';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { QuotationPreviewRecord } from '../types';
import { SectionCard, KeyValueGrid } from './QuotationDetailLayout';

function PaymentTransactions({ quotationId }: { quotationId: string }) {
  const { tableProps } = useServerTable<FinancePaymentTransaction>({
    queryKey: ['finance', 'payments', 'quotation', quotationId],
    fetcher: (params, signal) =>
      financeTableApi.payments(
        { ...params, quotation_id: quotationId },
        signal,
      ),
    defaultSortBy: 'created_at',
  });
  const columns: Column<FinancePaymentTransaction>[] = [
    {
      key: 'transaction_no',
      header: 'Transaction',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <Link
            className="font-medium text-blue-700 hover:underline"
            to={`/apps/finance/payments/${row.id}`}
          >
            {row.transaction_no ?? row.id}
          </Link>
          <p className="mt-1 text-xs text-slate-500">
            {displayValue(row.payment_reference ?? row.provider_reference)}
          </p>
          <dl className="mt-2 space-y-1 text-xs md:hidden">
            <div>
              <dt className="inline text-slate-500">Date: </dt>
              <dd className="inline">
                {formatDateTime(row.received_at ?? row.created_at)}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Method: </dt>
              <dd className="inline">
                {displayValue(row.payment_method)} ·{' '}
                {displayValue(row.provider_code ?? row.provider)}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Status: </dt>
              <dd className="inline">{row.status}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Gateway: </dt>
              <dd className="inline">
                {displayValue(row.provider_transaction_id)}
              </dd>
            </div>
          </dl>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Payment Date',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => formatDateTime(row.received_at ?? row.created_at),
    },
    {
      key: 'provider',
      header: 'Method / Provider',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <>
          {displayValue(row.payment_method)}
          <p className="text-xs text-slate-500">
            {displayValue(row.provider_code ?? row.provider)}
          </p>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.status,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      className: 'w-28 text-right tabular-nums',
      cell: (row) =>
        formatMoney(Number(row.amount), row.currency ?? row.currency_code),
    },
    {
      key: 'gateway',
      header: 'Gateway Reference',
      hideOnMobile: true,
      cell: (row) => displayValue(row.provider_transaction_id),
    },
  ];
  return (
    <DataTable
      {...tableProps}
      columns={columns}
      rowKey={(row) => row.id}
      searchPlaceholder="Search payment transactions"
      showColumnVisibility={false}
      tableClassName="table-fixed md:table-auto [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere]"
      emptyMessage="No payment transactions recorded for this quotation."
    />
  );
}

export function QuotationPaymentTab({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const payment = preview.payment;
  const canReadPayments = useAuthStore((state) =>
    state.hasPermission('payments:read'),
  );
  return (
    <>
      <SectionCard title="Payment Summary">
        <KeyValueGrid
          items={[
            {
              label: 'Total Quotation Premium',
              value: formatMoney(
                preview.premium_summary.total_premium_including_tax,
                preview.premium_summary.currency,
              ),
            },
            {
              label: 'Total Amount Paid',
              value: formatMoney(
                preview.payment?.amount_paid,
                preview.payment?.currency ?? preview.premium_summary.currency,
              ),
            },
            {
              label: 'Outstanding Balance',
              value: formatMoney(
                preview.payment?.outstanding_amount,
                preview.payment?.currency ?? preview.premium_summary.currency,
              ),
            },
            {
              label: 'Quotation Payment Status',
              value: displayValue(
                payment?.quotation_payment_status ??
                  preview.overview.payment_status,
              ),
            },
            {
              label: 'Payment Status',
              value: displayValue(payment?.payment_status),
            },
            {
              label: 'Payment Method',
              value: displayValue(payment?.payment_method),
            },
            {
              label: 'Payment Reference / Control Number',
              value: displayValue(payment?.payment_reference),
            },
            {
              label: 'Last Payment Date',
              value: formatDateTime(payment?.payment_date),
            },
            {
              label: 'Receipt Number',
              value: displayValue(payment?.receipt_number),
            },
            {
              label: 'Invoice Number',
              value: displayValue(payment?.invoice_number),
            },
            {
              label: 'Verification Status',
              value: displayValue(payment?.verification_status),
            },
            {
              label: 'Currency',
              value: displayValue(
                payment?.currency ?? preview.premium_summary.currency,
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Payment Transactions"
        description="Recorded transactions linked to this quotation. Invoice balances reflect posted receipt allocations."
      >
        {canReadPayments ? (
          <PaymentTransactions quotationId={preview.overview.quotation_id} />
        ) : (
          <EmptyState text="Payment transaction history requires payment viewing permission." />
        )}
      </SectionCard>
    </>
  );
}
