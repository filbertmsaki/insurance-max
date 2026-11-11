import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatMoney } from '@/components/shared/detailFormat';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { useDeleteMotorVehicle, useMotorCustomers, motorKeys } from '../hooks';
import { motorApi } from '../api';
import type { MotorVehicleRecord } from '../types';

/*
 * Motor vehicle register on the standard list page. Vehicles have no cover
 * period or TIRA status; their key fields (identifiers, owner, verification)
 * take those places.
 */

const STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

function identifier(row: MotorVehicleRecord) {
  return row.registration_no || row.chassis_no || row.id;
}

function vehicleName(row: MotorVehicleRecord) {
  return (
    [row.make, row.model, row.manufacture_year].filter(Boolean).join(' ') ||
    'Unknown vehicle'
  );
}

function ownerName(row: MotorVehicleRecord) {
  return row.customer ? getCustomerDisplayName(row.customer) : 'No customer';
}

const COLUMNS: ListColumn<MotorVehicleRecord>[] = [
  {
    key: 'registration_no',
    header: 'Registration no.',
    sortKey: 'registration_no',
    mandatory: true,
    className: 'min-w-[150px]',
    cell: (row) => <span className="whitespace-nowrap">{identifier(row)}</span>,
    secondary: (row) =>
      row.registration_no && row.chassis_no ? (
        <span className="font-mono text-xs text-[#5B6275]">
          {row.chassis_no}
        </span>
      ) : null,
  },
  {
    key: 'vehicle',
    header: 'Vehicle',
    mandatory: true,
    className: 'min-w-[170px] max-w-[240px]',
    cell: (row) => (
      <TwoLineCell main={vehicleName(row)} secondary={row.body_type} />
    ),
  },
  {
    key: 'customer',
    header: 'Owner',
    className: 'min-w-[160px] max-w-[240px]',
    cell: (row) => (
      <TwoLineCell
        main={ownerName(row)}
        secondary={row.customer?.customer_no}
      />
    ),
  },
  {
    key: 'created_at',
    header: 'Date added',
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
  {
    key: 'verification',
    header: 'Verification',
    hideOnTablet: true,
    className: 'min-w-[120px]',
    cell: (row) => (
      <ToneBadge tone={statusTone(row.verification_status)}>
        {humanizeStatus(row.verification_status)}
      </ToneBadge>
    ),
  },
  {
    key: 'vehicle_value',
    header: 'Value',
    sortKey: 'vehicle_value',
    align: 'right',
    className: 'min-w-[130px]',
    cell: (row) => (
      <span className="font-semibold whitespace-nowrap tabular-nums">
        {formatMoney(Number(row.vehicle_value), row.currency)}
      </span>
    ),
  },
];

export function MotorVehiclesPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const deleteMutation = useDeleteMotorVehicle();
  const [deleteItem, setDeleteItem] = useState<MotorVehicleRecord | null>(null);

  const filters: FilterDef[] = [
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All statuses',
      options: STATUS_OPTIONS,
    },
    {
      kind: 'select',
      key: 'customer_id',
      label: 'Owner',
      allLabel: 'All owners',
      options: customerOptions.map((customer) => ({
        value: customer.id,
        label: `${getCustomerDisplayName(customer)} (${customer.customer_no})`,
      })),
    },
  ];

  const rowActions: RowAction<MotorVehicleRecord>[] = [
    {
      label: 'Edit vehicle',
      icon: Pencil,
      onSelect: (row) =>
        navigate(`/apps/underwrite/motor/vehicles/${row.id}/edit`),
    },
    {
      label: 'Delete vehicle',
      icon: Trash2,
      destructive: true,
      onSelect: setDeleteItem,
    },
  ];

  return (
    <>
      <ListPage<MotorVehicleRecord>
        entity="vehicle"
        noun={{ one: 'vehicle', many: 'vehicles' }}
        title="Motor vehicles"
        description="Register vehicles for motor underwriting"
        breadcrumb={[
          { label: 'Underwrite', href: '/apps/underwrite' },
          { label: 'Motor vehicles' },
        ]}
        primaryAction={{
          label: 'New vehicle',
          onClick: () => navigate('/apps/underwrite/motor/vehicles/new'),
        }}
        queryKey={motorKeys.vehicles()}
        stateKey="motor-vehicles"
        fetchRows={async (query, signal) => {
          const page = await motorApi.getVehicles(
            {
              page: query.page,
              limit: query.limit,
              search: query.search,
              sortBy: query.sortBy,
              sortOrder: query.sortOrder,
              ...query.filters,
            },
            signal,
          );
          return { rows: page.data, total: page.pagination.total };
        }}
        filters={filters}
        columns={COLUMNS}
        rowActions={rowActions}
        mobileRow={(row) => ({
          title: identifier(row),
          subtitle: `${vehicleName(row)} · ${ownerName(row)}`,
          amount: formatMoney(Number(row.vehicle_value), row.currency),
          status: {
            label: humanizeStatus(row.status),
            tone: statusTone(row.status),
          },
          issued: row.created_at,
          ariaLabel: `Vehicle ${identifier(row)}, ${vehicleName(row)}, ${ownerName(row)}, ${humanizeStatus(row.status)}`,
        })}
        rowId={(row) => row.id}
        getRowHref={(row) => `/apps/underwrite/motor/vehicles/${row.id}`}
        searchPlaceholder="Search registration, chassis no., make or owner"
        defaultSort={{ key: 'created_at', order: 'DESC' }}
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
    </>
  );
}
