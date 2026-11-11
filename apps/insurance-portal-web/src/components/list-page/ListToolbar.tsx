import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Columns3,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, parseDisplayDate } from './format';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './ListStates';
import type { Chip, DateRangeFilterDef, FilterDef, ListColumn } from './types';
import type { ListStateApi } from './useListState';

const ALL = '__all__';
const SEARCH_DEBOUNCE_MS = 300;

const ICON_BUTTON =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E8EF] bg-white text-[#4A5165] hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] disabled:opacity-50';

/** Search box that reports its value 300ms after the user stops typing. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    // Cleared or restored from outside (e.g. "Clear filters").
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = window.setTimeout(() => onChange(text), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [onChange, text, value]);

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5B6275]"
        aria-hidden
      />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-[10px] border border-[#E6E8EF] bg-white pr-9 pl-9 text-[15px] text-[#1B1F2E] placeholder:text-[#5B6275] focus:border-[#3B4A8C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]/30 md:h-9 md:text-sm"
      />
      {text ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            onChange('');
          }}
          className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#5B6275] hover:text-[#1B1F2E] md:h-7 md:w-7"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function TypeChips({
  chips,
  value,
  onChange,
  label,
}: {
  chips: Chip[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0 gap-1.5 overflow-x-auto"
    >
      {chips.map((chip) => {
        const id = chip.id === 'all' ? '' : chip.id;
        const selected = value === id;
        return (
          <button
            key={chip.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              'h-11 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] focus-visible:ring-offset-1 md:h-9',
              selected
                ? 'border-[#3B4A8C] bg-[#E6ECFA] text-[#2A3D80]'
                : 'border-[#E6E8EF] bg-white text-[#4A5165] hover:bg-[#F7F8FC]',
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectFilter({
  label,
  allLabel,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-11 rounded-[10px] border-[#E6E8EF] bg-white text-sm md:h-9 md:w-auto md:min-w-36',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** One DD/MM/YY date box; reports an ISO date (or '' when cleared). */
function DateBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value ? formatDate(value) : '');
  const [synced, setSynced] = useState(value);
  const [invalid, setInvalid] = useState(false);
  if (synced !== value) {
    setSynced(value);
    setText(value ? formatDate(value) : '');
    setInvalid(false);
  }
  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      if (value) onChange('');
      return;
    }
    const iso = parseDisplayDate(text);
    setInvalid(!iso);
    if (iso) {
      setText(formatDate(iso));
      if (iso !== value) onChange(iso);
    }
  };
  return (
    <span className="flex flex-col">
      <input
        id={id}
        inputMode="numeric"
        placeholder="DD/MM/YY"
        aria-label={`${label} (DD/MM/YY)`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        value={text}
        maxLength={10}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        className={cn(
          'h-11 w-full rounded-[10px] border bg-white px-3 text-[15px] tabular-nums text-[#1B1F2E] placeholder:text-[#5B6275] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]/30 md:h-9 md:w-28 md:text-sm',
          invalid
            ? 'border-[#B42318]'
            : 'border-[#E6E8EF] focus:border-[#3B4A8C]',
        )}
      />
      {invalid ? (
        <span id={`${id}-error`} className="mt-0.5 text-xs text-[#B42318]">
          Use DD/MM/YY
        </span>
      ) : null}
    </span>
  );
}

export function DateRangeFilter({
  def,
  state,
}: {
  def: DateRangeFilterDef;
  state: ListStateApi;
}) {
  return (
    <fieldset className="flex items-start gap-1.5">
      <legend className="sr-only">{def.label}</legend>
      <DateBox
        label={`${def.label} from`}
        value={state.state.filters[def.fromKey] ?? ''}
        onChange={(iso) => state.setFilter(def.fromKey, iso)}
      />
      <span className="mt-2.5 text-sm text-[#5B6275] md:mt-1.5" aria-hidden>
        –
      </span>
      <DateBox
        label={`${def.label} to`}
        value={state.state.filters[def.toKey] ?? ''}
        onChange={(iso) => state.setFilter(def.toKey, iso)}
      />
    </fieldset>
  );
}

/** Readable chips for every active filter, each removable. */
function activeFilterChips(
  filters: FilterDef[],
  values: Record<string, string>,
): Array<{ key: string; label: string; keys: string[] }> {
  const chips: Array<{ key: string; label: string; keys: string[] }> = [];
  for (const def of filters) {
    if (def.kind === 'select') {
      const value = values[def.key];
      if (!value) continue;
      const option = def.options.find((item) => item.value === value);
      chips.push({
        key: def.key,
        label: `${def.label}: ${option?.label ?? value}`,
        keys: [def.key],
      });
    } else {
      const from = values[def.fromKey];
      const to = values[def.toKey];
      if (!from && !to) continue;
      chips.push({
        key: def.fromKey,
        label: `${def.label}: ${from ? formatDate(from) : '…'} – ${to ? formatDate(to) : '…'}`,
        keys: [def.fromKey, def.toKey],
      });
    }
  }
  return chips;
}

export function ActiveFilters({
  filters,
  state,
}: {
  filters: FilterDef[];
  state: ListStateApi;
}) {
  const chips = activeFilterChips(filters, state.state.filters);
  if (!chips.length && !state.state.search) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Active filters"
    >
      {state.state.search ? (
        <FilterChip
          label={`Search: ${state.state.search}`}
          onRemove={() => state.setSearch('')}
        />
      ) : null}
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          onRemove={() =>
            state.setFilters(
              Object.fromEntries(chip.keys.map((key) => [key, ''])),
            )
          }
        />
      ))}
      <button
        type="button"
        onClick={() => {
          state.setFilters(
            Object.fromEntries(
              Object.keys(state.state.filters).map((key) => [key, '']),
            ),
          );
          state.setSearch('');
        }}
        className="h-8 rounded px-1.5 text-[13px] font-semibold text-[#3B4A8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
      >
        Clear all
      </button>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[#E6ECFA] pr-1 pl-3 text-[13px] font-medium text-[#2A3D80]">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
}

function FilterControls({
  filters,
  state,
  stacked = false,
}: {
  filters: FilterDef[];
  state: ListStateApi;
  stacked?: boolean;
}) {
  return (
    <>
      {filters.map((def) =>
        def.kind === 'select' ? (
          <label key={def.key} className={cn(stacked && 'block space-y-1.5')}>
            {stacked ? (
              <span className="text-[13px] font-medium text-[#1B1F2E]">
                {def.label}
              </span>
            ) : null}
            <SelectFilter
              label={def.label}
              allLabel={def.allLabel}
              options={def.options}
              value={state.state.filters[def.key] ?? ''}
              onChange={(value) => state.setFilter(def.key, value)}
              className={stacked ? 'w-full' : undefined}
            />
          </label>
        ) : (
          <div key={def.fromKey} className={cn(stacked && 'space-y-1.5')}>
            {stacked ? (
              <span className="text-[13px] font-medium text-[#1B1F2E]">
                {def.label}
              </span>
            ) : null}
            <DateRangeFilter def={def} state={state} />
          </div>
        ),
      )}
    </>
  );
}

/** Tablet / desktop toolbar inside the table card. */
export function ListToolbar<T>({
  state,
  searchPlaceholder,
  typeChips,
  typeLabel,
  filters,
  columns,
  hidden,
  onToggleColumn,
  onRefresh,
  refreshing,
  density,
  onDensityChange,
}: {
  state: ListStateApi;
  searchPlaceholder: string;
  typeChips?: Chip[];
  typeLabel: string;
  filters: FilterDef[];
  columns: ListColumn<T>[];
  hidden: Set<string>;
  onToggleColumn: (key: string, visible: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  density: 'comfortable' | 'compact';
  onDensityChange: (density: 'comfortable' | 'compact') => void;
}) {
  return (
    <div className="space-y-2 border-b border-[#EEF0F4] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={state.state.search}
          onChange={state.setSearch}
          placeholder={searchPlaceholder}
          className="w-full lg:w-72"
        />
        {typeChips?.length ? (
          <TypeChips
            chips={typeChips}
            value={state.state.type}
            onChange={state.setType}
            label={typeLabel}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <FilterControls filters={filters} state={state} />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label="Columns and density"
                title="Columns"
              >
                <Columns3 className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={!hidden.has(column.key)}
                  disabled={column.mandatory}
                  onCheckedChange={(checked) =>
                    onToggleColumn(column.key, Boolean(checked))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.header}
                  {column.mandatory ? (
                    <span className="ml-auto text-xs text-[#5B6275]">
                      Always
                    </span>
                  ) : null}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Row density</DropdownMenuLabel>
              {(['comfortable', 'compact'] as const).map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={density === value}
                  onCheckedChange={() => onDensityChange(value)}
                >
                  {value === 'comfortable' ? 'Comfortable' : 'Compact'}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ActiveFilters filters={filters} state={state} />
    </div>
  );
}

/** Phone toolbar: search, Filter button (opens the sheet) and type chips. */
export function MobileToolbar({
  state,
  searchPlaceholder,
  typeChips,
  typeLabel,
  filters,
  sheetExtras,
  resultLabel,
}: {
  state: ListStateApi;
  searchPlaceholder: string;
  typeChips?: Chip[];
  typeLabel: string;
  filters: FilterDef[];
  sheetExtras?: ReactNode;
  resultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterChips(filters, state.state.filters).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SearchField
          value={state.state.search}
          onChange={state.setSearch}
          placeholder={searchPlaceholder}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={count ? `Filter (${count} active)` : 'Filter'}
          className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E6E8EF] bg-white px-3 text-sm font-semibold text-[#1B1F2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filter
          {count ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3B4A8C] px-1 text-[11px] text-white">
              {count}
            </span>
          ) : null}
        </button>
      </div>
      {typeChips?.length ? (
        <TypeChips
          chips={typeChips}
          value={state.state.type}
          onChange={state.setType}
          label={typeLabel}
        />
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto rounded-t-2xl rounded-b-none p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-xl data-[state=open]:slide-in-from-bottom">
          <div
            className="mx-auto h-1 w-10 rounded-full bg-[#E6E8EF]"
            aria-hidden
          />
          <DialogTitle className="text-base">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Narrow the list
          </DialogDescription>
          <div className="space-y-4">
            {sheetExtras}
            <FilterControls filters={filters} state={state} stacked />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!count}
              className={cn(SECONDARY_BUTTON, 'flex-1 disabled:opacity-50')}
              onClick={() =>
                state.setFilters(
                  Object.fromEntries(
                    Object.keys(state.state.filters).map((key) => [key, '']),
                  ),
                )
              }
            >
              Clear all
            </button>
            <button
              type="button"
              className={cn(PRIMARY_BUTTON, 'flex-1')}
              onClick={() => setOpen(false)}
            >
              {resultLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
