import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate, formatMoney } from '@/components/shared/detailFormat';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwriteApi } from '../api';
import {
  useUnderwriteCancellations,
  useUnderwriteEndorsements,
  useUnderwriteLineParam,
  useUnderwriteRenewals,
  useUnderwriteTiraQueue,
} from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import type {
  UnderwritePolicyTransactionRow,
  UnderwriteRenewalRow,
  UnderwriteTiraQueueRow,
} from '../types';

type TransactionListKind = 'renewals' | 'endorsements' | 'cancellations';
type TiraListKind = 'failed' | 'pending';

function pretty(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'N/A';
}

function statusVariant(value: string | null | undefined) {
  if (!value) return 'outline' as const;
  if (/(FAILED|REJECTED|CANCELLED|RETRYABLE)/.test(value)) {
    return 'danger' as const;
  }
  if (/(PENDING|PROCESSING|QUEUED|READY|ACKNOWLEDGED|SENT)/.test(value)) {
    return 'warning' as const;
  }
  if (/(APPROVED|ACCEPTED|RENEWED|APPLIED|COMPLETED|SUCCESS)/.test(value)) {
    return 'success' as const;
  }
  return 'secondary' as const;
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  return <Badge variant={statusVariant(value)}>{pretty(value)}</Badge>;
}

function useLocalPage<T>(rows: T[] | undefined) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const data = useMemo(() => rows ?? [], [rows]);
  const totalPages = Math.max(1, Math.ceil(data.length / limit));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => data.slice((currentPage - 1) * limit, currentPage * limit),
    [data, currentPage, limit],
  );

  return {
    page: currentPage,
    limit,
    total: data.length,
    totalPages,
    data: paged,
    setPage,
    setLimit: (value: number) => {
      setLimit(value);
      setPage(1);
    },
  };
}

function RenewalRows({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const query = useUnderwriteRenewals(line.slug);
  const page = useLocalPage(query.data);

  const columns: Column<UnderwriteRenewalRow>[] = [
    {
      key: 'renewal_no',
      header: 'Renewal No.',
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.renewal_no}</span>
      ),
    },
    {
      key: 'policy',
      header: 'Policy',
      cell: (row) => row.policy_transaction?.policy_no ?? 'N/A',
    },
    {
      key: 'period',
      header: 'Renewal Period',
      hideOnMobile: true,
      cell: (row) =>
        `${formatDate(row.renewal_start_date)} - ${formatDate(row.renewal_end_date)}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge value={row.renewal_status} />,
    },
    {
      key: 'created',
      header: 'Created',
      hideOnMobile: true,
      cell: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) =>
        row.policy_transaction?.source_policy_id ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Open renewal ${row.renewal_no}`}
            onClick={() =>
              navigate(
                underwritePaths.policyRenewalDetail(
                  line.slug,
                  row.policy_transaction.source_policy_id,
                  row.id,
                ),
              )
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <WorklistTable
      columns={columns}
      page={page}
      loading={query.isLoading}
      error={query.error ? 'Unable to load renewals' : undefined}
      onRetry={() => void query.refetch()}
      emptyMessage={`No ${line.label.toLowerCase()} renewals found`}
    />
  );
}

function TransactionRows({
  line,
  kind,
  rows,
  loading,
  error,
  onRetry,
}: {
  line: UnderwriteLineMeta;
  kind: Exclude<TransactionListKind, 'renewals'>;
  rows: UnderwritePolicyTransactionRow[] | undefined;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const page = useLocalPage(rows);

  const columns: Column<UnderwritePolicyTransactionRow>[] = [
    {
      key: 'transaction_no',
      header: 'Transaction No.',
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.transaction_no}</span>
      ),
    },
    {
      key: 'policy',
      header: 'Policy',
      cell: (row) => row.policy_no,
    },
    {
      key: 'effective_date',
      header: 'Effective',
      hideOnMobile: true,
      cell: (row) => formatDate(row.effective_date),
    },
    {
      key: 'premium',
      header: 'Net Premium',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMoney(
            Number(row.net_premium_difference ?? 0),
            row.currency_code,
          )}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (row) => <StatusBadge value={row.stage} />,
    },
    {
      key: 'submission',
      header: 'Submission',
      hideOnMobile: true,
      cell: (row) => <StatusBadge value={row.submission_status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open ${row.transaction_no}`}
          onClick={() =>
            navigate(
              kind === 'endorsements'
                ? underwritePaths.policyEndorsementEdit(
                    line.slug,
                    row.source_policy_id,
                    row.id,
                  )
                : underwritePaths.policyCancellationDetail(
                    line.slug,
                    row.source_policy_id,
                    row.id,
                  ),
            )
          }
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <WorklistTable
      columns={columns}
      page={page}
      loading={loading}
      error={
        error
          ? `Unable to load ${kind === 'endorsements' ? 'endorsements' : 'cancellations'}`
          : undefined
      }
      onRetry={onRetry}
      emptyMessage={`No ${line.label.toLowerCase()} ${kind} found`}
    />
  );
}

function EndorsementRows({ line }: { line: UnderwriteLineMeta }) {
  const query = useUnderwriteEndorsements(line.slug);
  return (
    <TransactionRows
      line={line}
      kind="endorsements"
      rows={query.data}
      loading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    />
  );
}

function CancellationRows({ line }: { line: UnderwriteLineMeta }) {
  const query = useUnderwriteCancellations(line.slug);
  return (
    <TransactionRows
      line={line}
      kind="cancellations"
      rows={query.data}
      loading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    />
  );
}

function TiraRows({
  line,
  kind,
}: {
  line: UnderwriteLineMeta;
  kind: TiraListKind;
}) {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const query = useUnderwriteTiraQueue(line.slug, kind);
  const retry = useMutation({
    mutationFn: (row: UnderwriteTiraQueueRow) => {
      if (row.source_kind === 'quotation') {
        return underwriteApi.retryQuotationTira(line.slug, row.id);
      }
      if (row.transaction_type === 'ENDORSEMENT') {
        return underwriteApi.retryEndorsementTiramis(line.slug, row.id);
      }
      return underwriteApi.submitCancellationToTiramis(line.slug, row.id);
    },
    onSuccess: () => {
      toast.success('TIRA submission queued');
      void query.refetch();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const page = useLocalPage(query.data);
  const canRetry = (row: UnderwriteTiraQueueRow) => {
    if (kind !== 'failed') {
      return false;
    }
    if (row.source_kind === 'quotation') {
      return hasPermission('quotations:retry-tiramis');
    }
    if (row.transaction_type === 'ENDORSEMENT') {
      return (
        hasPermission('endorsements:retry-tiramis') ||
        hasPermission('endorsements:reconcile')
      );
    }
    return hasPermission('cancellations:submit-tiramis');
  };

  const columns: Column<UnderwriteTiraQueueRow>[] = [
    {
      key: 'reference_no',
      header: 'Reference',
      cell: (row) => (
        <div className="space-y-1">
          <span className="block font-medium text-slate-900">
            {row.reference_no}
          </span>
          <Badge variant="outline">
            {row.source_kind === 'quotation'
              ? 'Quotation'
              : pretty(row.transaction_type)}
          </Badge>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => row.customer_name ?? 'N/A',
    },
    {
      key: 'request',
      header: 'TIRA Request',
      hideOnMobile: true,
      cell: (row) => row.tira_request_id ?? 'N/A',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge value={row.tira_status} />,
    },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      cell: (row) => formatDate(row.updated_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => {
        const target =
          row.source_kind === 'quotation'
            ? underwritePaths.quotationDetail(line.slug, row.id)
            : row.source_policy_id
              ? underwritePaths.policyDetail(line.slug, row.source_policy_id)
              : null;
        return (
          <div className="flex justify-end gap-1">
            {canRetry(row) ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retry ${row.reference_no}`}
                disabled={retry.isPending}
                onClick={() => retry.mutate(row)}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            ) : null}
            {target ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`View ${row.reference_no}`}
                onClick={() => navigate(target)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <WorklistTable
      columns={columns}
      page={page}
      loading={query.isLoading}
      error={query.error ? `Unable to load TIRA ${kind}` : undefined}
      onRetry={() => void query.refetch()}
      emptyMessage={`No ${line.label.toLowerCase()} TIRA ${kind} items found`}
    />
  );
}

function WorklistTable<T>({
  columns,
  page,
  loading,
  error,
  onRetry,
  emptyMessage,
}: {
  columns: Column<T>[];
  page: ReturnType<typeof useLocalPage<T>>;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  emptyMessage: string;
}) {
  return (
    <DataTable
      columns={columns}
      data={page.data}
      loading={loading}
      error={error}
      onRetry={onRetry}
      page={page.page}
      limit={page.limit}
      total={page.total}
      totalPages={page.totalPages}
      onPageChange={page.setPage}
      onLimitChange={page.setLimit}
      emptyMessage={emptyMessage}
    />
  );
}

const TITLES: Record<TransactionListKind | TiraListKind, string> = {
  renewals: 'renewals',
  endorsements: 'endorsements',
  cancellations: 'cancellations',
  failed: 'TIRA failed',
  pending: 'TIRA pending',
};

export function UnderwriteTransactionsPage({
  kind,
}: {
  kind: TransactionListKind;
}) {
  const line = useUnderwriteLineParam();
  if (!line) return null;

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite - ${line.label}`}
        title={`${line.label} ${TITLES[kind]}`}
        description={line.description}
      />
      {kind === 'renewals' ? (
        <RenewalRows line={line} />
      ) : kind === 'endorsements' ? (
        <EndorsementRows line={line} />
      ) : (
        <CancellationRows line={line} />
      )}
    </div>
  );
}

export function UnderwriteTiraQueuePage({ kind }: { kind: TiraListKind }) {
  const line = useUnderwriteLineParam();
  if (!line) return null;

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite - ${line.label}`}
        title={`${line.label} ${TITLES[kind]}`}
        description={line.description}
      />
      <TiraRows line={line} kind={kind} />
    </div>
  );
}
