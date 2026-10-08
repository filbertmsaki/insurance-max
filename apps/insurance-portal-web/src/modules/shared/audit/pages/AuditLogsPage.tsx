import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { auditApi, type AuditFilters } from '../api/audit';

export function AuditLogsPage() {
  const canVerifyChain = useAuthStore((state) =>
    state.hasPermission('audit:verify-chain'),
  );
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 50 });
  const logs = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditApi.search(filters),
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
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              aria-label="Action filter"
              placeholder="Action"
              value={filters.action ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  action: event.target.value || undefined,
                }))
              }
            />
            <Input
              aria-label="Resource filter"
              placeholder="Resource"
              value={filters.resource ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  resource: event.target.value || undefined,
                }))
              }
            />
            <Input
              aria-label="Request ID filter"
              placeholder="Request ID"
              value={filters.request_id ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  request_id: event.target.value || undefined,
                }))
              }
            />
            <select
              aria-label="Audit status filter"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  status: event.target.value || undefined,
                }))
              }
            >
              <option value="">All outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>
          {logs.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading audit events…
            </p>
          ) : logs.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-red-600">
              Could not load audit events. Check that you have audit read
              access.
            </p>
          ) : (logs.data?.data.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No events match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Resource</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Request</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data!.data.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 font-medium">{entry.action}</td>
                      <td className="px-3 py-3">
                        {entry.resource ?? '—'}
                        {entry.resource_id ? (
                          <span className="block max-w-48 truncate font-mono text-xs text-slate-500">
                            {entry.resource_id}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {entry.actor_type}
                        {entry.actor_service ? ` · ${entry.actor_service}` : ''}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            entry.status === 'success'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="max-w-40 truncate px-3 py-3 font-mono text-xs text-slate-500">
                        {entry.request_id ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-slate-500">
              Page {logs.data?.meta.currentPage ?? filters.page ?? 1} of{' '}
              {logs.data?.meta.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={(filters.page ?? 1) <= 1 || logs.isFetching}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.max((current.page ?? 1) - 1, 1),
                  }))
                }
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  logs.isFetching ||
                  (filters.page ?? 1) >= (logs.data?.meta.totalPages ?? 1)
                }
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: (current.page ?? 1) + 1,
                  }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
