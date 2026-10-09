import type { ReactNode } from 'react';
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
}
