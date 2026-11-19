import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  FINANCE_EVENT_STATUSES,
  financeEventsApi,
  type FinanceEventRow,
  type FinanceReplayRequest,
} from './api';

const PAGE_SIZE = 25;

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const message = data?.message;
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object' && 'message' in message)
    return String((message as { message: unknown }).message);
  return 'The request failed.';
}

function duration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

const statusTone: Record<string, 'success' | 'muted' | 'info' | 'warning' | 'danger'> = {
  PUBLISHED: 'success',
  PENDING: 'muted',
  PROCESSING: 'info',
  FAILED: 'warning',
  BLOCKED: 'danger',
  DEAD_LETTER: 'danger',
};

/**
 * Finance event monitoring. Totals come from server-side aggregates for the
 * caller's company; every action calls an authorized backend endpoint and the
 * server enforces permissions, company scope and maker/checker independence.
 */
export function FinanceEventMonitoringPage() {
  const queryClient = useQueryClient();
  const canRequest = useAuthStore((s) =>
    s.hasPermission('finance-events:replay-request'),
  );
  const canApprove = useAuthStore((s) =>
    s.hasPermission('finance-events:replay-approve'),
  );
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['finance', 'events', 'summary'],
    queryFn: financeEventsApi.summary,
  });
  const events = useQuery({
    queryKey: ['finance', 'events', 'list', status, page],
    queryFn: () =>
      financeEventsApi.list({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const replays = useQuery({
    queryKey: ['finance', 'events', 'replays'],
    queryFn: () => financeEventsApi.replays(),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['finance', 'events'] });

  const s = summary.data;
  const totalPages = Math.max(
    1,
    Math.ceil((events.data?.total ?? 0) / PAGE_SIZE),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance event monitoring"
        description="Outbox processing, durable outcomes and controlled replay. Published means the consumer finished; the accounting outcome column shows whether a journal exists."
      />

      {summary.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(summary.error)}
        </p>
      )}

      {s && s.alerts.length > 0 && (
        <div className="space-y-2" aria-label="Alerts">
          {s.alerts.map((alert) => (
            <p
              key={alert.message}
              role="alert"
              className={
                alert.level === 'critical'
                  ? 'rounded border border-destructive p-2 text-sm text-destructive'
                  : 'rounded border p-2 text-sm'
              }
            >
              {alert.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FINANCE_EVENT_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(status === key ? '' : key);
              setPage(1);
            }}
            className="rounded-lg border p-3 text-left hover:bg-muted"
            aria-pressed={status === key}
            data-testid={`count-${key}`}
          >
            <div className="text-xs text-muted-foreground">{key}</div>
            <div className="text-2xl font-semibold">
              {s ? s.counts[key] : '—'}
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <Metric label="Total events" value={s?.total} />
          <Metric label="Oldest open event" value={duration(s?.oldestOpenAgeSeconds)} />
          <Metric
            label="Latency 24h (avg / p95)"
            value={
              s
                ? `${duration(s.latency24h.avgSeconds)} / ${duration(s.latency24h.p95Seconds)}`
                : undefined
            }
          />
          <Metric
            label="Replays awaiting approval"
            value={s?.replays.awaiting_approval}
          />
          <Metric label="Open events retrying" value={s?.retrying} />
          <Metric label="Total attempts" value={s?.totalAttempts} />
          {s?.accountingOutcomes.map((row) => (
            <Metric
              key={row.accounting_outcome}
              label={`Accounting: ${row.accounting_outcome}`}
              value={row.n}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Events</CardTitle>
          <NativeSelect
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {FINANCE_EVENT_STATUSES.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </NativeSelect>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {events.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(events.error)}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Accounting</TableHead>
                <TableHead>Failure</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.data?.items.map((row: FinanceEventRow) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.event_type}
                    <span className="text-xs text-muted-foreground"> v{row.schema_version}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusTone[row.status] ?? 'muted'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.attempt_count}</TableCell>
                  <TableCell>{duration(row.age_seconds)}</TableCell>
                  <TableCell>{row.business_outcome ?? '—'}</TableCell>
                  <TableCell>
                    {row.accounting_outcome ?? '—'}
                    {row.accounting_reference && (
                      <div className="font-mono text-xs">{row.accounting_reference}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={row.last_error ?? ''}>
                    {row.failure_class ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelected(row.id)}>
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {events.data && events.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No events.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              {events.data?.total ?? 0} event(s) · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <EventDetail
          id={selected}
          canRequest={canRequest}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}

      <ReplayQueue
        requests={replays.data ?? []}
        canApprove={canApprove}
        canRequest={canRequest}
        onChanged={refresh}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value === undefined ? '—' : String(value)}</div>
    </div>
  );
}

function EventDetail({
  id,
  canRequest,
  onClose,
  onChanged,
}: {
  id: string;
  canRequest: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState('');
  const detail = useQuery({
    queryKey: ['finance', 'events', 'detail', id],
    queryFn: () => financeEventsApi.detail(id),
  });
  const request = useMutation({
    mutationFn: () => financeEventsApi.requestReplay(id, reason),
    onSuccess: () => {
      toast.success('Replay requested; another user must approve it.');
      setReason('');
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const d = detail.data;
  const replayable = d && ['DEAD_LETTER', 'BLOCKED'].includes(d.event.status);

  return (
    <Card aria-label="Event detail">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Event {id}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {detail.isError && (
          <p role="alert" className="text-destructive">
            {errorMessage(detail.error)}
          </p>
        )}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Type" value={`${d.event.event_type} v${d.event.schema_version}`} />
              <Metric label="Status" value={d.event.status} />
              <Metric label="Event key" value={d.event.event_key} />
              <Metric label="Failure" value={d.event.failure_class ?? '—'} />
            </div>
            {d.event.last_error && <p className="text-destructive">{d.event.last_error}</p>}

            <section>
              <h3 className="mb-1 font-medium">Outcomes</h3>
              {d.outcomes.length === 0 && <p className="text-muted-foreground">No outcome recorded.</p>}
              {d.outcomes.map((o) => (
                <div key={o.id} className="rounded border p-2">
                  <div>
                    {o.consumer} · {o.operation} · {o.source_type} {o.source_id}
                    {o.source_revision ? ` rev ${o.source_revision}` : ''}
                  </div>
                  <div>
                    Business: <strong>{o.business_outcome}</strong> · Accounting:{' '}
                    <strong>{o.accounting_outcome}</strong>
                    {o.accounting_reference && (
                      <span className="font-mono"> (journal {o.accounting_reference})</span>
                    )}
                  </div>
                  {o.detail && <div className="text-muted-foreground">{o.detail}</div>}
                </div>
              ))}
            </section>

            <section>
              <h3 className="mb-1 font-medium">Attempt history</h3>
              <ul className="space-y-1">
                {d.attempts.map((a) => (
                  <li key={a.id}>
                    #{a.claim_generation} {a.trigger} → {a.result}
                    {a.failure_class ? ` (${a.failure_class})` : ''} at{' '}
                    {new Date(a.finished_at).toLocaleString()}
                    {a.error ? ` — ${a.error}` : ''}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-1 font-medium">Replay history</h3>
              {d.replays.length === 0 && <p className="text-muted-foreground">No replay requests.</p>}
              {d.replays.map((r) => (
                <div key={r.id} className="rounded border p-2">
                  {r.status} — {r.reason}
                  <ul className="text-xs text-muted-foreground">
                    {r.audit?.map((a, i) => (
                      <li key={i}>
                        {a.action} by {a.actor_id} at {new Date(a.recorded_at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {canRequest && replayable && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  request.mutate();
                }}
              >
                <label htmlFor="replay-reason" className="font-medium">
                  Replay reason
                </label>
                <Textarea
                  id="replay-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={10}
                  required
                />
                <Button type="submit" disabled={reason.trim().length < 10 || request.isPending}>
                  Request replay
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReplayQueue({
  requests,
  canApprove,
  canRequest,
  onChanged,
}: {
  requests: FinanceReplayRequest[];
  canApprove: boolean;
  canRequest: boolean;
  onChanged: () => void;
}) {
  const action = useMutation({
    mutationFn: ({
      id,
      kind,
    }: {
      id: string;
      kind: 'APPROVE' | 'REJECT' | 'EXECUTE' | 'CANCEL';
    }) =>
      kind === 'EXECUTE'
        ? financeEventsApi.executeReplay(id)
        : kind === 'CANCEL'
          ? financeEventsApi.cancelReplay(id)
          : financeEventsApi.decideReplay(id, kind),
    onSuccess: (_, { kind }) => {
      toast.success(`Replay ${kind.toLowerCase()} recorded.`);
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replay requests</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Result</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.event_type} <span className="text-xs text-muted-foreground">{r.event_status}</span>
                </TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="max-w-xs truncate" title={r.reason}>
                  {r.reason}
                </TableCell>
                <TableCell>{r.execution_result ?? '—'}</TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  {canApprove && r.status === 'REQUESTED' && (
                    <>
                      <Button size="sm" onClick={() => action.mutate({ id: r.id, kind: 'APPROVE' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => action.mutate({ id: r.id, kind: 'REJECT' })}>
                        Reject
                      </Button>
                    </>
                  )}
                  {canApprove && r.status === 'APPROVED' && (
                    <Button size="sm" onClick={() => action.mutate({ id: r.id, kind: 'EXECUTE' })}>
                      Execute
                    </Button>
                  )}
                  {canRequest && ['REQUESTED', 'APPROVED'].includes(r.status) && (
                    <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: r.id, kind: 'CANCEL' })}>
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No replay requests.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
