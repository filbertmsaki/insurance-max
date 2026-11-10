import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import {
  displayValue,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/components/shared/detailFormat';
import { SummaryPill } from '@/components/record-summary/RecordSummaryHeader';
import { tiraState } from '@/components/record-summary/record-summary';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { PdfDocumentActions } from '@/modules/shared/documents/PdfDocumentActions';
import { claimsApi } from '@/modules/tenant/claims/api';
import { claimsPaths } from '@/modules/tenant/claims/paths';
import type { ClaimListItem } from '@/modules/tenant/claims/types';
import { CoverNotesSection } from '@/modules/tenant/cover-notes/components/CoverNotesSection';
import { financeTableApi } from '@/modules/tenant/finance/api';
import type {
  FinanceInvoice,
  FinancePaymentTransaction,
} from '@/modules/tenant/finance/types';
import {
  KeyValueGrid,
  SectionCard,
} from '@/modules/tenant/quotations/components/QuotationDetailLayout';
import type { PolicyRecord, PolicyVersionRecord } from '../types';
import { usePolicyInvoices } from './usePolicyInvoices';

const financePaths = {
  invoice: (id: string) => `/apps/finance/invoices/${id}`,
  receipt: (id: string) => `/apps/finance/receipts/${id}`,
  payment: (id: string) => `/apps/finance/payments/${id}`,
};

function NoAccess({ what }: { what: string }) {
  return (
    <p className="text-sm text-slate-500">
      You do not have permission to view {what}.
    </p>
  );
}

/* ------------------------------ Claims ---------------------------------- */

export function PolicyClaimsTab({ policyId }: { policyId: string }) {
  const canRead = useAuthStore((s) => s.hasPermission('claims:read'));
  if (!canRead)
    return (
      <SectionCard title="Claims">
        <NoAccess what="claims" />
      </SectionCard>
    );
  return <ClaimsTable policyId={policyId} />;
}

function ClaimsTable({ policyId }: { policyId: string }) {
  const { tableProps } = useServerTable<ClaimListItem>({
    queryKey: ['claims', 'policy', policyId],
    fetcher: (params, signal) =>
      claimsApi.list({ ...params, policy_id: policyId }, signal),
    defaultSortBy: 'created_at',
  });
  const columns: Column<ClaimListItem>[] = [
    {
      key: 'claim_no',
      header: 'Claim No.',
      cell: (row) => (
        <Link
          className="font-semibold text-[#3B4A8C] hover:underline"
          to={claimsPaths.detail(row.id)}
        >
          {row.claim_no}
        </Link>
      ),
    },
    {
      key: 'loss_date',
      header: 'Loss Date',
      hideOnMobile: true,
      cell: (row) => formatDate(row.loss_date),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'estimated_amount',
      header: 'Estimated',
      className: 'text-right',
      hideOnMobile: true,
      cell: (row) => formatMoney(Number(row.estimated_amount ?? 0)),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      className: 'text-right',
      cell: (row) => formatMoney(Number(row.paid_amount ?? 0)),
    },
  ];
  return (
    <SectionCard title="Claims">
      <DataTable
        {...tableProps}
        columns={columns}
        rowKey={(row) => row.id}
        showColumnVisibility={false}
        searchPlaceholder="Search claims"
        emptyMessage="No claims have been registered on this policy."
      />
    </SectionCard>
  );
}

/* ---------------------------- Documents --------------------------------- */

function DocumentRow({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <FileText
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {title}
          </p>
          {meta && <p className="mt-0.5 text-[13px] text-slate-500">{meta}</p>}
        </div>
      </div>
      {children}
    </li>
  );
}

export function PolicyDocumentsTab({ policy }: { policy: PolicyRecord }) {
  const { invoices } = usePolicyInvoices(policy.id);
  return (
    <SectionCard
      title="Documents"
      description="Cover notes are listed under TIRA."
    >
      <ul className="divide-y divide-slate-100">
        <DocumentRow
          title={`Policy schedule · ${policy.policy_no}`}
          meta="Policy PDF"
        >
          <PdfDocumentActions
            base={`/tenant/policies/${policy.id}/schedule`}
            number={policy.policy_no}
            noun="policy schedule"
            filePrefix="Policy"
          />
        </DocumentRow>
        {invoices.map((invoice) => (
          <DocumentRow
            key={invoice.id}
            title={`Invoice · ${invoice.invoice_no}`}
            meta={
              <>
                {displayValue(invoice.status)} ·{' '}
                {formatMoney(
                  Number(invoice.total_amount),
                  invoice.currency ?? invoice.currency_code ?? policy.currency,
                )}{' '}
                ·{' '}
                <Link
                  className="text-blue-700 hover:underline"
                  to={financePaths.invoice(invoice.id)}
                >
                  Open invoice
                </Link>
              </>
            }
          >
            <PdfDocumentActions
              base={`/tenant/finance/invoices/${invoice.id}/document`}
              number={invoice.invoice_no}
              noun="tax invoice"
              filePrefix="Invoice"
            />
          </DocumentRow>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ----------------------------- Payments --------------------------------- */

function PaymentTransactions({ policyId }: { policyId: string }) {
  const { tableProps } = useServerTable<FinancePaymentTransaction>({
    queryKey: ['finance', 'payments', 'policy', policyId],
    fetcher: (params, signal) =>
      financeTableApi.payments({ ...params, policy_id: policyId }, signal),
    defaultSortBy: 'created_at',
  });
  const columns: Column<FinancePaymentTransaction>[] = [
    {
      key: 'transaction_no',
      header: 'Transaction',
      cell: (row) => (
        <Link
          className="font-medium text-blue-700 hover:underline"
          to={financePaths.payment(row.id)}
        >
          {row.transaction_no ?? row.id}
        </Link>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      hideOnMobile: true,
      cell: (row) => formatDateTime(row.received_at ?? row.created_at),
    },
    {
      key: 'provider',
      header: 'Method',
      hideOnMobile: true,
      cell: (row) => displayValue(row.payment_method ?? row.provider),
    },
    { key: 'status', header: 'Status', cell: (row) => row.status },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right tabular-nums',
      cell: (row) =>
        formatMoney(Number(row.amount), row.currency ?? row.currency_code),
    },
  ];
  return (
    <DataTable
      {...tableProps}
      columns={columns}
      rowKey={(row) => row.id}
      showColumnVisibility={false}
      searchPlaceholder="Search payment transactions"
      emptyMessage="No payment transactions recorded for this policy."
    />
  );
}

export function PolicyPaymentsTab({ policy }: { policy: PolicyRecord }) {
  const { canRead, invoices } = usePolicyInvoices(policy.id);
  const canReadPayments = useAuthStore((s) => s.hasPermission('payments:read'));
  const sum = (key: keyof FinanceInvoice) =>
    invoices.reduce((total, invoice) => total + (Number(invoice[key]) || 0), 0);
  const amount = (
    label: string,
    value: number,
    tone?: 'danger' | 'success',
  ) => (
    <div className="min-w-0 rounded-lg border border-[#E6E8EF] bg-white p-4">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd
        className={
          'mt-1 text-xl font-bold tabular-nums ' +
          (tone === 'danger'
            ? 'text-[#B42318]'
            : tone === 'success'
              ? 'text-[#146C43]'
              : 'text-slate-900')
        }
      >
        {formatMoney(value, policy.currency)}
      </dd>
    </div>
  );
  const balance = sum('balance_amount');
  return (
    <div className="space-y-4">
      <SectionCard title="Payment summary">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {amount('Total premium', Number(policy.total_premium))}
          {canRead &&
            amount(
              'Amount paid',
              sum('paid_amount'),
              balance <= 0 ? 'success' : undefined,
            )}
          {canRead &&
            amount(
              'Outstanding balance',
              balance,
              balance > 0 ? 'danger' : undefined,
            )}
        </dl>
        {canRead && invoices.length > 0 && (
          <ul className="mt-4 space-y-1 text-[13px]">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  className="font-semibold text-blue-700 hover:underline"
                  to={financePaths.invoice(invoice.id)}
                >
                  {invoice.invoice_no}
                </Link>{' '}
                · {displayValue(invoice.status)}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Payment transactions">
        {canReadPayments ? (
          <PaymentTransactions policyId={policy.id} />
        ) : (
          <NoAccess what="payment transactions" />
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------- TIRA ----------------------------------- */

export function PolicyTiraTab({
  policy,
  retry,
}: {
  policy: PolicyRecord;
  retry?: { label: string; onClick: () => void; pending?: boolean } | null;
}) {
  const state = tiraState(policy.tira_status || policy.tiramis_status);
  const tone =
    state === 'success'
      ? 'success'
      : state === 'failed'
        ? 'danger'
        : state === 'pending'
          ? 'progress'
          : 'muted';
  const label =
    state === 'success'
      ? 'Success'
      : state === 'failed'
        ? 'Failed'
        : state === 'pending'
          ? 'Pending'
          : 'Not submitted';
  return (
    <div className="space-y-4">
      <SectionCard title="TIRA status">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SummaryPill tone={tone}>{label}</SummaryPill>
          {retry && state === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              disabled={retry.pending}
              onClick={retry.onClick}
            >
              {retry.pending ? 'Retrying…' : retry.label}
            </Button>
          )}
        </div>
        {state === 'failed' && policy.tiramis_last_error_message && (
          <div
            role="alert"
            className="mb-3 rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318]"
          >
            {policy.tiramis_final_response_status_code && (
              <p className="font-semibold">
                Code: {policy.tiramis_final_response_status_code}
              </p>
            )}
            <p className="[overflow-wrap:anywhere]">
              {policy.tiramis_last_error_message}
            </p>
          </div>
        )}
        <KeyValueGrid
          items={[
            { label: 'Cover note no.', value: policy.cover_note_no },
            { label: 'Sticker no.', value: policy.sticker_no },
            { label: 'Request ID', value: policy.tiramis_request_id },
            { label: 'Transaction ID', value: policy.tiramis_transaction_id },
            {
              label: 'Last synced',
              value: policy.tiramis_last_synced_at
                ? formatDateTime(policy.tiramis_last_synced_at)
                : null,
            },
            { label: 'Regulatory sync', value: policy.regulatory_sync_status },
          ]}
        />
        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Integration details
          </summary>
          <div className="mt-4">
            <KeyValueGrid
              items={[
                { label: 'Service type', value: policy.tiramis_service_type },
                { label: 'Root element', value: policy.tiramis_root_element },
                {
                  label: 'Acknowledgement code',
                  value: policy.tiramis_acknowledgement_status_code,
                },
                {
                  label: 'Acknowledgement description',
                  value: policy.tiramis_acknowledgement_status_desc,
                },
                {
                  label: 'Final response ID',
                  value: policy.tiramis_final_response_id,
                },
                {
                  label: 'Final response code',
                  value: policy.tiramis_final_response_status_code,
                },
                {
                  label: 'Final response description',
                  value: policy.tiramis_final_response_status_desc,
                },
              ]}
            />
          </div>
        </details>
      </SectionCard>
      <div className="min-w-0 rounded-xl border border-[#E6E8EF] bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Cover notes
        </h2>
        <CoverNotesSection policyId={policy.id} hideHeader />
      </div>
    </div>
  );
}

/* ------------------------------ History --------------------------------- */

export function PolicyHistoryTab({
  policy,
  versions,
}: {
  policy: PolicyRecord;
  versions: PolicyVersionRecord[];
}) {
  return (
    <div className="space-y-4">
      <SectionCard title="Status history">
        <ActivityTimeline
          emptyText="No history yet."
          renderStatus={(status) => <StatusBadge status={status} />}
          entries={(policy.status_history ?? []).map((entry) => ({
            id: entry.id,
            dateTime: entry.created_at,
            action: 'Status changed',
            previousStatus: entry.old_status,
            newStatus: entry.new_status,
            performedBy: entry.changer
              ? `${entry.changer.first_name} ${entry.changer.last_name}`
              : 'System',
            remarks: entry.reason,
          }))}
        />
      </SectionCard>
      <SectionCard title="Contract versions">
        {versions.length ? (
          <ul className="divide-y divide-slate-100">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-[14px] font-semibold">
                    Version {version.version_number} ·{' '}
                    {displayValue(version.version_type)}
                  </p>
                  <p className="text-[13px] text-slate-500">
                    {formatDate(version.effective_from)} –{' '}
                    {formatDate(version.effective_to)}
                    {version.regulatory_reference
                      ? ` · Cover note ${version.regulatory_reference}`
                      : ''}
                  </p>
                </div>
                {version.is_current && (
                  <SummaryPill tone="success" size="sm">
                    Current
                  </SummaryPill>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No policy versions are available.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
