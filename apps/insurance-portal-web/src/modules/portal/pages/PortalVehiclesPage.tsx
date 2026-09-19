import { useQuery } from '@tanstack/react-query';
import { CarFront } from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi } from '../api';

export function PortalVehiclesPage() {
  const vehiclesQuery = useQuery({
    queryKey: ['customer-marketplace', 'vehicles'],
    queryFn: () => portalApi.listCustomerVehicles(),
  });
  const vehicles = vehiclesQuery.data ?? [];

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
          {vehiclesQuery.isError ? (
            <ErrorState
              description="Vehicles could not be loaded."
              onRetry={() => {
                void vehiclesQuery.refetch();
              }}
            />
          ) : vehicles.length === 0 ? (
            <EmptyState
              title="No vehicles"
              description="Vehicles will appear here after they are linked to your covers."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Chassis</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="font-medium text-slate-950">
                        {vehicle.registration_no ?? 'Not registered'}
                      </div>
                      <div className="text-sm text-slate-500">
                        {[vehicle.make, vehicle.model]
                          .filter(Boolean)
                          .join(' ') || 'Vehicle'}
                      </div>
                    </TableCell>
                    <TableCell>{vehicle.company_name}</TableCell>
                    <TableCell>{vehicle.chassis_no ?? '-'}</TableCell>
                    <TableCell>{vehicle.latest_policy_expiry ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(
                          vehicle.latest_policy_status ?? vehicle.status,
                        )}
                      >
                        {vehicle.latest_policy_status ?? vehicle.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
