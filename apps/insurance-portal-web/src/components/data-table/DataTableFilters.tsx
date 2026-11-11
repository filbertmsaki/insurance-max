import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DataTableFilter } from './types';

const ALL_VALUE = '__all__';

/** Filters this many or fewer render inline; more collapse into a panel. */
export const INLINE_FILTER_LIMIT = 2;

function FilterSelect({
  filter,
  onFilterChange,
  className,
}: {
  filter: DataTableFilter;
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
}) {
  return (
    <Select
      value={filter.value || ALL_VALUE}
      onValueChange={(value) =>
        onFilterChange?.(filter.key, value === ALL_VALUE ? '' : value)
      }
    >
      <SelectTrigger
        className={className}
        aria-label={`Filter by ${filter.label}`}
      >
        <SelectValue placeholder={filter.placeholder ?? filter.label} />
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
  );
}

/** Compact inline filters, used when a table only has a couple of them. */
export function DataTableFilters({
  filters = [],
  onFilterChange,
  onClearFilters,
}: {
  filters?: DataTableFilter[];
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
}) {
  if (!filters.length) return null;

  const hasActiveFilters = filters.some((filter) => filter.value);

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {filters.map((filter) => (
        <FilterSelect
          key={filter.key}
          filter={filter}
          onFilterChange={onFilterChange}
          className="w-full sm:w-44"
        />
      ))}
      {hasActiveFilters && onClearFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="col-span-2 justify-self-start sm:col-span-1"
          onClick={onClearFilters}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** Labelled filter grid shown when the toolbar's Filters toggle is open. */
export function DataTableFilterPanel({
  id,
  filters,
  onFilterChange,
  onClearFilters,
}: {
  id: string;
  filters: DataTableFilter[];
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
}) {
  const activeCount = filters.filter((filter) => filter.value).length;

  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {filters.map((filter) => (
          <div key={filter.key} className="min-w-0 space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">
              {filter.label}
            </span>
            <FilterSelect
              filter={filter}
              onFilterChange={onFilterChange}
              className={cn(
                'w-full',
                filter.value && 'border-blue-300 bg-blue-50/50',
              )}
            />
          </div>
        ))}
      </div>
      {activeCount > 0 && onClearFilters && (
        <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}

/** Removable chips summarising the active filters while the panel is closed. */
export function DataTableActiveFilterChips({
  filters,
  onFilterChange,
  onClearFilters,
}: {
  filters: DataTableFilter[];
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
}) {
  const active = filters.filter((filter) => filter.value);
  if (!active.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((filter) => {
        const label =
          filter.options.find((option) => option.value === filter.value)
            ?.label ?? filter.value;
        return (
          <span
            key={filter.key}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1 text-xs text-blue-900"
          >
            <span className="truncate">
              <span className="text-blue-600">{filter.label}:</span> {label}
            </span>
            <Button
              type="button"
              aria-label={`Remove ${filter.label} filter`}
              variant="ghost"
              size="icon-sm"
              onClick={() => onFilterChange?.(filter.key, '')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </span>
        );
      })}
      {active.length > 1 && onClearFilters && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onClearFilters}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
