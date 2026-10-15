import { CarFront } from 'lucide-react';

import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type CustomerPortalVehicle } from '../api';

const COLUMNS: Column<CustomerPortalVehicle>[] = [
  {
    key: 'vehicle',
    header: 'Vehicle',
    cell: (vehicle) => (
      <div>
        <div className="font-medium text-slate-950">
          {vehicle.registration_no ?? 'Not registered'}
        </div>
        <div className="text-sm text-slate-500">
          {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
        </div>
      </div>
    ),
  },
  {
    key: 'insurer',
    header: 'Insurer',
    cell: (vehicle) => vehicle.company_name,
  },
  {
    key: 'chassis',
    header: 'Chassis',
    hideOnMobile: true,
    cell: (vehicle) => vehicle.chassis_no ?? '-',
  },
  {
    key: 'expiry',
    header: 'Expiry',
    cell: (vehicle) => vehicle.latest_policy_expiry ?? '-',
  },
  {
    key: 'status',
    header: 'Status',
    cell: (vehicle) => (
      <Badge
        variant="outline"
        className={statusTone(vehicle.latest_policy_status ?? vehicle.status)}
      >
        {vehicle.latest_policy_status ?? vehicle.status}
      </Badge>
    ),
  },
];

export function PortalVehiclesPage() {
  const { tableProps } = useServerTable<CustomerPortalVehicle>({
    queryKey: ['customer-marketplace', 'vehicles'],
    fetcher: (params, signal) => portalApi.pageCustomerVehicles(params, signal),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Portal"
        title="My Vehicles"
        description="Vehicles linked to your insurance records."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CarFront className="h-4 w-4 text-slate-500" />
            Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={COLUMNS}
            rowKey={(vehicle) => vehicle.id}
            searchPlaceholder="Search registration, chassis, make or model"
            emptyMessage="Vehicles will appear here after they are linked to your covers."
            showColumnVisibility={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
