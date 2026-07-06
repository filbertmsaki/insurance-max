import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useDeleteMotorVehicle,
  useMotorCustomers,
  useMotorVehiclesList,
} from '../hooks';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { getCustomerDisplayName, type MotorVehicleRecord } from '../types';

export function MotorVehiclesPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const {
    vehicles,
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
  } = useMotorVehiclesList();
  const deleteMutation = useDeleteMotorVehicle();
  const [deleteItem, setDeleteItem] = useState<MotorVehicleRecord | null>(null);

  const columns: Column<MotorVehicleRecord>[] = [
    {
      key: 'registration_no',
      header: 'Vehicle',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.registration_no ?? row.chassis_no ?? row.engine_no ?? row.id}
          </p>
          <p className="text-xs text-slate-400">
            {row.make ?? 'Unknown'} {row.model ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.customer ? getCustomerDisplayName(row.customer) : row.customer_id}
        </span>
      ),
    },
    {
      key: 'vehicle_value',
      header: 'Value',
      cell: (row) => <span className="text-sm text-slate-600">{row.currency} {row.vehicle_value}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <MotorStatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (row) => <span className="text-sm text-slate-500">{new Date(row.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/motor/vehicles/${row.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/motor/vehicles/${row.id}/edit`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Motor Vehicles"
        description="Register vehicles for motor underwriting"
        action={
          <Button onClick={() => navigate('/motor/vehicles/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Vehicle
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search vehicles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
        data={vehicles}
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
        title="Delete Vehicle"
        description="This will soft-delete the motor vehicle."
        confirmLabel="Delete Vehicle"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) });
          }
        }}
      />
    </div>
  );
}
