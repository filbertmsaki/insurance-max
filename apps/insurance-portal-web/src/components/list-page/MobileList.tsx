import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from './usePullToRefresh';
import { TiraBadge, ToneBadge, TypeBadge } from './cells';
import { TONE_TEXT } from './tones';
import { coverHint, formatDate, formatRange, toIsoDate } from './format';
import { SECONDARY_BUTTON } from './ListStates';
import type { Attention, MobileRowView } from './types';

const BAR: Record<Exclude<Attention, null>, string> = {
  danger: 'before:bg-[#B42318]',
  warning: 'before:bg-[#8A4B08]',
};

function MobileRow({
  view,
  href,
  attention,
  selected,
  onOpen,
}: {
  view: MobileRowView;
  href: string;
  attention: Attention;
  selected: boolean;
  onOpen: () => void;
}) {
  const hint = coverHint(view.coverStart, view.coverEnd);
  // The hint replaces "Issued" when the cover is expiring or has expired;
  // from 390px wide both fit, so the issued date stays visible there.
  const showHint =
    hint && (hint.kind === 'expiring' || hint.kind === 'expired');
  const issued = view.issued ? `Issued ${formatDate(view.issued)}` : null;

  return (
    <li
      className={cn(
        'relative min-h-[88px] px-4 py-3',
        selected && 'bg-[#F7F8FC]',
        attention &&
          cn(
            "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
            BAR[attention],
          ),
      )}
    >
      {/* Line 1: number + type | premium */}
      <div className="flex items-center gap-2">
        <Link
          to={href}
          onClick={onOpen}
          aria-label={view.ariaLabel}
          className="min-w-0 truncate text-[15px] font-bold text-[#1B1F2E] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#3B4A8C] focus-visible:after:ring-inset"
        >
          {view.title}
        </Link>
        {view.kind ? <TypeBadge kind={view.kind} /> : null}
        {view.amount ? (
          <span className="ml-auto shrink-0 pl-2 text-[15px] font-bold tabular-nums text-[#1B1F2E]">
            {view.amount}
          </span>
        ) : null}
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-[#5B6275]',
            !view.amount && 'ml-auto',
          )}
          aria-hidden
        />
      </div>
      {/* Line 2: customer | status */}
      <div className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#5B6275]">
          {view.subtitle}
        </span>
        {view.status ? (
          <ToneBadge tone={view.status.tone} className="text-[11px] leading-4">
            {view.status.label}
          </ToneBadge>
        ) : null}
      </div>
      {/* Line 3: cover period · issued / hint | TIRA */}
      {view.coverEnd || view.issued || view.tira ? (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#5B6275]">
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
            {view.coverEnd ? (
              <>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate tabular-nums">
                  <time dateTime={toIsoDate(view.coverStart)}>
                    {formatRange(view.coverStart, view.coverEnd)}
                  </time>
                  {showHint ? (
                    <>
                      {' · '}
                      <span
                        className={cn('font-semibold', TONE_TEXT[hint.tone])}
                      >
                        {hint.text}
                      </span>
                    </>
                  ) : null}
                  {issued ? (
                    <span className={cn(showHint && 'max-[389px]:hidden')}>
                      {' · '}
                      <time dateTime={toIsoDate(view.issued)}>{issued}</time>
                    </span>
                  ) : null}
                </span>
              </>
            ) : issued ? (
              <time dateTime={toIsoDate(view.issued)}>{issued}</time>
            ) : null}
          </span>
          {view.tira ? (
            // Above the row link, so a failure reason can be opened by tap.
            <span className="relative z-10 shrink-0">
              <TiraBadge info={view.tira} compact />
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Phone (<768px) list: one rounded card of tappable rows, then Load more. */
export function MobileList<T>({
  rows,
  rowId,
  mobileRow,
  getRowHref,
  getAttention,
  selectedId,
  onOpen,
  loading,
  fetching,
  total,
  noun,
  hasMore,
  onLoadMore,
  onRefresh,
  message,
}: {
  rows: T[];
  rowId: (row: T) => string;
  mobileRow: (row: T) => MobileRowView;
  getRowHref: (row: T) => string;
  getAttention?: (row: T) => Attention;
  selectedId: string;
  onOpen: (row: T) => void;
  loading: boolean;
  fetching: boolean;
  total: number;
  noun: { one: string; many: string };
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => Promise<unknown>;
  /** Empty / no-results / error content, shown instead of the list. */
  message?: ReactNode;
}) {
  const { ref, distance, refreshing, armed } = usePullToRefresh(onRefresh);

  return (
    <div ref={ref} className="pb-24">
      <div
        aria-live="polite"
        className="flex items-end justify-center overflow-hidden text-[#5B6275] transition-[height] duration-150"
        style={{ height: refreshing ? 36 : distance }}
      >
        {refreshing || distance > 0 ? (
          <span className="mb-1.5 flex items-center gap-2 text-xs font-medium">
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw
                className="h-4 w-4"
                style={{ transform: `rotate(${distance * 3}deg)` }}
                aria-hidden
              />
            )}
            {refreshing
              ? 'Refreshing…'
              : armed
                ? 'Release to refresh'
                : 'Pull to refresh'}
          </span>
        ) : null}
      </div>

      <p className="flex h-8 items-center gap-2 text-[13px] text-[#5B6275]">
        {loading
          ? `Loading ${noun.many}…`
          : `${total} ${total === 1 ? noun.one : noun.many}`}
        {fetching && !loading && !refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Updating" />
        ) : null}
      </p>

      <div className="overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white">
        {loading ? (
          <ul aria-hidden className="divide-y divide-[#EEF0F4]">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="h-[88px] space-y-2 px-4 py-3">
                <div className="flex justify-between">
                  <div className="h-4 w-36 animate-pulse rounded bg-[#EEF0F4]" />
                  <div className="h-4 w-20 animate-pulse rounded bg-[#EEF0F4]" />
                </div>
                <div className="h-3 w-44 animate-pulse rounded bg-[#EEF0F4]" />
                <div className="h-3 w-52 animate-pulse rounded bg-[#EEF0F4]" />
              </li>
            ))}
          </ul>
        ) : message ? (
          message
        ) : (
          <ul
            aria-label={noun.many.charAt(0).toUpperCase() + noun.many.slice(1)}
            className="divide-y divide-[#EEF0F4]"
          >
            {rows.map((row) => {
              const id = rowId(row);
              return (
                <MobileRow
                  key={id}
                  view={mobileRow(row)}
                  href={getRowHref(row)}
                  attention={getAttention?.(row) ?? null}
                  selected={selectedId === id}
                  onOpen={() => onOpen(row)}
                />
              );
            })}
          </ul>
        )}
      </div>

      {!loading && !message && hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={fetching}
          className={cn(SECONDARY_BUTTON, 'mt-3 w-full')}
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Load more {noun.many}
        </button>
      ) : null}
    </div>
  );
}
