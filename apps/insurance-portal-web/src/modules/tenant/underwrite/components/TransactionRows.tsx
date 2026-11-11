import { useMemo } from 'react';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  DateCell,
  ListPage,
  TiraBadge,
  ToneBadge,
  TwoLineCell,
  humanizeStatus,
  paymentStateOf,
  registerColumns,
  statusTone,
  tiraStateOf,
  type Chip,
  type FilterDef,
  type ListColumn,
  type ListQuery,
  type RecordKind,
  type RowAction,
} from '@/components/list-page';
import { formatMoney } from '@/components/shared/detailFormat';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { TransactionListSource } from '../pages/transaction-list-source';
import type {
  UnderwritePolicyTransactionRow,
  UnderwriteRenewalRow,
  UnderwriteTiraQueueRow,
} from '../types';

/*
 * Renewal, endorsement, cancellation and TIRA registers on the standard list
 * page, shared by the Motor Insurance and Non-Motor transaction pages.
 */

/** Title, breadcrumb and Single / Fleet chips supplied by the page. */
export interface RegisterHeader {
  title: string;
  description?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  stateKey: string;
  typeChips?: Chip[];
}

const SUMMARY_CHIPS: Chip[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'tira_failed', label: 'TIRA failed' },
  { id: 'drafts', label: 'Drafts' },
];

const TIRA_FILTER: FilterDef = {
  kind: 'select',
  key: 'tira_state',
  label: 'TIRA status',
  allLabel: 'Any TIRA status',
  options: [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
    { value: 'not_submitted', label: 'Not submitted' },
  ],
};

const DATE_FILTER: FilterDef = {
  kind: 'date-range',
  fromKey: 'date_from',
  toKey: 'date_to',
  label: 'Date issued',
};

const statusFilter = (values: string[]): FilterDef => ({
  kind: 'select',
  key: 'status',
  label: 'Status',
  allLabel: 'All statuses',
  options: values.map((value) => ({ value, label: humanizeStatus(value) })),
});

const STAGE_FILTER = statusFilter([
  'DRAFT',
  'SUBMISSION_PROCESSING',
  'COMPLETED',
  'APPLIED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]);

const RENEWAL_STATUS_FILTER = statusFilter([
  'ELIGIBLE',
  'OFFER_DRAFT',
  'OFFER_READY',
  'OFFER_SENT',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_DECLINED',
  'PAYMENT_PENDING',
  'SUBMISSION_PROCESSING',
  'RENEWED',
  'LAPSED',
  'CANCELLED',
]);

function kindOf(line: string | null | undefined): RecordKind | undefined {
  if (line === 'FLEET') return 'fleet';
  if (line === 'NON_MOTOR') return 'non_motor';
  if (line === 'MOTOR') return 'single';
  return undefined;
}

function registerParams(query: ListQuery) {
  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    view: query.view,
    type: query.type,
    include_summary: true,
    ...query.filters,
  };
}

const money = (
  value: string | number | null | undefined,
  currency?: string | null,
) => formatMoney(Number(value ?? 0), currency || 'TZS');

/** Signed premium change: "+ TSh 5,000.00" / "− TSh 2,000.00". */
function signedMoney(
  value: string | null | undefined,
  currency?: string | null,
) {
  const amount = Number(value ?? 0);
  if (!amount) return money(0, currency);
  return `${amount > 0 ? '+' : '−'} ${money(Math.abs(amount), currency)}`;
}

export function TransactionRows({
  source,
  kind,
  header,
}: {
  source: TransactionListSource;
  kind: 'endorsements' | 'cancellations';
  header: RegisterHeader;
}) {
  const endorsement = kind === 'endorsements';
  const register = useMemo(
    () =>
      registerColumns<UnderwritePolicyTransactionRow>({
        recordHeader: endorsement ? 'Endorsement no.' : 'Cancellation no.',
        record: (row) => row.transaction_no,
        kind: (row) => kindOf(row.business_line) ?? 'single',
        recordSortKey: 'transaction_no',
        customer: (row) => ({
          name: row.customer_name || 'No customer',
          secondary:
            row.customer_phone || row.customer_id_number || row.policy_no,
        }),
        issued: (row) => row.created_at,
        issuedSortKey: 'created_at',
        cover: (row) => ({
          start: row.cover_start_date ?? row.effective_date,
          end: row.cover_end_date ?? row.policy_end_date,
        }),
        coverSortKey: 'effective_date',
        status: (row) => ({
          label: humanizeStatus(row.stage),
          tone: statusTone(row.stage),
        }),
        statusSortKey: 'stage',
        tira: (row) => ({
          state: tiraStateOf(row.submission_status),
          errorCode: row.tira_error_code,
          errorReason: row.tira_error_reason,
        }),
        amountHeader: endorsement ? 'Premium change' : 'Refund',
        amount: (row) => ({
          text: endorsement
            ? signedMoney(row.net_premium_difference, row.currency_code)
            : money(row.return_premium, row.currency_code),
          payment: paymentStateOf(row.payment_status),
        }),
        amountSortKey: endorsement ? 'net_premium_difference' : undefined,
      }),
    [endorsement],
  );
  const noun = endorsement
    ? { one: 'endorsement', many: 'endorsements' }
    : { one: 'cancellation', many: 'cancellations' };

  return (
    <ListPage<UnderwritePolicyTransactionRow>
      entity={endorsement ? 'endorsement' : 'cancellation'}
      noun={noun}
      title={header.title}
      description={header.description}
      breadcrumb={header.breadcrumb}
      queryKey={[...source.keyPrefix, kind]}
      stateKey={header.stateKey}
      fetchRows={async (query, signal) => {
        const page = await source.listTransactions(
          kind,
          registerParams(query),
          signal,
        );
        return {
          rows: page.data,
          total: page.pagination.total,
          summary: page.summary,
        };
      }}
      summaryChips={SUMMARY_CHIPS}
      typeChips={header.typeChips}
      filters={[STAGE_FILTER, TIRA_FILTER, DATE_FILTER]}
      columns={register.columns}
      getAttention={register.getAttention}
      mobileRow={register.mobileRow}
      rowId={(row) => row.id}
      getRowHref={(row) =>
        endorsement
          ? source.paths.endorsement(row.source_policy_id, row.id)
          : source.paths.cancellation(row.source_policy_id, row.id)
      }
      searchPlaceholder={`Search ${noun.one} no., policy or cover note no.`}
      defaultSort={{ key: 'created_at', order: 'DESC' }}
    />
  );
}

export function RenewalRows({
  source,
  header,
}: {
  source: TransactionListSource;
  header: RegisterHeader;
}) {
  const register = useMemo(
    () =>
      registerColumns<UnderwriteRenewalRow>({
        recordHeader: 'Renewal no.',
        record: (row) => row.renewal_no,
        kind: (row) => kindOf(row.business_line) ?? 'single',
        recordSortKey: 'renewal_no',
        customer: (row) => ({
          name: row.customer_name || 'No customer',
          secondary:
            row.customer_phone || row.customer_id_number || row.policy_no,
        }),
        issued: (row) => row.created_at,
        issuedSortKey: 'created_at',
        cover: (row) => ({
          start: row.renewal_start_date,
          end: row.renewal_end_date,
        }),
        coverSortKey: 'renewal_start_date',
        status: (row) => ({
          label: humanizeStatus(row.renewal_status),
          tone: statusTone(row.renewal_status),
        }),
        statusSortKey: 'renewal_status',
        tira: (row) => ({
          state: tiraStateOf(row.tira_status),
          errorCode: row.tira_error_code,
          errorReason: row.tira_error_reason,
        }),
        amountHeader: 'Renewal premium',
        amount: (row) => ({
          text:
            row.renewal_premium != null
              ? money(row.renewal_premium, row.currency_code)
              : '—',
          payment: paymentStateOf(row.payment_status),
        }),
      }),
    [],
  );

  return (
    <ListPage<UnderwriteRenewalRow>
      entity="renewal"
      noun={{ one: 'renewal', many: 'renewals' }}
      title={header.title}
      description={header.description}
      breadcrumb={header.breadcrumb}
      queryKey={[...source.keyPrefix, 'renewals']}
      stateKey={header.stateKey}
      fetchRows={async (query, signal) => {
        const page = await source.listRenewals(registerParams(query), signal);
        return {
          rows: page.data,
          total: page.pagination.total,
          summary: page.summary,
        };
      }}
      summaryChips={SUMMARY_CHIPS}
      typeChips={header.typeChips}
      filters={[RENEWAL_STATUS_FILTER, TIRA_FILTER, DATE_FILTER]}
      columns={register.columns}
      getAttention={register.getAttention}
      mobileRow={register.mobileRow}
      rowId={(row) => row.id}
      getRowHref={(row) =>
        row.policy_transaction?.source_policy_id
          ? source.paths.renewal(
              row.policy_transaction.source_policy_id,
              row.id,
            )
          : source.paths.policy(row.policy_transaction?.source_policy_id ?? '')
      }
      searchPlaceholder="Search renewal or policy no."
      defaultSort={{ key: 'created_at', order: 'DESC' }}
    />
  );
}

function tiraTarget(
  source: TransactionListSource,
  row: UnderwriteTiraQueueRow,
) {
  if (row.source_kind === 'quotation') return source.paths.quotation(row.id);
  return row.source_policy_id ? source.paths.policy(row.source_policy_id) : '';
}

function tiraKindLabel(row: UnderwriteTiraQueueRow) {
  return row.source_kind === 'quotation'
    ? 'Quotation'
    : humanizeStatus(row.transaction_type);
}

/**
 * TIRA MIS worklist (pending or failed). Same page and table style; its key
 * fields are the submission, its status and when it last changed.
 */
export function TiraRows({
  source,
  kind,
  header,
}: {
  source: TransactionListSource;
  kind: 'failed' | 'pending';
  header: RegisterHeader;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRetry = (row: UnderwriteTiraQueueRow) => {
    if (kind !== 'failed' || !source.retryTira) return false;
    if (row.source_kind === 'quotation')
      return hasPermission('quotations:retry-tiramis');
    if (row.transaction_type === 'ENDORSEMENT')
      return (
        hasPermission('endorsements:retry-tiramis') ||
        hasPermission('endorsements:reconcile')
      );
    return hasPermission('cancellations:submit-tiramis');
  };

  const tiraInfo = (row: UnderwriteTiraQueueRow) => {
    const state = tiraStateOf(row.tira_status);
    return {
      state,
      errorCode: state === 'failed' ? row.status_code : null,
      errorReason: state === 'failed' ? row.status_description : null,
    };
  };

  const columns: ListColumn<UnderwriteTiraQueueRow>[] = [
    {
      key: 'reference',
      header: 'Reference no.',
      mandatory: true,
      className: 'min-w-[170px]',
      cell: (row) => (
        <span className="whitespace-nowrap">{row.reference_no}</span>
      ),
      secondary: (row) => (
        <ToneBadge tone="neutral" icon={null} className="text-[11px] leading-4">
          {tiraKindLabel(row)}
        </ToneBadge>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      className: 'min-w-[160px] max-w-[240px]',
      cell: (row) => (
        <TwoLineCell
          main={row.customer_name || 'No customer'}
          secondary={row.policy_no}
        />
      ),
    },
    {
      key: 'updated',
      header: 'Last update',
      sortKey: 'updated',
      mandatory: true,
      className: 'min-w-[96px]',
      cell: (row) => <DateCell value={row.updated_at} />,
    },
    {
      key: 'request',
      header: 'TIRA request',
      hideOnTablet: true,
      className: 'min-w-[140px]',
      cell: (row) => (
        <span className="font-mono text-xs text-[#5B6275]">
          {row.tira_request_id || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'min-w-[120px]',
      cell: (row) => (
        <ToneBadge tone={statusTone(row.workflow_status)}>
          {humanizeStatus(row.workflow_status)}
        </ToneBadge>
      ),
    },
    {
      key: 'tira',
      header: 'TIRA',
      mandatory: true,
      className: 'min-w-[130px] max-w-[200px]',
      cell: (row) => <TiraBadge info={tiraInfo(row)} />,
    },
  ];

  const rowActions: RowAction<UnderwriteTiraQueueRow>[] = [
    {
      label: 'Retry TIRA',
      icon: RotateCw,
      hidden: (row) => !canRetry(row),
      onSelect: async (row, { updateRow }) => {
        try {
          await source.retryTira!(row);
          updateRow(`${row.source_kind}:${row.id}`, {
            tira_status: 'QUEUED',
            workflow_status: 'QUEUED',
          });
          toast.success(`TIRA submission queued for ${row.reference_no}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    },
  ];

  return (
    <ListPage<UnderwriteTiraQueueRow>
      entity="tira"
      noun={{ one: 'submission', many: 'submissions' }}
      title={header.title}
      description={header.description}
      breadcrumb={header.breadcrumb}
      queryKey={[...source.keyPrefix, 'tira', kind]}
      stateKey={header.stateKey}
      fetchRows={async (query, signal) => {
        const page = await source.getTiraQueue(
          kind,
          {
            page: query.page,
            limit: query.limit,
            search: query.search,
            sortBy: 'updated',
            sortOrder: query.sortOrder,
          },
          signal,
        );
        return { rows: page.data, total: page.pagination.total };
      }}
      columns={columns}
      getAttention={(row) =>
        tiraStateOf(row.tira_status) === 'failed' ? 'danger' : null
      }
      mobileRow={(row) => ({
        title: row.reference_no,
        subtitle: row.customer_name || 'No customer',
        status: {
          label: humanizeStatus(row.workflow_status),
          tone: statusTone(row.workflow_status),
        },
        issued: row.updated_at,
        tira: tiraInfo(row),
        ariaLabel: `${tiraKindLabel(row)} ${row.reference_no}, ${row.customer_name || 'No customer'}, ${humanizeStatus(row.workflow_status)}`,
      })}
      rowActions={rowActions}
      rowId={(row) => `${row.source_kind}:${row.id}`}
      getRowHref={(row) => tiraTarget(source, row)}
      searchPlaceholder="Search reference, TIRA request or customer"
      defaultSort={{ key: 'updated', order: 'DESC' }}
    />
  );
}
