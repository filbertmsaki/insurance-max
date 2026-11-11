import { FileSearch, Inbox, Plus, RefreshCw, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_BUTTON =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#3B4A8C] px-4 text-sm font-semibold text-white hover:bg-[#2A3668] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-2';
const SECONDARY_BUTTON =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#E6E8EF] bg-white px-4 text-sm font-semibold text-[#1B1F2E] hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-2';

export { PRIMARY_BUTTON, SECONDARY_BUTTON };

/**
 * Empty, no-results and error states shared by the table and the phone list.
 */
export function ListMessage({
  variant,
  noun,
  search,
  primaryAction,
  onClearFilters,
  onRetry,
  className,
}: {
  variant: 'empty' | 'no-results' | 'error';
  noun: { one: string; many: string };
  search?: string;
  primaryAction?: { label: string; onClick: () => void };
  onClearFilters?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const Icon =
    variant === 'error' ? FileSearch : variant === 'empty' ? Inbox : SearchX;
  const title =
    variant === 'error'
      ? `We couldn't load the ${noun.many}`
      : variant === 'empty'
        ? `No ${noun.many} yet`
        : search
          ? `No results for '${search}'`
          : `No ${noun.many} match these filters`;
  const body =
    variant === 'error'
      ? 'Check your connection and try again.'
      : variant === 'empty'
        ? `${noun.many.charAt(0).toUpperCase()}${noun.many.slice(1)} you can see will appear here.`
        : 'Try a different search or clear the filters.';

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF0F4] text-[#4A5165]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-[#1B1F2E]">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[#5B6275]">{body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {variant === 'error' && onRetry ? (
          <button type="button" className={SECONDARY_BUTTON} onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        ) : null}
        {variant === 'no-results' && onClearFilters ? (
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        ) : null}
        {variant === 'empty' && primaryAction ? (
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={primaryAction.onClick}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {primaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
