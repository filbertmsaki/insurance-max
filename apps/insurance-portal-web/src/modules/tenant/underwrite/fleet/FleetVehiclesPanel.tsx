import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { SectionCard } from '@/components/shared/DetailSections';
import { SectionCard as QuotationSection } from '@/modules/tenant/quotations/components/QuotationDetailLayout';
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
  if (row.vehicle_status === 'CANCELLED') {
    return (
      <Badge variant="secondary">
        Removed{row.removed_at ? ` from ${row.removed_at}` : ''}
      </Badge>
    );
  }
  if (row.vehicle_status === 'REMOVED') {
    return <Badge variant="secondary">Removal pending</Badge>;
  }
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
  showSummary = true,
}: {
  kind: 'quotation' | 'policy';
  id: string;
  currency?: string;
  /** Off where the page already shows fleet totals (the quotation details tab). */
  showSummary?: boolean;
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
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: fleetVehiclesKey(kind, id),
      });
      // The API client already toasts; the inline alert below keeps it visible.
    },
  });

  const money = (value: number) => formatMoney(value, currency);
  // Inside the quotation tabs, match the tab's flat sections instead of
  // nesting a card.
  const Section = showSummary ? SectionCard : QuotationSection;
  const summary = query.data;
  const vehicles = summary?.vehicles ?? [];
  // Vehicles come back in one response; paginate client-side.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const vehicleTitle = (row: FleetVehicleRow) =>
    row.registration_number || row.chassis_number || 'N/A';
  const vehicleSubtitle = (row: FleetVehicleRow) =>
    [row.make, row.model, row.year_of_manufacture].filter(Boolean).join(' · ') ||
    row.chassis_number;
  const coverNote = (row: FleetVehicleRow) =>
    row.cover_note_reference_number ?? row.cover_note_number ?? null;

  const columns: Column<FleetVehicleRow>[] = [
    {
      key: 'entry',
      header: '#',
      className: 'w-12 text-slate-500 tabular-nums',
      cell: (row) => row.entry_number,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      className: 'min-w-48',
      cell: (row) => (
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {vehicleTitle(row)}
            {row.vehicle_status === 'ADDED' && (
              <Badge variant="outline">
                Added{row.added_at ? ` ${row.added_at}` : ''}
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {vehicleSubtitle(row)}
          </span>
        </div>
      ),
    },
    {
      key: 'cover',
      header: 'Cover',
      className: 'whitespace-nowrap font-mono text-xs text-slate-700',
      cell: (row) => row.risk_codes.join(', ') || '—',
    },
    {
      key: 'sum_insured',
      header: 'Sum insured',
      className: 'whitespace-nowrap text-right',
      cell: (row) => (
        <span className="tabular-nums text-slate-700">
          {money(row.sum_insured)}
        </span>
      ),
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'whitespace-nowrap text-right',
      cell: (row) => (
        <span className="font-semibold tabular-nums text-slate-900">
          {money(row.premium_including_tax)}
        </span>
      ),
    },
    {
      key: 'cover_note',
      header: 'Cover note / sticker',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="space-y-0.5 font-mono text-xs">
          <span className="block text-slate-900">{coverNote(row) ?? '—'}</span>
          {row.sticker_number ? (
            <span className="block text-slate-500">
              <span className="font-sans">Sticker</span> {row.sticker_number}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      cell: (row) => coverStatus(row, kind),
    },
  ];
  const totalPages = Math.max(1, Math.ceil(vehicles.length / limit));
  const pageRows = vehicles.slice((page - 1) * limit, page * limit);

  if (query.error) {
    return (
      <Section title="Fleet vehicles">
        <ErrorState onRetry={() => void query.refetch()} />
      </Section>
    );
  }

  const facts =
    summary && showSummary
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
  const registerNote = summary?.register_fleet_id
    ? `Linked to the fleet register (${summary.register_status ?? 'registered'}).`
    : 'Not yet linked to the fleet register.';

  return (
    <Section
      title={showSummary ? 'Fleet vehicles' : 'Vehicle cover notes'}
      description={
        !showSummary && summary
          ? `${summary.totals.issued_cover_notes} of ${summary.totals.vehicles} cover notes issued. ${registerNote}`
          : registerNote
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
            {sync.isPending
              ? 'Synchronizing...'
              : summary?.register_sync_status === 'FAILED' ||
                  summary?.register_sync_status === 'SKIPPED'
                ? 'Retry synchronization'
                : summary?.register_fleet_id
                  ? 'Refresh register'
                  : 'Register fleet'}
          </Button>
        ) : undefined
      }
    >
      {kind === 'quotation' &&
        summary?.register_sync_status &&
        (() => {
          const problem =
            summary.register_sync_status === 'FAILED' ||
            summary.register_sync_status === 'SKIPPED';
          const synced = summary.register_sync_status === 'SYNCED';
          const StatusIcon = sync.isPending
            ? Loader2
            : problem
              ? AlertTriangle
              : synced
                ? CheckCircle2
                : Clock;
          return (
            <div
              role={
                summary.register_sync_status === 'FAILED' ? 'alert' : 'status'
              }
              className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                problem
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : synced
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <StatusIcon
                className={`mt-0.5 h-5 w-5 shrink-0 ${sync.isPending ? 'animate-spin' : ''} ${
                  problem
                    ? 'text-amber-600'
                    : synced
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  Fleet register:{' '}
                  {sync.isPending
                    ? 'synchronizing'
                    : summary.register_sync_status.toLowerCase()}
                </p>
                {summary.register_sync_error && (
                  <p className="mt-1">{summary.register_sync_error}</p>
                )}
                {summary.register_sync_attempted_at && (
                  <p className="mt-1 text-xs opacity-80">
                    Last attempt:{' '}
                    {new Date(
                      summary.register_sync_attempted_at,
                    ).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      {sync.isError && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {getApiErrorMessage(sync.error)}
        </p>
      )}
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
      {/* Mobile: one card per vehicle so nothing is hidden or squeezed. */}
      <div className="space-y-3 md:hidden">
        {query.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Loading vehicles...
          </p>
        ) : pageRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
            No fleet vehicles on this record
          </p>
        ) : (
          pageRows.map((row) => (
            <article
              key={row.entry_id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {row.entry_number}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
                      {vehicleTitle(row)}
                    </p>
                    <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">
                      {vehicleSubtitle(row)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">{coverStatus(row, kind)}</div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Premium (incl. tax)</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {money(row.premium_including_tax)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Sum insured</dt>
                  <dd className="tabular-nums text-slate-700">
                    {money(row.sum_insured)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Cover note</dt>
                  <dd className="font-mono text-xs text-slate-900 [overflow-wrap:anywhere]">
                    {coverNote(row) ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Sticker</dt>
                  <dd className="font-mono text-xs text-slate-900 [overflow-wrap:anywhere]">
                    {row.sticker_number ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Cover</dt>
                  <dd className="font-mono text-xs text-slate-700">
                    {row.risk_codes.join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
        {totalPages > 1 && (
          <nav
            aria-label="Vehicle pages"
            className="flex items-center justify-between gap-2 pt-1"
          >
            <Button
              variant="outline"
              className="min-h-11"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={pageRows}
          loading={query.isLoading}
          page={page}
          limit={limit}
          total={vehicles.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          rowKey={(row) => row.entry_id}
          emptyMessage="No fleet vehicles on this record"
          showColumnVisibility={false}
        />
      </div>
    </Section>
  );
}
