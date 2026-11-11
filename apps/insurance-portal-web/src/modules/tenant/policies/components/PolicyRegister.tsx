import { useMemo, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import {
  ListPage,
  humanizeStatus,
  paymentStateOf,
  registerColumns,
  statusTone,
  tiraStateOf,
  type Chip,
  type FilterDef,
  type ListQuery,
  type RecordKind,
} from '@/components/list-page';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { formatMoney } from '@/components/shared/detailFormat';
import type { PaginatedWithSummary } from '@/modules/shared/api/pagination';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { PolicyListParams, PolicyRecord } from '../types';
import { policyKind } from '../utils/policyDisplay';

/*
 * Policy register on the standard list page, shared by the Motor Insurance
 * and Non-Motor policy lists.
 */

const SUMMARY_CHIPS: Chip[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'tira_failed', label: 'TIRA failed' },
];

const STATUS_OPTIONS = [
  'ACTIVE',
  'ENDORSED',
  'COVER_NOTE_ISSUED',
  'EXPIRED',
  'CANCELLED',
  'LAPSED',
].map((value) => ({ value, label: humanizeStatus(value) }));

const FILTERS: FilterDef[] = [
  {
    kind: 'select',
    key: 'policy_status',
    label: 'Status',
    allLabel: 'All statuses',
    options: STATUS_OPTIONS,
  },
  {
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
  },
  {
    kind: 'date-range',
    fromKey: 'period_from',
    toKey: 'period_to',
    label: 'Policy period',
  },
];

export type RegisterPolicy = PolicyRecord & {
  business_line?: string | null;
  /** Payment status of the quotation the policy was issued from. */
  payment_status?: string | null;
  activated_at?: string | null;
};

function customerName(row: RegisterPolicy) {
  return row.customer ? getCustomerDisplayName(row.customer) : 'No customer';
}

function policyListParams(query: ListQuery): Record<string, unknown> {
  const params: PolicyListParams & { type?: string } = {
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
  return params as Record<string, unknown>;
}

interface PolicyRegisterProps<T extends RegisterPolicy> {
  title: string;
  description: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  queryKey: QueryKey;
  stateKey: string;
  fetcher: (
    params: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<PaginatedWithSummary<T>>;
  /** Type chips sent as `type`; leave empty for single-line registers. */
  typeChips?: Chip[];
  /** Line shown when the record has no business line (non-motor pages). */
  defaultLine?: string;
  detailHref: (id: string) => string;
  headerExtras?: ReactNode;
}

export function PolicyRegister<T extends RegisterPolicy>({
  title,
  description,
  breadcrumb,
  queryKey,
  stateKey,
  fetcher,
  typeChips,
  defaultLine,
  detailHref,
  headerExtras = <CompanySwitcher menuLabel="Filter by owner company" />,
}: PolicyRegisterProps<T>) {
  const register = useMemo(
    () =>
      registerColumns<T>({
        recordHeader: 'Policy no.',
        record: (row) => row.policy_no,
        kind: (row) =>
          policyKind(row.business_line ?? defaultLine) as RecordKind,
        recordSortKey: 'policy_no',
        customer: (row) => ({
          name: customerName(row),
          secondary: row.customer?.phone || row.customer?.id_number,
        }),
        // Issued = when the policy was activated (falls back to creation).
        issued: (row) => row.activated_at || row.created_at,
        issuedSortKey: 'created_at',
        cover: (row) => ({ start: row.start_date, end: row.end_date }),
        coverSortKey: 'start_date',
        status: (row) => ({
          label: humanizeStatus(row.policy_status),
          tone: statusTone(row.policy_status),
        }),
        statusSortKey: 'policy_status',
        tira: (row) => ({
          state: tiraStateOf(row.tira_status),
          errorCode:
            row.tiramis_final_response_status_code ||
            row.tiramis_acknowledgement_status_code,
          errorReason:
            row.tiramis_final_response_status_desc ||
            row.tiramis_acknowledgement_status_desc ||
            row.tiramis_last_error_message,
        }),
        amountHeader: 'Premium',
        amount: (row) => ({
          text: formatMoney(Number(row.total_premium), row.currency),
          payment: paymentStateOf(row.payment_status),
        }),
      }),
    [defaultLine],
  );

  return (
    <ListPage<T>
      entity="policy"
      noun={{ one: 'policy', many: 'policies' }}
      title={title}
      description={description}
      breadcrumb={breadcrumb}
      headerExtras={headerExtras}
      queryKey={queryKey}
      stateKey={stateKey}
      fetchRows={async (query, signal) => {
        const page = await fetcher(policyListParams(query), signal);
        return {
          rows: page.data,
          total: page.pagination.total,
          summary: page.summary,
        };
      }}
      summaryChips={SUMMARY_CHIPS}
      typeChips={typeChips}
      filters={FILTERS}
      columns={register.columns}
      getAttention={register.getAttention}
      mobileRow={register.mobileRow}
      rowId={(row) => row.id}
      getRowHref={(row) => detailHref(row.id)}
      searchPlaceholder="Search policy no., customer, phone, reg. or chassis no."
      defaultSort={{ key: 'created_at', order: 'DESC' }}
    />
  );
}
