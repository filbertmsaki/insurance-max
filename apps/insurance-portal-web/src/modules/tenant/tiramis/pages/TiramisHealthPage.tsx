import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
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
  healthy,
  details,
}: {
  title: string;
  healthy?: boolean;
  details?: unknown;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {healthy ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="font-medium">
          {healthy ? 'Healthy' : 'Attention required'}
        </div>
        {details ? <HealthDetails value={details} /> : null}
      </CardContent>
    </Card>
  );
}

export function TiramisHealthPage() {
  const { data: serviceHealth, isLoading: serviceLoading } =
    useTiramisServiceHealth();
  const { data: adminHealth, isLoading: adminLoading } =
    useTiramisAdminHealth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Health"
        description="Check service connectivity and admin health signals"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatusCard
          title="Service Health"
          healthy={serviceHealth?.healthy ?? serviceHealth?.status === 'UP'}
          details={serviceHealth ?? undefined}
        />
        <StatusCard
          title="Admin Health"
          healthy={adminHealth?.healthy}
          details={adminHealth ?? undefined}
        />
      </div>
      {serviceLoading || adminLoading ? (
        <p className="text-sm text-slate-500">Loading health checks...</p>
      ) : null}
    </div>
  );
}
