import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DataTableFilter } from './types';

const ALL_VALUE = '__all__';

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
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filter.value || ALL_VALUE}
          onValueChange={(value) =>
            onFilterChange?.(filter.key, value === ALL_VALUE ? '' : value)
          }
        >
          <SelectTrigger className="h-9 w-[min(14rem,100%)]">
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
      ))}
      {hasActiveFilters && onClearFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
