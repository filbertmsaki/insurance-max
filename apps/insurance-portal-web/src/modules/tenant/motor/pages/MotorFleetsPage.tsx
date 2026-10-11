import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useDeleteMotorFleet,
  useMotorCustomers,
  useMotorFleetsList,
} from '../hooks';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { MotorFleetRecord } from '../types';

export function MotorFleetsPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const {
    fleets,
    total,
    totalPages,
    page,
    limit,
    search,
    status,
    customerId,
    isLoading,
    setSearch,
    setStatus,
    setCustomerId,
    setPage,
    setLimit,
  } = useMotorFleetsList();
  const deleteMutation = useDeleteMotorFleet();
  const [deleteItem, setDeleteItem] = useState<MotorFleetRecord | null>(null);

  const columns: Column<MotorFleetRecord>[] = [
    { key: 'fleet_no', header: 'Fleet No.', cell: (row) => row.fleet_no },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.customer
            ? getCustomerDisplayName(row.customer)
            : row.customer_id}
        </span>
      ),
    },
    {
      key: 'total_vehicles',
      header: 'Vehicles',
      cell: (row) => row.total_vehicles,
    },
    {
      key: 'total_premium',
      header: 'Premium',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.total_premium}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <MotorStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/underwrite/fleet/fleets/${row.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(`/underwrite/fleet/fleets/${row.id}/edit`)
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteItem(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Motor Fleets"
        description="Manage fleet records for grouped vehicle underwriting"
        action={
          <Button onClick={() => navigate('/underwrite/fleet/fleets/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Fleet
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search fleets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customerOptions.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {getCustomerDisplayName(customer)} ({customer.customer_no})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={fleets}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Fleet"
        description="This will soft-delete the motor fleet."
        confirmLabel="Delete Fleet"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />
    </div>
  );
}
