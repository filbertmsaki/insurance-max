import { useEffect, useState, type ReactNode } from 'react';
import { ColumnVisibilityMenu } from '@/components/shared/ColumnVisibilityMenu';
import { DataTableExport } from './DataTableExport';
import { DataTableFilters } from './DataTableFilters';
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

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {onSearchChange && (
          <DataTableSearch
            value={draftSearch}
            onChange={setDraftSearch}
            placeholder={searchPlaceholder}
          />
        )}
        <DataTableFilters
          filters={filters}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
        />
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
  );
}
