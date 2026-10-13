import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDeleteMotorFleet, useMotorCustomers, motorKeys } from '../hooks';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { motorApi } from '../api';
import type { MotorFleetRecord } from '../types';

const FILTER_KEYS = ['status', 'customer_id'] as const;
type MotorFilterKey = (typeof FILTER_KEYS)[number];
const STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function MotorFleetsPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const { tableProps, state } = useServerTable<
    MotorFleetRecord,
    MotorFilterKey
  >({
    queryKey: motorKeys.fleets(),
    fetcher: (params, signal) => motorApi.getFleets(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const customerFilterOptions = customerOptions.map((customer) => ({
    value: customer.id,
    label: `${getCustomerDisplayName(customer)} (${customer.customer_no})`,
  }));
  const deleteMutation = useDeleteMotorFleet();
  const [deleteItem, setDeleteItem] = useState<MotorFleetRecord | null>(null);

  const columns: Column<MotorFleetRecord>[] = [
    {
      key: 'fleet_no',
      header: 'Fleet No.',
      sortable: true,
      cell: (row) => row.fleet_no,
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
      key: 'total_vehicles',
      header: 'Vehicles',
      sortable: true,
      cell: (row) => row.total_vehicles,
    },
    {
      key: 'total_premium',
      header: 'Premium',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.total_premium}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
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
            onClick={() => navigate(`/underwrite/fleet/fleets/${row.id}/edit`)}
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

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search fleets..."
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
