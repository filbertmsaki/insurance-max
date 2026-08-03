import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Server,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ContentStates';
import { useTiramisAdminHealth, useTiramisServiceHealth } from '../hooks';

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function HealthDetails({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
        <div
          key={key}
          className="grid gap-2 border-b border-slate-100 p-3 last:border-0 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,2fr)]"
        >
          <p className="font-medium text-slate-600">{formatLabel(key)}</p>
          <div className="min-w-0 break-words text-slate-800">
            {item && typeof item === 'object' ? (
              <HealthDetails value={item} />
            ) : (
              <span>
                {item === null || item === undefined || item === ''
                  ? '—'
                  : String(item)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCard({
  title,
  description,
  icon: Icon,
  healthy,
  details,
  loading,
  error,
  onRetry,
}: {
  title: string;
  description: string;
  icon: typeof Server;
  healthy?: boolean;
  details?: unknown;
  loading?: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  const statusLabel = loading
    ? 'Checking...'
    : healthy
      ? 'Healthy'
      : 'Attention required';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
              <Icon className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {description}
              </p>
            </div>
          </div>
          <Badge variant={healthy ? 'success' : loading ? 'muted' : 'warning'}>
            {healthy ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <AlertTriangle className="mr-1 h-3 w-3" />
            )}
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {error ? (
          <ErrorState
            title="Health check failed"
            description="The health check could not be completed."
            onRetry={onRetry}
          />
        ) : loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" /> Checking status...
          </div>
        ) : details ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Check details
              </p>
              <Button variant="ghost" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
            <HealthDetails value={details} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TiramisHealthPage() {
  const {
    data: serviceHealth,
    isLoading: serviceLoading,
    isError: serviceError,
    refetch: refetchService,
  } = useTiramisServiceHealth();
  const {
    data: adminHealth,
    isLoading: adminLoading,
    isError: adminError,
    refetch: refetchAdmin,
  } = useTiramisAdminHealth();
  const adminHealthDetails = adminHealth
    ? Object.fromEntries(
        Object.entries(adminHealth).filter(([key]) => key !== 'summary'),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Health"
        description="Check service connectivity and admin health signals"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatusCard
          title="Service Health"
          description="Connectivity between the portal and the live TIRAMIS service."
          icon={Server}
          healthy={serviceHealth?.healthy ?? serviceHealth?.status === 'UP'}
          details={serviceHealth ?? undefined}
          loading={serviceLoading}
          error={serviceError}
          onRetry={() => void refetchService()}
        />
        <StatusCard
          title="Admin Health"
          description="Portal tracking database and TIRAMIS monitoring statistics."
          icon={Database}
          healthy={adminHealth?.healthy}
          details={adminHealthDetails}
          loading={adminLoading}
          error={adminError}
          onRetry={() => void refetchAdmin()}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Activity className="h-3.5 w-3.5" /> Checks refresh automatically every
        30 seconds.
        <Clock3 className="ml-2 h-3.5 w-3.5" /> Use Refresh to check
        immediately.
      </div>
    </div>
  );
}
