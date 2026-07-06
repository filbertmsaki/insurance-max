import { useNavigate } from 'react-router-dom';
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
import { DataTable, type Column } from '@/components/shared/DataTable';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { getCustomerDisplayName, type CustomerRecord } from '../types';

interface CustomersTableProps {
  customers: CustomerRecord[];
  loading?: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSortChange: (key: string, order: 'ASC' | 'DESC') => void;
  onEdit?: (customer: CustomerRecord) => void;
  onDelete?: (customer: CustomerRecord) => void;
  onRestore?: (customer: CustomerRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
}

export function CustomersTable({
  customers,
  loading,
  page,
  limit,
  total,
  totalPages,
  sortBy,
  sortOrder,
  onPageChange,
  onLimitChange,
  onSortChange,
  onEdit,
  onDelete,
  onRestore,
  canEdit,
  canDelete,
  canRestore,
}: CustomersTableProps) {
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
      cell: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.customer_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => <span className="text-sm text-slate-600">{row.phone}</span>,
    },
    {
      key: 'kyc_status',
      header: 'KYC',
      cell: (row) => (
        <Badge
          className={
            row.kyc_status === 'VERIFIED'
              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
              : row.kyc_status === 'REJECTED'
                ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
          }
        >
          {row.kyc_status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => <span className="text-sm text-slate-600">{row.email ?? ' - '}</span>,
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
            <DropdownMenuItem onClick={() => navigate(`/customers/${row.id}`)}>
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
                <DropdownMenuItem onClick={() => onDelete(row)} className="text-red-600 focus:text-red-600">
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
      columns={columns}
      data={customers}
      loading={loading}
      page={page}
      limit={limit}
      total={total}
      totalPages={totalPages}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onPageChange={onPageChange}
      onLimitChange={onLimitChange}
      onSortChange={onSortChange}
    />
  );
}
