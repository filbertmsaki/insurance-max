import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { auditApi, type AuditLog } from '../api/audit';

const AUDIT_FILTER_KEYS = ['status'] as const;
type AuditFilterKey = (typeof AUDIT_FILTER_KEYS)[number];
const AUDIT_STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

const columns: Column<AuditLog>[] = [
  {
    key: 'created_at',
    header: 'Time',
    sortable: true,
    cell: (entry) => (
      <span className="whitespace-nowrap text-slate-600">
        {new Date(entry.created_at).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    sortable: true,
    cell: (entry) => <span className="font-medium">{entry.action}</span>,
  },
  {
    key: 'resource',
    header: 'Resource',
    sortable: true,
    cell: (entry) => (
      <>
        {entry.resource ?? '—'}
        {entry.resource_id ? (
          <span className="block max-w-48 truncate font-mono text-xs text-slate-500">
            {entry.resource_id}
          </span>
        ) : null}
      </>
    ),
  },
  {
    key: 'actor_type',
    header: 'Actor',
    sortable: true,
    cell: (entry) => (
      <>
        {entry.actor_type}
        {entry.actor_service ? ` · ${entry.actor_service}` : ''}
      </>
    ),
  },
  {
    key: 'status',
    header: 'Outcome',
    sortable: true,
    cell: (entry) => (
      <Badge variant={entry.status === 'success' ? 'secondary' : 'destructive'}>
        {entry.status}
      </Badge>
    ),
  },
  {
    key: 'request_id',
    header: 'Request',
    hideOnMobile: true,
    cell: (entry) => (
      <span className="block max-w-40 truncate font-mono text-xs text-slate-500">
        {entry.request_id ?? '—'}
      </span>
    ),
  },
];

export function AuditLogsPage() {
  const canVerifyChain = useAuthStore((state) =>
    state.hasPermission('audit:verify-chain'),
  );
  const {
    tableProps,
    state,
    query: logs,
  } = useServerTable<AuditLog, AuditFilterKey>({
    queryKey: ['audit-logs'],
    fetcher: (params, signal) => auditApi.search(params, signal),
    filterKeys: AUDIT_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });
  const chain = useQuery({
    queryKey: ['audit-chain-status'],
    queryFn: auditApi.verifyChain,
    staleTime: 60_000,
    enabled: canVerifyChain,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="Review recorded activity and verify the audit hash chain. Results follow your organization access permissions."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void logs.refetch();
              void chain.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />
      {canVerifyChain ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" /> Hash chain
            </div>
            {chain.isLoading ? (
              <span className="text-sm text-slate-500">Checking…</span>
            ) : chain.isError ? (
              <Badge variant="destructive">Status unavailable</Badge>
            ) : (
              <Badge variant={chain.data?.valid ? 'secondary' : 'destructive'}>
                {chain.data?.valid ? 'Valid' : 'Integrity issue'}
              </Badge>
            )}
            {chain.data ? (
              <span className="text-sm text-slate-600">
                {chain.data.totalEvents} events checked
                {chain.data.brokenEventId
                  ? ` · issue ${chain.data.brokenEventId} (${chain.data.reason})`
                  : ''}
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search action, resource or request ID…"
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Outcome', options: AUDIT_STATUS_OPTIONS },
        ])}
        error={
          tableProps.error
            ? 'Could not load audit events. Check that you have audit read access.'
            : undefined
        }
        emptyMessage="No audit events recorded yet"
        noResultsMessage="No events match these filters."
      />
    </div>
  );
}
