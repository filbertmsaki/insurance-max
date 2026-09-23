import type { ComponentType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Trend = { value: string; direction?: 'up' | 'down' | 'neutral' };

export type DashboardCardTone =
  | 'primary'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'secondary';

const TONE_CLASSES: Record<DashboardCardTone, string> = {
  primary: 'bg-blue-600/10 text-blue-600',
  success: 'bg-green-500/10 text-green-600',
  info: 'bg-sky-500/10 text-sky-600',
  warning: 'bg-amber-500/15 text-amber-600',
  danger: 'bg-red-500/10 text-red-500',
  secondary: 'bg-vz-secondary/10 text-vz-secondary',
};

interface DashboardCardProps {
  title: string;
  value?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  description?: ReactNode;
  trend?: Trend;
  status?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  className?: string;
  tone?: DashboardCardTone;
}

/** Velzon "tile" widget: uppercase label, trend, big value and a soft icon. */
export function DashboardCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  status,
  action,
  loading,
  className,
  tone = 'primary',
}: DashboardCardProps) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>
        {!loading && trend ? (
          <span
            className={cn(
              'flex shrink-0 items-center gap-0.5 text-[13px] font-medium',
              trend.direction === 'up'
                ? 'text-green-500'
                : trend.direction === 'down'
                  ? 'text-red-500'
                  : 'text-slate-500',
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            ) : trend.direction === 'down' ? (
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Minus className="h-4 w-4" aria-hidden="true" />
            )}
            {trend.value}
          </span>
        ) : null}
        {action}
      </div>

      <div className="mt-4 flex flex-1 items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-[22px] font-semibold leading-tight text-slate-800">
                {value ?? '—'}
              </p>
              {status}
            </div>
          )}
          {loading ? (
            <Skeleton className="h-3.5 w-36" />
          ) : description ? (
            <div className="text-xs leading-5 text-slate-500">
              {description}
            </div>
          ) : null}
        </div>
        {Icon && (
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-md',
              TONE_CLASSES[tone],
            )}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
      </div>
    </Card>
  );
}

export const StatisticCard = DashboardCard;
export const SummaryCard = DashboardCard;
export const FinancialCard = DashboardCard;
export const StatusCard = DashboardCard;
export const ProgressCard = DashboardCard;
