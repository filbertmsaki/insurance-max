import type { ComponentType, ReactNode } from 'react';
import type { SortOrder } from '@/types';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  defaultVisible?: boolean;
}

export interface DataTableFilter {
  key: string;
  label: string;
  value?: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface DataTableRowAction<T> {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  /** Hide the action (e.g. missing permission or invalid state for this row). */
  hidden?: boolean | ((row: T) => boolean);
  disabled?: boolean | ((row: T) => boolean);
  destructive?: boolean;
  /** Render a separator above this action. */
  separator?: boolean;
}

export interface DataTableExport {
  /** Export only the rows currently shown. */
  onExportPage?: () => void;
  /** Export every record matching current search/filters (server-side). */
  onExportAll?: () => void | Promise<void>;
  label?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (key: string, order: SortOrder) => void;
  rowKey?: (row: T, index: number) => string | number;
  emptyMessage?: string;
  noResultsMessage?: string;
  caption?: string;
  error?: ReactNode;
  onRetry?: () => void;
  showColumnVisibility?: boolean;
  tableClassName?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  filters?: DataTableFilter[];
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
  toolbarActions?: ReactNode;
  onRefresh?: () => void;
  isFetching?: boolean;
  isRefreshing?: boolean;
  /** Per-row actions rendered in a trailing menu; filter by permission via `hidden`. */
  rowActions?: DataTableRowAction<T>[];
  /**
   * Row selection. Selection is keyed by `rowKey` and is kept across pages,
   * search and sort changes until cleared, so bulk actions can span pages.
   * The header checkbox selects/deselects the current page only.
   */
  enableRowSelection?: boolean | ((row: T) => boolean);
  selectedRowKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>) => void;
  /** Rendered in a bar above the table while rows are selected. */
  bulkActions?: (keys: Array<string | number>, clear: () => void) => ReactNode;
  exportOptions?: DataTableExport;
  onRowClick?: (row: T) => void;
  /** Extra row classes, e.g. to highlight the selected row in master–detail views. */
  rowClassName?: (row: T) => string | undefined;
}
