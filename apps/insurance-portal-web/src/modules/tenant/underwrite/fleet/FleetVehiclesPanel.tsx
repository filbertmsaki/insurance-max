import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SectionCard } from '@/components/shared/DetailSections';
import { ErrorState } from '@/components/shared/ContentStates';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { underwriteApi } from '../api';
import { underwriteKeys } from '../hooks';
import type { FleetVehicleRow } from '../types';

const fleetVehiclesKey = (kind: 'quotation' | 'policy', id: string) =>
  [...underwriteKeys.all, 'fleet', kind, id, 'vehicles'] as const;

function coverStatus(row: FleetVehicleRow, kind: 'quotation' | 'policy') {
  if (kind === 'policy' && row.policy_risk_statuses.length) {
    const status = row.policy_risk_statuses.join(', ');
    const tone = row.policy_risk_statuses.every(
      (value) => value.toUpperCase() === 'ACTIVE',
    )
      ? 'success'
      : 'secondary';
    return <Badge variant={tone}>{status}</Badge>;
  }
  if (row.cover_note_reference_number) {
    return <Badge variant="success">Cover note issued</Badge>;
  }
  if (row.cover_note_status) {
    return <Badge variant="warning">{row.cover_note_status}</Badge>;
  }
  return <Badge variant="muted">Not issued</Badge>;
}

/**
 * Vehicle-level view of a fleet quotation or policy: each vehicle's cover,
 * premium, cover note / TIRA reference, sticker and cover status, plus fleet
 * totals and its fleet-register link.
 */
export function FleetVehiclesPanel({
  kind,
  id,
  currency = 'TZS',
}: {
  kind: 'quotation' | 'policy';
  id: string;
  currency?: string;
}) {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canSync =
    kind === 'quotation' &&
    hasPermission(underwritePermission('FLEET', UnderwriteAction.EDIT)) &&
    hasPermission('quotations:update');

  const query = useQuery({
    queryKey: fleetVehiclesKey(kind, id),
    queryFn: () => underwriteApi.getFleetVehicles(kind, id),
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: () => underwriteApi.syncFleetRegister(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: fleetVehiclesKey(kind, id),
      });
      if (result.fleetId) toast.success('Fleet register updated');
      else toast.warning(result.skippedReason ?? 'Fleet register not updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const money = (value: number) => formatMoney(value, currency);
  const summary = query.data;
  const vehicles = summary?.vehicles ?? [];
  // Vehicles come back in one response; paginate client-side.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const columns: Column<FleetVehicleRow>[] = [
    { key: 'entry', header: '#', cell: (row) => row.entry_number },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: (row) => (
        <div>
          <span className="block font-medium text-slate-900">
            {row.registration_number || 'N/A'}
          </span>
          <span className="text-xs text-slate-500">
            {[row.make, row.model, row.year_of_manufacture]
              .filter(Boolean)
              .join(' · ') || row.chassis_number}
          </span>
        </div>
      ),
    },
    {
      key: 'cover',
      header: 'Cover',
      hideOnMobile: true,
      cell: (row) => row.risk_codes.join(', ') || '—',
    },
    {
      key: 'sum_insured',
      header: 'Sum insured',
      className: 'text-right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular-nums">{money(row.sum_insured)}</span>
      ),
    },
    {
      key: 'premium',
      header: 'Premium (incl. tax)',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">{money(row.premium_including_tax)}</span>
      ),
    },
    {
      key: 'cover_note',
      header: 'Cover note / sticker',
      hideOnMobile: true,
      cell: (row) => (
        <div className="text-xs">
          <span className="block">
            {row.cover_note_reference_number ?? row.cover_note_number ?? '—'}
          </span>
          {row.sticker_number ? (
            <span className="text-slate-500">Sticker {row.sticker_number}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => coverStatus(row, kind),
    },
  ];

  if (query.error) {
    return (
      <SectionCard title="Fleet vehicles">
        <ErrorState onRetry={() => void query.refetch()} />
      </SectionCard>
    );
  }

  const facts = summary
    ? [
        ['Fleet reference', summary.fleet_reference ?? '—'],
        ['Vehicles', String(summary.totals.vehicles)],
        [
          'Comprehensive',
          summary.comprehensive_insured == null
            ? '—'
            : String(summary.comprehensive_insured),
        ],
        ['Total sum insured', money(summary.totals.sum_insured)],
        ['Total premium', money(summary.totals.premium_including_tax)],
        [
          'Cover notes issued',
          `${summary.totals.issued_cover_notes} of ${summary.totals.vehicles}`,
        ],
      ]
    : [];

  return (
    <SectionCard
      title="Fleet vehicles"
      description={
        summary?.register_fleet_id
          ? `Linked to the fleet register (${summary.register_status ?? 'registered'}).`
          : 'Not yet linked to the fleet register.'
      }
      action={
        canSync ? (
          <Button
            variant="outline"
            size="sm"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {summary?.register_fleet_id ? 'Refresh register' : 'Register fleet'}
          </Button>
        ) : undefined
      }
    >
      {facts.length > 0 && (
        <dl className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <DataTable
        columns={columns}
        data={vehicles.slice((page - 1) * limit, page * limit)}
        loading={query.isLoading}
        page={page}
        limit={limit}
        total={vehicles.length}
        totalPages={Math.max(1, Math.ceil(vehicles.length / limit))}
        onPageChange={setPage}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
        rowKey={(row) => row.entry_id}
        emptyMessage="No fleet vehicles on this record"
        showColumnVisibility={false}
      />
    </SectionCard>
  );
}
