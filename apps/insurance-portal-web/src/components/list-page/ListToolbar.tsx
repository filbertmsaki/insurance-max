import { useEffect, useState, type ReactNode } from 'react';
import { Columns3, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { DatePicker } from '@/components/ui/date-picker';
import { SegmentedControl } from '@/components/ui/radio';
import { Button } from '@/components/ui/button';
import { useId } from 'react';
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
import { formatDate } from './format';
import type { Chip, DateRangeFilterDef, FilterDef, ListColumn } from './types';
import type { ListStateApi } from './useListState';

const ALL = '__all__';
const SEARCH_DEBOUNCE_MS = 300;


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
    <div className={cn('min-w-0', className)}>
      <SearchInput
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        onClear={() => {
          setText('');
          onChange('');
        }}
      />
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
  const name = useId();
  return (
    <SegmentedControl
      name={name}
      aria-label={label}
      value={value}
      onChange={onChange}
      options={chips.map((chip) => ({ value: chip.id === 'all' ? '' : chip.id, label: chip.label }))}
    />
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
          'md:w-auto md:min-w-36',
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
  return (
    <DatePicker
      aria-label={`${label} (DD/MM/YY)`}
      value={value}
      onChange={onChange}
    />
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
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => {
          state.setFilters(
            Object.fromEntries(
              Object.keys(state.state.filters).map((key) => [key, '']),
            ),
          );
          state.setSearch('');
        }}
      >
        Clear all
      </Button>
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
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-badge)] bg-[var(--color-primary-50)] pr-1 pl-3 text-[13px] font-medium text-[var(--color-primary-800)]">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
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
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Columns and density"
                title="Columns"
              >
                <Columns3 className="h-4 w-4" aria-hidden />
              </Button>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label={count ? `Filter (${count} active)` : 'Filter'}
          className="relative shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filter
          {count ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-badge)] bg-[var(--color-primary-600)] px-1 text-[11px] text-white">
              {count}
            </span>
          ) : null}
        </Button>
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
            <Button
              type="button"
              variant="outline"
              disabled={!count}
              className="flex-1"
              onClick={() =>
                state.setFilters(
                  Object.fromEntries(
                    Object.keys(state.state.filters).map((key) => [key, '']),
                  ),
                )
              }
            >
              Clear all
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {resultLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
