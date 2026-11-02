import { Link } from 'react-router-dom';
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
  links,
  className,
}: {
  crumbs: string[];
  links?: Record<string, string>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(56,65,74,0.15)] sm:px-5 lg:px-6',
        className,
      )}
    >
      <h4 className="truncate text-[15px] font-bold uppercase tracking-wide text-slate-800">
        {titleFor(crumbs)}
      </h4>
      <nav
        aria-label="Breadcrumb"
        className={cn(
          'min-w-0 items-center gap-1.5 text-[13px]',
          links ? 'flex' : 'hidden sm:flex',
        )}
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
            {index < crumbs.length - 1 && links?.[crumb] ? (
              <Link
                to={links[crumb]}
                className="truncate py-1 text-slate-700 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {crumb}
              </Link>
            ) : (
              <span
                aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                className={cn(
                  'truncate',
                  index === crumbs.length - 1
                    ? 'text-slate-500'
                    : 'text-slate-700',
                )}
              >
                {crumb}
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
