import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { useTiramisAdminHealth, useTiramisServiceHealth } from '../hooks';

function StatusCard({ title, healthy, summary }: { title: string; healthy?: boolean; summary?: unknown }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {healthy ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="font-medium">{healthy ? 'Healthy' : 'Attention required'}</div>
        {summary !== undefined && summary !== null && <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{JSON.stringify(summary, null, 2)}</pre>}
      </CardContent>
    </Card>
  );
}

export function TiramisHealthPage() {
  const { data: serviceHealth, isLoading: serviceLoading } = useTiramisServiceHealth();
  const { data: adminHealth, isLoading: adminLoading } = useTiramisAdminHealth();

  return (
    <div className="space-y-6">
      <PageHeader title="TIRAMIS Health" description="Check service connectivity and admin health signals" />
      <div className="grid gap-4 md:grid-cols-2">
        <StatusCard title="Service Health" healthy={serviceHealth?.healthy} summary={serviceHealth ?? undefined} />
        <StatusCard title="Admin Health" healthy={adminHealth?.healthy} summary={adminHealth ?? undefined} />
      </div>
      {serviceLoading || adminLoading ? <p className="text-sm text-slate-500">Loading health checks...</p> : null}
    </div>
  );
}
