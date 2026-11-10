import { useNavigate } from 'react-router-dom';
import type { QueryKey } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { formatMoney } from '@/components/shared/detailFormat';
import {
  RecordMobileList,
  type RecordListChip,
  type RecordListSort,
} from '@/components/record-list/RecordMobileList';
import { SummaryPill } from '@/components/record-summary/RecordSummaryHeader';
import { compactPeriod } from '@/components/record-summary/record-summary';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { PolicyRecord } from '../types';
import {
  EXPIRING_SOON,
  POLICY_KIND_LABEL,
  daysLeftLabel,
  policyKind,
  policyStatusView,
} from '../utils/policyDisplay';

/*
 * Policy register shared by the Motor Insurance and Non-Motor policy pages.
 * Desktop/tablet: toolbar (search, type chips, status, period range) and a
 * table. Phone (<768px): the compact tappable list. One server-side data
 * source; breakpoints only switch the layout.
 */

const PRIMARY = '#3B4A8C';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: EXPIRING_SOON, label: 'Expiring soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'LAPSED', label: 'Lapsed' },
  { value: 'ENDORSED', label: 'Endorsed' },
  { value: 'COVER_NOTE_ISSUED', label: 'Cover note issued' },
];

const SORTS: RecordListSort[] = [
  { value: 'newest', label: 'Newest', sortBy: 'created_at', order: 'DESC' },
  { value: 'oldest', label: 'Oldest', sortBy: 'created_at', order: 'ASC' },
  {
    value: 'expiry',
    label: 'Expiry date',
    sortBy: 'end_date',
    order: 'ASC',
  },
  { value: 'number', label: 'Policy no.', sortBy: 'policy_no', order: 'ASC' },
];

const FILTER_KEYS = [
  'policy_status',
  'type',
  'period_from',
  'period_to',
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export type RegisterPolicy = PolicyRecord & { business_line?: string | null };

interface PolicyRegisterProps<T extends RegisterPolicy> {
  eyebrow: string;
  title: string;
  description: string;
  queryKey: QueryKey;
  fetcher: (
    params: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<PaginatedResponse<T>>;
  /** Type chips sent as `type`; leave empty for single-line registers. */
  typeChips?: RecordListChip[];
  /** Line shown when the record has no business line (non-motor pages). */
  defaultLine?: string;
  detailHref: (id: string) => string;
}

function customerName(row: RegisterPolicy) {
  return row.customer ? getCustomerDisplayName(row.customer) : 'No customer';
}

export function PolicyRegister<T extends RegisterPolicy>({
  eyebrow,
  title,
  description,
  queryKey,
  fetcher,
  typeChips = [],
  defaultLine,
  detailHref,
}: PolicyRegisterProps<T>) {
  const navigate = useNavigate();
  const { tableProps, state, rows, total, totalPages, query } = useServerTable<
    T,
    FilterKey
  >({
    queryKey,
    fetcher: (params, signal) =>
      fetcher(params as Record<string, unknown>, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const kindOf = (row: T) => policyKind(row.business_line ?? defaultLine);
  const type = state.filters.type ?? '';

  const columns: Column<T>[] = [
    {
      key: 'policy_no',
      header: 'Policy No.',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <span className="block font-semibold text-slate-900">
            {row.policy_no}
          </span>
          {row.cover_note_no ? (
            <span className="block text-xs text-slate-500">
              Cover note {row.cover_note_no}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => customerName(row),
    },
    {
      key: 'business_line',
      header: 'Type',
      cell: (row) => {
        const kind = kindOf(row);
        return (
          <span
            className={cn(
              'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              kind === 'fleet'
                ? 'bg-[#E8EBF7] text-[#3B4A8C]'
                : 'bg-slate-100 text-slate-700',
            )}
          >
            {POLICY_KIND_LABEL[kind].short}
          </span>
        );
      },
    },
    {
      key: 'start_date',
      header: 'Policy Period',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => {
        const view = policyStatusView(row.policy_status, row.end_date);
        return (
          <div>
            <span className="whitespace-nowrap tabular-nums">
              {compactPeriod(row.start_date, row.end_date) ?? '—'}
            </span>
            {view.daysLeft !== null &&
            view.daysLeft >= 0 &&
            view.daysLeft <= 60 ? (
              <span className="block text-xs text-slate-500">
                {daysLeftLabel(view.daysLeft)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'policy_status',
      header: 'Status',
      sortable: true,
      cell: (row) => {
        const view = policyStatusView(row.policy_status, row.end_date);
        return (
          <SummaryPill tone={view.tone} size="sm">
            {view.label}
          </SummaryPill>
        );
      },
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'text-right',
      cell: (row) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {formatMoney(Number(row.total_premium), row.currency)}
        </span>
      ),
    },
    {
      key: 'view',
      header: '',
      className: 'w-20 text-right',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(detailHref(row.id));
          }}
          aria-label={`View policy ${row.policy_no}`}
        >
          View
        </Button>
      ),
    },
  ];

  const statusFilter = tableFilters(state.filters, [
    {
      key: 'policy_status',
      label: 'Status',
      placeholder: 'All statuses',
      options: STATUS_OPTIONS,
    },
  ]);

  const typeChipsRow = typeChips.length ? (
    <div
      role="radiogroup"
      aria-label="Policy type"
      className="flex flex-wrap gap-2"
    >
      {typeChips.map((chip) => {
        const selected = chip.value === type;
        return (
          <button
            key={chip.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => state.setFilter('type', chip.value)}
            className={cn(
              'h-9 rounded-full border px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-1',
              selected
                ? 'border-transparent text-white'
                : 'border-[#E6E8EF] bg-white text-slate-700 hover:bg-slate-50',
            )}
            style={selected ? { backgroundColor: PRIMARY } : undefined}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  ) : null;

  const dateRange = (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <label className="flex items-center gap-1.5 text-slate-600">
        From
        <input
          type="date"
          value={state.filters.period_from ?? ''}
          max={state.filters.period_to || undefined}
          onChange={(event) =>
            state.setFilter('period_from', event.target.value)
          }
          aria-label="Policy period from"
          className="h-9 rounded-md border border-[#E6E8EF] bg-white px-2 text-slate-900"
        />
      </label>
      <label className="flex items-center gap-1.5 text-slate-600">
        To
        <input
          type="date"
          value={state.filters.period_to ?? ''}
          min={state.filters.period_from || undefined}
          onChange={(event) => state.setFilter('period_to', event.target.value)}
          aria-label="Policy period to"
          className="h-9 rounded-md border border-[#E6E8EF] bg-white px-2 text-slate-900"
        />
      </label>
    </div>
  );

  return (
    <div>
      {/* Phone (<768px) */}
      <RecordMobileList<T>
        rows={rows}
        total={total}
        loading={tableProps.loading}
        isFetching={tableProps.isFetching}
        error={tableProps.error ? 'Unable to load policies' : undefined}
        onRetry={tableProps.onRetry}
        onRefresh={() => query.refetch()}
        search={state.search ?? ''}
        onSearchChange={state.setSearch}
        type={type}
        onTypeChange={(value) => state.setFilter('type', value)}
        chips={typeChips}
        sorts={SORTS}
        sortBy={state.sortBy}
        sortOrder={state.sortOrder}
        onSortChange={state.setSort}
        filters={statusFilter}
        onFilterChange={tableProps.onFilterChange}
        page={state.page}
        totalPages={totalPages}
        onPageChange={state.setPage}
        onOpen={(row) => navigate(detailHref(row.id))}
        noun={{ one: 'policy', many: 'policies' }}
        searchLabel="Search policy, quotation, customer or reg. no."
        searchHint="Try a policy, quotation or registration number, or a customer name."
        sheetExtras={
          <>
            <CompanySwitcher menuLabel="Filter by owner company" />
            {dateRange}
          </>
        }
        getRow={(row) => {
          const kind = kindOf(row);
          const view = policyStatusView(row.policy_status, row.end_date);
          const premium = formatMoney(Number(row.total_premium), row.currency);
          const expiring = view.label === 'Expiring soon';
          return {
            id: row.id,
            title: row.policy_no,
            badge: {
              label: POLICY_KIND_LABEL[kind].short,
              tone: kind === 'fleet' ? 'primary' : 'muted',
            },
            subtitle: customerName(row),
            amount: premium,
            amountLabel: expiring ? (
              <span className="font-semibold text-[#8A4B08]">
                {daysLeftLabel(view.daysLeft)}
              </span>
            ) : (
              <span
                className={cn(
                  view.tone === 'danger' && 'font-semibold text-[#B42318]',
                )}
              >
                {view.label}
              </span>
            ),
            ariaLabel: `Policy ${row.policy_no}, ${customerName(row)}, ${view.label}, premium ${premium}`,
          };
        }}
      />

      {/* Tablet / desktop */}
      <div className="max-md:hidden">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={<CompanySwitcher menuLabel="Filter by owner company" />}
        />
        {(typeChipsRow || dateRange) && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {typeChipsRow ?? <span />}
            {dateRange}
          </div>
        )}
        <DataTable
          {...tableProps}
          error={tableProps.error ? 'Unable to load policies' : undefined}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(detailHref(row.id))}
          searchPlaceholder="Search policy no., quotation no., customer, reg. no."
          filters={statusFilter}
          emptyMessage="No policies found"
        />
      </div>
    </div>
  );
}
