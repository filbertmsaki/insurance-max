import { useEffect, useId, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ColumnVisibilityMenu } from '@/components/shared/ColumnVisibilityMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DataTableExport } from './DataTableExport';
import {
  DataTableActiveFilterChips,
  DataTableFilterPanel,
  DataTableFilters,
  INLINE_FILTER_LIMIT,
} from './DataTableFilters';
import { DataTableRefresh } from './DataTableRefresh';
import { DataTableSearch } from './DataTableSearch';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import type { Column, DataTableExport as ExportOptions, DataTableFilter } from './types';

export function DataTableToolbar<T>({
  columns,
  visible,
  onVisibilityChange,
  showColumnVisibility,
  search,
  onSearchChange,
  searchPlaceholder,
  searchDebounceMs = 400,
  filters,
  onFilterChange,
  onClearFilters,
  toolbarActions,
  onRefresh,
  isRefreshing,
  exportOptions,
}: {
  columns: Column<T>[];
  visible: Record<string, boolean>;
  onVisibilityChange: (key: string, value: boolean) => void;
  showColumnVisibility: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  filters?: DataTableFilter[];
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
  toolbarActions?: ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  exportOptions?: ExportOptions;
}) {
  const [draftSearch, setDraftSearch] = useState(search ?? '');
  const debouncedSearch = useDebouncedValue(draftSearch, searchDebounceMs);
  const [syncedSearch, setSyncedSearch] = useState(search ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();

  // Adopt external changes (clear filters, back navigation) into the input.
  if ((search ?? '') !== syncedSearch) {
    setSyncedSearch(search ?? '');
    if (debouncedSearch === syncedSearch) setDraftSearch(search ?? '');
  }

  useEffect(() => {
    // Only commit once the debounce has settled on the latest draft.
    if (onSearchChange && debouncedSearch === draftSearch && debouncedSearch !== (search ?? '')) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, draftSearch, onSearchChange, search]);

  const hasToolbar =
    Boolean(onSearchChange) ||
    Boolean(filters?.length) ||
    Boolean(toolbarActions) ||
    Boolean(onRefresh) ||
    Boolean(exportOptions) ||
    showColumnVisibility;

  if (!hasToolbar) return null;

  const filterList = filters ?? [];
  // A couple of filters fit inline; more collapse behind a Filters toggle so
  // the toolbar stays one row on small screens.
  const collapsibleFilters = filterList.length > INLINE_FILTER_LIMIT;
  const activeFilterCount = filterList.filter((filter) => filter.value).length;

  return (
    <div className="space-y-3">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {(onSearchChange || collapsibleFilters) && (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
            {onSearchChange && (
              <div className="min-w-0 flex-1">
                <DataTableSearch
                  value={draftSearch}
                  onChange={setDraftSearch}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            {collapsibleFilters && (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-10 shrink-0 gap-2 px-3',
                  (filtersOpen || activeFilterCount > 0) &&
                    'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100',
                )}
                aria-expanded={filtersOpen}
                aria-controls={filterPanelId}
                aria-label="Toggle filters"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="hidden min-[400px]:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        )}
        {!collapsibleFilters && (
          <DataTableFilters
            filters={filters}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
          />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {toolbarActions}
        <DataTableExport options={exportOptions} />
        <DataTableRefresh onRefresh={onRefresh} isRefreshing={isRefreshing} />
        {showColumnVisibility && (
          <ColumnVisibilityMenu
            columns={columns}
            visible={visible}
            onChange={onVisibilityChange}
          />
        )}
      </div>
    </div>
      {collapsibleFilters && filtersOpen && (
        <DataTableFilterPanel
          id={filterPanelId}
          filters={filterList}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
        />
      )}
      {collapsibleFilters && !filtersOpen && (
        <DataTableActiveFilterChips
          filters={filterList}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
        />
      )}
    </div>
  );
}
