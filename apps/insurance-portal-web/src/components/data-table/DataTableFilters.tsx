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
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filter.value || ALL_VALUE}
          onValueChange={(value) =>
            onFilterChange?.(filter.key, value === ALL_VALUE ? '' : value)
          }
        >
          <SelectTrigger className="w-full sm:w-44">
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
