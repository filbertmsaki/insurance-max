import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { policyKeys } from '@/modules/tenant/policies/hooks';
import type { FleetVehiclePanelProps } from '@/modules/tenant/policies/transaction-scope';
import { underwriteApi } from '../api';
import { underwriteKeys } from '../hooks';
import {
  FLEET_ADD_VEHICLE_CODE,
  FLEET_VEHICLE_FIELDS,
  describeTiraCode,
  emptyFleetVehicleForm,
  toMotorInput,
  vehiclesFromSnapshot,
  type FleetSnapshotVehicle,
  type FleetVehicleForm,
} from './fleetVehicleEndorsement';

const STATUS_BADGE: Record<
  FleetSnapshotVehicle['status'],
  { label: string; variant: 'outline' | 'info' | 'warning' | 'secondary' }
> = {
  ACTIVE: { label: 'On cover', variant: 'outline' },
  ADDED: { label: 'New', variant: 'info' },
  REMOVED: { label: 'Being removed', variant: 'warning' },
  CANCELLED: { label: 'Removed', variant: 'secondary' },
};

/**
 * Editor for "Fleet - Add Vehicle" / "Fleet - Remove Vehicle" endorsements.
 * Each change is priced by the
 * backend for the remaining period; the premium effect shows below.
 */
export function FleetVehicleEndorsementPanel({
  endorsementId,
  endorsementTypeCode,
  snapshot,
  pricing,
  currencyCode,
  editable,
  tiraStatusCode,
}: FleetVehiclePanelProps) {
  const queryClient = useQueryClient();
  const isAdd = endorsementTypeCode === FLEET_ADD_VEHICLE_CODE;
  const vehicles = vehiclesFromSnapshot(snapshot);
  const templates = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
  const pending = vehicles.filter((vehicle) =>
    ['ADDED', 'REMOVED'].includes(vehicle.status),
  );

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FleetVehicleForm>(emptyFleetVehicleForm);
  const [sumInsured, setSumInsured] = useState('');
  const [templateEntry, setTemplateEntry] = useState('');

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: policyKeys.endorsementContext(endorsementId),
      }),
      queryClient.invalidateQueries({ queryKey: underwriteKeys.all }),
    ]);
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error));

  const add = useMutation({
    mutationFn: () => {
      const { motor } = toMotorInput(form);
      return underwriteApi.addFleetVehicle(endorsementId, {
        motor,
        ...(sumInsured ? { sum_insured: Number(sumInsured) } : {}),
        ...(templateEntry
          ? { template_fleet_entry: Number(templateEntry) }
          : {}),
      });
    },
    onSuccess: async () => {
      toast.success('Vehicle added and priced');
      setAdding(false);
      setForm(emptyFleetVehicleForm());
      setSumInsured('');
      await refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (fleetEntry: number) =>
      underwriteApi.removeFleetVehicle(endorsementId, fleetEntry),
    onSuccess: async () => {
      toast.success('Vehicle marked for removal');
      await refresh();
    },
    onError,
  });
  const revert = useMutation({
    mutationFn: (fleetEntry: number) =>
      underwriteApi.revertFleetVehicle(endorsementId, fleetEntry),
    onSuccess: async () => {
      toast.success('Change undone');
      await refresh();
    },
    onError,
  });

  const { missing } = toMotorInput(form);
  const busy = add.isPending || remove.isPending || revert.isPending;
  const refund = pricing?.['fleetRemovalRefund'] as
    | { refundAmount?: string; cancellationMethod?: string }
    | undefined;
  const premiumDifference = pricing?.['premiumDifference'];
  const tiraMessage = describeTiraCode(tiraStatusCode);

  return (
    <div className="space-y-4">
      {tiraMessage && (
        <Alert variant="destructive">
          <AlertTitle>TIRA rejected this change ({tiraStatusCode})</AlertTitle>
          <AlertDescription>{tiraMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base">
            {isAdd
              ? 'Add vehicles to the fleet'
              : 'Remove vehicles from the fleet'}
          </CardTitle>
          {isAdd && editable && !adding && (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add vehicle
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicles.map((vehicle) => {
            const badge = STATUS_BADGE[vehicle.status];
            const isPending = ['ADDED', 'REMOVED'].includes(vehicle.status);
            return (
              <div
                key={vehicle.fleetEntry}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Vehicle {vehicle.fleetEntry} ·{' '}
                    {vehicle.registrationNumber ?? vehicle.chassisNumber ?? '—'}
                    <Badge variant={badge.variant} className="ml-2">
                      {badge.label}
                      {vehicle.status === 'CANCELLED' && vehicle.removedOn
                        ? ` ${vehicle.removedOn}`
                        : ''}
                    </Badge>
                  </p>
                  <p className="text-xs text-slate-500">
                    {vehicle.description}
                    {vehicle.sumInsured
                      ? ` · Sum insured ${formatMoney(vehicle.sumInsured, currencyCode)}`
                      : ''}
                  </p>
                </div>
                {editable && isPending && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => revert.mutate(vehicle.fleetEntry)}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Undo
                  </Button>
                )}
                {editable && !isAdd && vehicle.status === 'ACTIVE' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove vehicle ${vehicle.fleetEntry} from the fleet from the endorsement's effective date?`,
                        )
                      ) {
                        remove.mutate(vehicle.fleetEntry);
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isAdd && adding && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New vehicle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {FLEET_VEHICLE_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1 text-sm">
                  <span className="text-slate-500">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.options ? (
                    <Select
                      value={form[field.key]}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: value,
                        }))
                      }
                    >
                      <SelectTrigger aria-label={field.label}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      aria-label={field.label}
                      inputMode={field.numeric ? 'numeric' : undefined}
                      value={form[field.key]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-500">
                  Sum insured (blank: same as the priced-like vehicle)
                </span>
                <Input
                  aria-label="Sum insured"
                  inputMode="decimal"
                  value={sumInsured}
                  onChange={(event) => setSumInsured(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-500">Price like vehicle</span>
                <Select value={templateEntry} onValueChange={setTemplateEntry}>
                  <SelectTrigger aria-label="Price like vehicle">
                    <SelectValue placeholder="First vehicle on cover" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((vehicle) => (
                      <SelectItem
                        key={vehicle.fleetEntry}
                        value={String(vehicle.fleetEntry)}
                      >
                        Vehicle {vehicle.fleetEntry} ·{' '}
                        {vehicle.registrationNumber ?? vehicle.chassisNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            {missing.length > 0 && (
              <p className="text-sm text-amber-700">
                Still needed: {missing.join(', ')}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy || missing.length > 0}
                onClick={() => add.mutate()}
              >
                Add and price vehicle
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Premium effect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            {refund ? (
              <p>
                Return premium{' '}
                <span className="font-medium text-slate-900">
                  {formatMoney(refund.refundAmount ?? 0, currencyCode)}
                </span>{' '}
                under the{' '}
                {String(refund.cancellationMethod ?? '')
                  .toLowerCase()
                  .replace(/_/g, ' ')}{' '}
                cancellation rule.
              </p>
            ) : (
              <p>
                Additional premium for the remaining period{' '}
                <span className="font-medium text-slate-900">
                  {formatMoney(Number(premiumDifference ?? 0), currencyCode)}
                </span>
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
