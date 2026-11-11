import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppBarConfig } from '@/components/layout/app-bar/AppBarConfig';
import { PRIMARY_BUTTON } from './ListStates';
import type { Chip } from './types';

/**
 * Breadcrumb, title, description and the primary action. On phones the
 * breadcrumb and description are hidden, the title sits in a 56px bar and the
 * primary action becomes a floating button.
 */
export function ListHeader({
  title,
  description,
  breadcrumb,
  primaryAction,
  extras,
}: {
  title: string;
  description?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  primaryAction?: { label: string; onClick: () => void };
  extras?: ReactNode;
}) {
  return (
    <>
      {/* Phones: the title lives in the shared app bar. */}
      <AppBarConfig title={title} />
      <header className="mb-4 flex items-end justify-between gap-3 max-md:hidden">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-1 max-md:hidden">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-[#5B6275]">
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  ) : null}
                  {crumb.href && index < breadcrumb.length - 1 ? (
                    <Link
                      to={crumb.href}
                      className="rounded hover:text-[#1B1F2E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={
                        index === breadcrumb.length - 1 ? 'page' : undefined
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="truncate text-lg font-bold text-[#1B1F2E] md:text-[22px] md:leading-8 lg:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 truncate text-sm text-[#5B6275] max-md:hidden">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extras ? <div className="max-md:hidden">{extras}</div> : null}
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={cn(PRIMARY_BUTTON, 'max-md:hidden')}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </header>

      {primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="fixed right-4 bottom-5 z-30 flex h-[52px] items-center gap-2 rounded-full bg-[#3B4A8C] px-5 text-[15px] font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-2 md:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Plus className="h-5 w-5" aria-hidden />
          {primaryAction.label}
        </button>
      ) : null}
    </>
  );
}

/** All / Active / Expiring soon / TIRA failed / Drafts, each with a live count. */
export function SummaryChips({
  chips,
  counts,
  value,
  onChange,
  label,
}: {
  chips: Chip[];
  counts?: Record<string, number>;
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {chips.map((chip) => {
        const id = chip.id === 'all' ? '' : chip.id;
        const selected = value === id;
        const count = counts?.[chip.id];
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-1 md:h-9',
              selected
                ? 'border-transparent bg-[#3B4A8C] text-white'
                : 'border-[#E6E8EF] bg-white text-[#1B1F2E] hover:bg-[#F7F8FC]',
            )}
          >
            {chip.label}
            {count !== undefined ? (
              <span
                className={cn(
                  'min-w-6 rounded-full px-1.5 text-xs tabular-nums',
                  selected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EEF0F4] text-[#4A5165]',
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
