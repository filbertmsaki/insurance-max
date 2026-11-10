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
  humanizeCode,
} from '../utils/quotationFormat';
import { financeTableApi } from '@/modules/tenant/finance/api';
import type { FinancePaymentTransaction } from '@/modules/tenant/finance/types';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { QuotationPreviewRecord } from '../types';
import { SectionCard, KeyValueGrid } from './QuotationDetailLayout';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import {
  financePaths,
  useQuotationFinanceRecords,
} from './useQuotationFinanceRecords';

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

function Amount({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd
        className={
          'mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere] ' +
          (tone === 'danger'
            ? 'text-red-700'
            : tone === 'success'
              ? 'text-green-700'
              : 'text-slate-900')
        }
      >
        {value}
      </dd>
    </div>
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
  const { invoice, receipt } = useQuotationFinanceRecords(preview);
  const currency = payment?.currency ?? preview.premium_summary.currency;
  const outstanding = payment?.outstanding_amount ?? null;
  const reference = (
    value: string | null | undefined,
    href: string | undefined,
  ) =>
    value && href ? (
      <Link className="text-blue-700 hover:underline" to={href}>
        {value}
      </Link>
    ) : (
      displayValue(value)
    );

  return (
    <>
      <SectionCard title="Payment summary">
        <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Amount
            label="Total premium"
            value={formatMoney(
              preview.premium_summary.total_premium_including_tax,
              preview.premium_summary.currency,
            )}
          />
          <Amount
            label="Amount paid"
            value={formatMoney(payment?.amount_paid ?? 0, currency)}
            tone={
              preview.overview.payment_status === 'PAID' ? 'success' : undefined
            }
          />
          <Amount
            label="Outstanding balance"
            value={formatMoney(outstanding ?? 0, currency)}
            tone={outstanding && outstanding > 0 ? 'danger' : undefined}
          />
        </dl>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <PaymentStatusBadge
            status={
              payment?.quotation_payment_status ??
              preview.overview.payment_status
            }
          />
          {payment?.verification_status ? (
            <span className="text-[13px] text-slate-600">
              Verification: {humanizeCode(payment.verification_status)}
            </span>
          ) : null}
        </div>
        <KeyValueGrid
          items={[
            {
              label: 'Payment status',
              value: payment?.payment_status
                ? humanizeCode(payment.payment_status)
                : null,
            },
            {
              label: 'Payment method',
              value: payment?.payment_method
                ? humanizeCode(payment.payment_method)
                : null,
            },
            {
              label: 'Last payment date',
              value: formatDateTime(payment?.payment_date),
            },
            { label: 'Currency', value: displayValue(currency) },
          ]}
        />
        <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          References
        </h3>
        <KeyValueGrid
          items={[
            {
              label: 'Invoice number',
              value: reference(
                payment?.invoice_number,
                invoice && financePaths.invoice(invoice.id),
              ),
            },
            {
              label: 'Receipt number',
              value: reference(
                payment?.receipt_number,
                receipt && financePaths.receipt(receipt.id),
              ),
            },
            {
              label: 'Payment reference / control number',
              value: displayValue(payment?.payment_reference),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Payment transactions"
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
