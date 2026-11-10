import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDebouncedValue,
  type DataTableFilter,
} from '@/components/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import type { SortOrder } from '@/types';

/*
 * Phone-only (<768px) view of the Motor Insurance quotation register. It is a
 * pure presentation of the page's useServerTable state: no fetching of its own.
 */

const PRIMARY = '#3B4A8C';
const ALL_VALUE = '__all__';

export type MotorTypeChip = '' | 'single' | 'fleet';

const TYPE_CHIPS: Array<{ value: MotorTypeChip; label: string }> = [
  { value: '', label: 'All' },
  { value: 'single', label: 'Single' },
  { value: 'fleet', label: 'Fleet' },
];

const SORTS = [
  { value: 'newest', label: 'Newest', sortBy: 'created_at', order: 'DESC' },
  { value: 'oldest', label: 'Oldest', sortBy: 'created_at', order: 'ASC' },
  {
    value: 'premium',
    label: 'Premium',
    sortBy: 'total_premium_including_tax',
    order: 'DESC',
  },
] as const;

interface MotorQuotationMobileListProps {
  rows: QuotationListItem[];
  total: number;
  loading: boolean;
  isFetching: boolean;
  error?: string;
  onRetry: () => void;
  onRefresh: () => Promise<unknown>;
  search: string;
  onSearchChange: (value: string) => void;
  type: MotorTypeChip;
  onTypeChange: (value: MotorTypeChip) => void;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange: (key: string, order: SortOrder) => void;
  /** Extra filters shown in the filter sheet (status, payment, ...). */
  filters: DataTableFilter[];
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpen: (row: QuotationListItem) => void;
  onCreate?: () => void;
  /** Extra controls placed at the top of the filter sheet. */
  sheetExtras?: ReactNode;
}

export function MotorQuotationMobileList(props: MotorQuotationMobileListProps) {
  const {
    rows,
    total,
    loading,
    isFetching,
    error,
    onRetry,
    onRefresh,
    type,
    onTypeChange,
    sortBy,
    sortOrder,
    onSortChange,
    filters,
    onFilterChange,
    page,
    totalPages,
    onPageChange,
    onOpen,
    onCreate,
    sheetExtras,
  } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = filters.filter((f) => f.value).length;
  const sort =
    SORTS.find((s) => s.sortBy === sortBy && s.order === sortOrder) ?? SORTS[0];
  const {
    ref: pullRef,
    distance: pullDistance,
    refreshing,
    armed,
  } = usePullToRefresh(onRefresh);

  return (
    <div
      ref={pullRef}
      className="-mx-3 -mt-5 px-4 pb-28 text-[15px] text-slate-900 md:hidden"
      style={{
        fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        aria-live="polite"
        className="flex items-end justify-center overflow-hidden text-slate-600 transition-[height] duration-150"
        style={{ height: refreshing ? 40 : pullDistance }}
      >
        {refreshing || pullDistance > 0 ? (
          <span className="mb-2 flex items-center gap-2 text-xs font-medium">
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw
                className="h-4 w-4"
                style={{ transform: `rotate(${pullDistance * 3}deg)` }}
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

      {/* Sticky search + filter */}
      <div className="sticky top-0 z-10 -mx-4 bg-[#F4F5F9] px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <MobileSearch value={props.search} onChange={props.onSearchChange} />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={
              activeFilterCount
                ? `Filters (${activeFilterCount} active)`
                : 'Filters'
            }
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E6E8EF] bg-white text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
            {activeFilterCount ? (
              <span
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Chips + sort */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div
          role="radiogroup"
          aria-label="Quotation type"
          className="flex gap-2"
        >
          {TYPE_CHIPS.map((chip) => {
            const selected = chip.value === type;
            return (
              <button
                key={chip.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onTypeChange(chip.value)}
                className={cn(
                  'h-11 rounded-full border px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-1',
                  selected
                    ? 'border-transparent text-white'
                    : 'border-[#E6E8EF] bg-white text-slate-700',
                )}
                style={selected ? { backgroundColor: PRIMARY } : undefined}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <Select
          value={sort.value}
          onValueChange={(value) => {
            const next = SORTS.find((s) => s.value === value) ?? SORTS[0];
            onSortChange(next.sortBy, next.order);
          }}
        >
          <SelectTrigger
            aria-label="Sort quotations"
            className="h-11 w-auto gap-1 border-0 bg-transparent px-2 text-[13px] font-medium text-slate-700 shadow-none"
          >
            <span className="text-slate-600">Sort:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="flex items-center gap-2 py-2 text-[12px] text-slate-600">
        {loading
          ? 'Loading quotations…'
          : `${total} ${total === 1 ? 'quotation' : 'quotations'}`}
        {isFetching && !loading && !refreshing ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-label="Updating" />
        ) : null}
      </p>

      {/* List */}
      {error ? (
        <div className="rounded-2xl border border-[#E6E8EF] bg-white px-4 py-8 text-center">
          <p className="text-[14px] font-semibold">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 h-11 rounded-xl px-5 text-[14px] font-semibold"
            style={{ color: PRIMARY }}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <ul className="divide-y divide-[#E6E8EF] overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex h-16 items-center gap-3 px-4">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-3.5 w-20 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          type={type}
          searching={Boolean(props.search)}
          canCreate={Boolean(onCreate)}
        />
      ) : (
        <ul className="divide-y divide-[#E6E8EF] overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white">
          {rows.map((row) => (
            <li key={row.id}>
              <QuotationRow row={row} onOpen={() => onOpen(row)} />
            </li>
          ))}
        </ul>
      )}

      {/* Pager */}
      {!error && totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-3 flex items-center justify-between text-[13px] text-slate-600"
        >
          <PagerButton
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </PagerButton>
          <span>
            Page {page} of {totalPages}
          </span>
          <PagerButton
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            label="Next page"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </PagerButton>
        </nav>
      ) : null}

      {/* Floating action button */}
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="fixed bottom-5 right-4 z-30 flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-2"
          style={{
            backgroundColor: PRIMARY,
            marginBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Plus className="h-5 w-5" aria-hidden />
          New quotation
        </button>
      ) : null}

      {/* Filter sheet */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {sheetExtras}
            {filters.map((filter) => (
              <label key={filter.key} className="block space-y-1.5">
                <span className="text-[13px] font-medium text-slate-700">
                  {filter.label}
                </span>
                <Select
                  value={filter.value || ALL_VALUE}
                  onValueChange={(value) =>
                    onFilterChange(filter.key, value === ALL_VALUE ? '' : value)
                  }
                >
                  <SelectTrigger
                    className="h-11 w-full rounded-xl"
                    aria-label={filter.label}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>
                      {filter.placeholder ?? `All ${filter.label}`}
                    </SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!activeFilterCount}
                onClick={() =>
                  filters.forEach((f) => f.value && onFilterChange(f.key, ''))
                }
                className="h-11 flex-1 rounded-xl border border-[#E6E8EF] text-[14px] font-semibold text-slate-700 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-11 flex-1 rounded-xl text-[14px] font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                Show results
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuotationRow({
  row,
  onOpen,
}: {
  row: QuotationListItem;
  onOpen: () => void;
}) {
  const fleet = row.quotation_flow === 'MOTOR_FLEET';
  const premium = Number.isFinite(row.total_premium_including_tax)
    ? formatMoney(row.total_premium_including_tax, row.currency_code)
    : '—';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Quotation ${row.quotation_no}, ${row.customer_name || 'no customer'}, premium ${premium}`}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold">
            {row.quotation_no}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              fleet
                ? 'bg-[#E8EBF7] text-[#3B4A8C]'
                : 'bg-slate-100 text-slate-700',
            )}
          >
            {fleet ? 'Fleet' : 'Single'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-slate-600">
          {row.customer_name || 'No customer'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold tabular-nums">{premium}</p>
        <p className="mt-0.5 text-[11px] text-slate-600">Premium</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
    </button>
  );
}

function MobileSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, 350);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current(debounced);
  }, [debounced]);
  // Follow external resets (e.g. company switch clears the search).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== draft.trim()) setDraft(value);
  }

  const label = 'Search by quotation no. or customer';
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden
      />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={label}
        aria-label={label}
        enterKeyHint="search"
        className="h-11 w-full rounded-xl border border-[#E6E8EF] bg-white pl-10 pr-10 text-[15px] text-slate-900 placeholder:text-slate-500 focus:border-[#3B4A8C] focus:outline-none focus:ring-2 focus:ring-[#3B4A8C]/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          onClick={() => setDraft('')}
          aria-label="Clear search"
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-500"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({
  type,
  searching,
  canCreate,
}: {
  type: MotorTypeChip;
  searching: boolean;
  canCreate: boolean;
}) {
  const noun = type ? `${type} quotations` : 'quotations';
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#E6E8EF] bg-white px-6 py-10 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8EBF7]"
        style={{ color: PRIMARY }}
      >
        <FileText className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-[15px] font-semibold">
        {searching ? `No ${noun} match your search` : `No ${noun} yet`}
      </p>
      <p className="mt-1 text-[13px] text-slate-600">
        {searching
          ? 'Try a different quotation number or customer name.'
          : canCreate
            ? 'Tap “New quotation” to create one.'
            : 'Quotations you create will appear here.'}
      </p>
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6E8EF] bg-white text-slate-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const PULL_THRESHOLD = 64;
const PULL_MAX = 96;

/** Touch pull-to-refresh against the nearest scrolling ancestor. */
function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = findScrollParent(el);
    let startY: number | null = null;
    let current = 0;
    let busy = false;

    const onStart = (e: TouchEvent) => {
      startY = !busy && scroller.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0 || scroller.scrollTop > 0) {
        current = 0;
        setDistance(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      current = Math.min(PULL_MAX, delta * 0.5);
      setDistance(current);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      const trigger = current >= PULL_THRESHOLD;
      current = 0;
      setDistance(0);
      if (!trigger) return;
      busy = true;
      setRefreshing(true);
      refreshRef.current().finally(() => {
        busy = false;
        setRefreshing(false);
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return {
    ref,
    distance,
    refreshing,
    armed: distance >= PULL_THRESHOLD,
  };
}

function findScrollParent(el: HTMLElement): HTMLElement {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return document.scrollingElement as HTMLElement;
}
