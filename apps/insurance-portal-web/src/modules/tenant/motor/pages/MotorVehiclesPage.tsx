import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDeleteMotorVehicle, useMotorCustomers, motorKeys } from '../hooks';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { motorApi } from '../api';
import type { MotorVehicleRecord } from '../types';

const FILTER_KEYS = ['status', 'customer_id'] as const;
type MotorFilterKey = (typeof FILTER_KEYS)[number];
const STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function MotorVehiclesPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const { tableProps, state } = useServerTable<
    MotorVehicleRecord,
    MotorFilterKey
  >({
    queryKey: motorKeys.vehicles(),
    fetcher: (params, signal) => motorApi.getVehicles(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const customerFilterOptions = customerOptions.map((customer) => ({
    value: customer.id,
    label: `${getCustomerDisplayName(customer)} (${customer.customer_no})`,
  }));
  const deleteMutation = useDeleteMotorVehicle();
  const [deleteItem, setDeleteItem] = useState<MotorVehicleRecord | null>(null);

  const columns: Column<MotorVehicleRecord>[] = [
    {
      key: 'registration_no',
      header: 'Vehicle',
      sortable: true,
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
          {row.customer
            ? getCustomerDisplayName(row.customer)
            : row.customer_id}
        </span>
      ),
    },
    {
      key: 'vehicle_value',
      header: 'Value',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.currency} {row.vehicle_value}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <MotorStatusBadge status={row.status} />,
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
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/underwrite/motor/vehicles/${row.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(`/underwrite/motor/vehicles/${row.id}/edit`)
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
        title="Motor Vehicles"
        description="Register vehicles for motor underwriting"
        action={
          <Button onClick={() => navigate('/underwrite/motor/vehicles/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Vehicle
          </Button>
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search vehicles..."
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          {
            key: 'customer_id',
            label: 'Customer',
            options: customerFilterOptions,
          },
        ])}
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
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />
    </div>
  );
}
