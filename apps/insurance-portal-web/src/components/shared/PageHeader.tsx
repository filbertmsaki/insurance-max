import type { ReactNode } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumbs?: string[];
  eyebrow?: string;
  status?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  eyebrow,
  status,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex items-center gap-1 text-xs text-slate-500"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            {breadcrumbs.map((crumb, index) => (
              <span
                key={crumb + index}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-slate-300"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    'truncate',
                    index === breadcrumbs.length - 1 &&
                      'font-medium text-slate-700',
                  )}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
