import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QueryKey } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Trash2, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import {
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerListParams,
  type CustomerRecord,
} from '../types';

const FILTER_KEYS = ['customer_type', 'status'] as const;
type CustomerFilterKey = (typeof FILTER_KEYS)[number];

interface CustomersTableProps {
  /** Base cache key; mutations invalidate it to refresh the list. */
  queryKey: QueryKey;
  /** Fetches one server-side page (search/sort/filters/paging in SQL). */
  fetcher: (
    params: CustomerListParams,
    signal: AbortSignal,
  ) => Promise<PaginatedResponse<CustomerRecord>>;
  toolbarActions?: ReactNode;
  onEdit?: (customer: CustomerRecord) => void;
  onDelete?: (customer: CustomerRecord) => void;
  onRestore?: (customer: CustomerRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
}

export function CustomersTable({
  queryKey,
  fetcher,
  toolbarActions,
  onEdit,
  onDelete,
  onRestore,
  canEdit,
  canDelete,
  canRestore,
}: CustomersTableProps) {
  const { tableProps, state } = useServerTable<
    CustomerRecord,
    CustomerFilterKey
  >({
    queryKey,
    fetcher: (params, signal) => fetcher(params as CustomerListParams, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const navigate = useNavigate();

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'customer_no',
      header: 'Customer',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 truncate">
              {getCustomerDisplayName(row)}
            </p>
            <CustomerStatusBadge status={row.status} />
          </div>
          <code className="text-xs text-slate-400">{row.customer_no}</code>
        </div>
      ),
    },
    {
      key: 'customer_type',
      header: 'Type',
      sortable: true,
      cell: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.customer_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'phone',
      defaultVisible: false,
      header: 'Phone',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.phone}</span>
      ),
    },
    {
      key: 'email',
      defaultVisible: false,
      header: 'Email',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.email ?? ' - '}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() =>
                navigate(sharedUnderwritePaths.customerDetail(row.id))
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            {canEdit && onEdit && (
              <DropdownMenuItem onClick={() => onEdit(row)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canRestore && onRestore && row.status !== 'ACTIVE' && (
              <DropdownMenuItem onClick={() => onRestore(row)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
            )}
            {canDelete && onDelete && (
              <>
                {(canEdit || canRestore) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => onDelete(row)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      {...tableProps}
      columns={columns}
      searchPlaceholder="Search customers..."
      filters={tableFilters(state.filters, [
        { key: 'customer_type', label: 'Type', options: CUSTOMER_TYPE_OPTIONS },
        { key: 'status', label: 'Status', options: CUSTOMER_STATUS_OPTIONS },
      ])}
      toolbarActions={toolbarActions}
    />
  );
}
