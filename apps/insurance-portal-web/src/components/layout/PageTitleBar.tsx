import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const GENERIC_CRUMBS = new Set(['Details', 'New', 'Edit']);

function titleFor(crumbs: string[]) {
  const last = crumbs[crumbs.length - 1] ?? '';
  if (!GENERIC_CRUMBS.has(last) || crumbs.length < 2) return last;
  const parent = crumbs[crumbs.length - 2];
  return last === 'Details' ? `${parent} Details` : `${last} ${parent}`;
}

/** Velzon-style full-width page title strip rendered under the topbar. */
export function PageTitleBar({
  crumbs,
  className,
}: {
  crumbs: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-4 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(56,65,74,0.15)] sm:px-5 lg:px-6',
        className,
      )}
    >
      <h4 className="truncate text-[15px] font-bold uppercase tracking-wide text-slate-800">
        {titleFor(crumbs)}
      </h4>
      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex"
      >
        {crumbs.map((crumb, index) => (
          <span
            key={crumb + index}
            className="flex min-w-0 items-center gap-1.5"
          >
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'truncate',
                index === crumbs.length - 1
                  ? 'text-slate-500'
                  : 'text-slate-700',
              )}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
}
