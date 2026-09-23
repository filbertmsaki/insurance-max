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
              <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">
                {title}
              </h1>
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
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200/70 bg-slate-200/70 shadow-sm sm:grid-cols-3 lg:flex">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex-1 bg-white px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {kpi.label}
              </div>
              <div className="mt-1 text-[15px] font-semibold text-slate-800">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
