import type { ComponentType, ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import type { SortOrder } from '@/types';
import type { RecordKind, TiraInfo } from './cells';
import type { Tone } from './tones';
import type { DateInput } from './format';

export type ListEntity =
  | 'quotation'
  | 'policy'
  | 'endorsement'
  | 'renewal'
  | 'cancellation'
  | 'tira'
  | 'customer'
  | 'vehicle';

export type Attention = 'danger' | 'warning' | null;

/** What a module's fetcher receives. Dates are ISO (YYYY-MM-DD). */
export interface ListQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  /** Selected summary chip id ('' = All). */
  view?: string;
  /** Selected type chip value ('' = All). */
  type?: string;
  filters: Record<string, string>;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  /** Live count per summary chip id, when the server provides them. */
  summary?: Record<string, number>;
}

export interface ListColumn<T> {
  key: string;
  header: string;
  /** Server sort key; omit for unsortable columns. */
  sortKey?: string;
  cell: (row: T) => ReactNode;
  /** Shown under the cell; for the record column, under (not inside) its link. */
  secondary?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Width hint, e.g. 'min-w-[160px]'. */
  className?: string;
  /** Mandatory columns can't be hidden from the column picker. */
  mandatory?: boolean;
  /** Hidden by default on tablet (768–1023px). */
  hideOnTablet?: boolean;
}

export interface SelectFilterDef {
  kind: 'select';
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** Shown for "no value", e.g. "All statuses". */
  allLabel: string;
}

export interface DateRangeFilterDef {
  kind: 'date-range';
  /** Param names sent to the API (ISO dates). */
  fromKey: string;
  toKey: string;
  label: string;
}

export type FilterDef = SelectFilterDef | DateRangeFilterDef;

export interface RowActionHelpers<T> {
  /** Patches a row in place (e.g. its TIRA badge) without reloading. */
  updateRow: (id: string, patch: Partial<T>) => void;
  refresh: () => void;
}

export interface RowAction<T> {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  hidden?: (row: T) => boolean;
  destructive?: boolean;
  onSelect: (row: T, helpers: RowActionHelpers<T>) => void | Promise<void>;
}

export interface Chip {
  id: string;
  label: string;
}

/** The three-line phone row (see MobileList). */
export interface MobileRowView {
  title: string;
  kind?: RecordKind;
  amount?: string;
  subtitle: string;
  status?: { label: string; tone: Tone };
  coverStart?: DateInput;
  coverEnd?: DateInput;
  issued?: DateInput;
  tira?: TiraInfo;
  ariaLabel: string;
}

export interface ListPageProps<T> {
  entity: ListEntity;
  /** Used in counts and empty states: { one: 'quotation', many: 'quotations' }. */
  noun: { one: string; many: string };
  title: string;
  description?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  primaryAction?: { label: string; onClick: () => void };
  /** Extra header controls (e.g. the owner-company switcher). */
  headerExtras?: ReactNode;
  queryKey: QueryKey;
  fetchRows: (query: ListQuery, signal: AbortSignal) => Promise<ListResult<T>>;
  /** Summary chips above the table; counts come from `ListResult.summary`. */
  summaryChips?: Chip[];
  /** Type chips inside the toolbar (All / Single / Fleet / Non-motor). */
  typeChips?: Chip[];
  filters?: FilterDef[];
  columns: ListColumn<T>[];
  rowActions?: RowAction<T>[];
  rowId: (row: T) => string;
  getRowHref: (row: T) => string;
  getAttention?: (row: T) => Attention;
  mobileRow: (row: T) => MobileRowView;
  searchPlaceholder: string;
  defaultSort: { key: string; order: SortOrder };
  /** Name under which list state is kept in browser history. */
  stateKey: string;
}
