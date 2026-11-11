import type { QueryKey } from '@tanstack/react-query';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  DateCell,
  ListPage,
  ToneBadge,
  TwoLineCell,
  humanizeStatus,
  statusTone,
  type FilterDef,
  type ListColumn,
  type RowAction,
} from '@/components/list-page';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import {
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerListParams,
  type CustomerRecord,
} from '../types';

/*
 * Customer register on the standard list page. Customers have no cover or
 * TIRA status, so their key fields (contact, ID, status) take those places.
 */

const FILTERS: FilterDef[] = [
  {
    kind: 'select',
    key: 'customer_type',
    label: 'Type',
    allLabel: 'All types',
    options: CUSTOMER_TYPE_OPTIONS,
  },
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    allLabel: 'All statuses',
    options: CUSTOMER_STATUS_OPTIONS,
  },
];

function typeLabel(row: CustomerRecord) {
  return row.customer_type === 'CORPORATE' ? 'Corporate' : 'Individual';
}

const COLUMNS: ListColumn<CustomerRecord>[] = [
  {
    key: 'customer_no',
    header: 'Customer no.',
    sortKey: 'customer_no',
    mandatory: true,
    className: 'min-w-[150px]',
    cell: (row) => <span className="whitespace-nowrap">{row.customer_no}</span>,
    secondary: (row) => (
      <ToneBadge
        tone={row.customer_type === 'CORPORATE' ? 'info' : 'neutral'}
        icon={null}
        className="text-[11px] leading-4"
      >
        {typeLabel(row)}
      </ToneBadge>
    ),
  },
  {
    key: 'name',
    header: 'Name',
    sortKey: 'first_name',
    mandatory: true,
    className: 'min-w-[180px] max-w-[260px]',
    cell: (row) => (
      <TwoLineCell main={getCustomerDisplayName(row)} secondary={row.email} />
    ),
  },
  {
    key: 'contact',
    header: 'Phone / ID',
    className: 'min-w-[150px]',
    cell: (row) => (
      <TwoLineCell main={row.phone || '—'} secondary={row.id_number} />
    ),
  },
  {
    key: 'created_at',
    header: 'Date created',
    sortKey: 'created_at',
    className: 'min-w-[96px]',
    cell: (row) => <DateCell value={row.created_at} />,
  },
  {
    key: 'status',
    header: 'Status',
    sortKey: 'status',
    className: 'min-w-[110px]',
    cell: (row) => (
      <ToneBadge tone={statusTone(row.status)}>
        {humanizeStatus(row.status)}
      </ToneBadge>
    ),
  },
];

interface CustomersTableProps {
  title: string;
  description?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  stateKey: string;
  primaryAction?: { label: string; onClick: () => void };
  /** Base cache key; mutations invalidate it to refresh the list. */
  queryKey: QueryKey;
  /** Fetches one server-side page (search/sort/filters/paging in SQL). */
  fetcher: (
    params: CustomerListParams,
    signal: AbortSignal,
  ) => Promise<PaginatedResponse<CustomerRecord>>;
  onEdit?: (customer: CustomerRecord) => void;
  onDelete?: (customer: CustomerRecord) => void;
  onRestore?: (customer: CustomerRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
}

export function CustomersTable({
  title,
  description,
  breadcrumb,
  stateKey,
  primaryAction,
  queryKey,
  fetcher,
  onEdit,
  onDelete,
  onRestore,
  canEdit,
  canDelete,
  canRestore,
}: CustomersTableProps) {
  const rowActions: RowAction<CustomerRecord>[] = [
    ...(canEdit && onEdit
      ? [{ label: 'Edit', icon: Pencil, onSelect: onEdit }]
      : []),
    ...(canRestore && onRestore
      ? [
          {
            label: 'Restore',
            icon: RotateCcw,
            hidden: (row: CustomerRecord) => row.status === 'ACTIVE',
            onSelect: onRestore,
          },
        ]
      : []),
    ...(canDelete && onDelete
      ? [
          {
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ];

  return (
    <ListPage<CustomerRecord>
      entity="customer"
      noun={{ one: 'customer', many: 'customers' }}
      title={title}
      description={description}
      breadcrumb={breadcrumb}
      primaryAction={primaryAction}
      queryKey={queryKey}
      stateKey={stateKey}
      fetchRows={async (query, signal) => {
        const page = await fetcher(
          {
            page: query.page,
            limit: query.limit,
            search: query.search,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
            ...query.filters,
          } as CustomerListParams,
          signal,
        );
        return { rows: page.data, total: page.pagination.total };
      }}
      filters={FILTERS}
      columns={COLUMNS}
      rowActions={rowActions}
      mobileRow={(row) => ({
        title: row.customer_no,
        subtitle: getCustomerDisplayName(row),
        amount: row.phone || undefined,
        status: {
          label: humanizeStatus(row.status),
          tone: statusTone(row.status),
        },
        issued: row.created_at,
        ariaLabel: `Customer ${row.customer_no}, ${getCustomerDisplayName(row)}, ${typeLabel(row)}, ${humanizeStatus(row.status)}`,
      })}
      rowId={(row) => row.id}
      getRowHref={(row) => sharedUnderwritePaths.customerDetail(row.id)}
      searchPlaceholder="Search name, customer no., phone, email or ID"
      defaultSort={{ key: 'created_at', order: 'DESC' }}
    />
  );
}
