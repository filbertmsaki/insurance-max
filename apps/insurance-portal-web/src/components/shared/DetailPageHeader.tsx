import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DetailPageKpi {
  label: string;
  value: ReactNode;
}

interface DetailPageHeaderProps {
  onBack: () => void;
  title: string;
  badges?: ReactNode;
  subtitle?: ReactNode;
  kpis?: DetailPageKpi[];
  actions?: ReactNode;
}

/** Shared number + status + KPI-strip + actions header for a Quotation/Policy detail page. */
export function DetailPageHeader({
  onBack,
  title,
  badges,
  subtitle,
  kpis,
  actions,
}: DetailPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              {badges}
            </div>
            {subtitle ? (
              <p className="text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions}
      </div>

      {kpis && kpis.length > 0 ? (
        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
          {kpis.map((kpi) => (
            <div key={kpi.label}>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {kpi.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
