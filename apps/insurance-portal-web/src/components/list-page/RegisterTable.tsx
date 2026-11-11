import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOrder } from '@/types';
import type {
  Attention,
  ListColumn,
  RowAction,
  RowActionHelpers,
} from './types';
import { LIST_PAGE_SIZES } from './useListState';

export type Density = 'comfortable' | 'compact';

const ATTENTION_BAR: Record<Exclude<Attention, null>, string> = {
  danger: 'shadow-[inset_3px_0_0_#B42318]',
  warning: 'shadow-[inset_3px_0_0_#8A4B08]',
};

/** Row height: comfortable ≈ 60px, compact ≈ 48px. */
const CELL_PADDING: Record<Density, string> = {
  comfortable: 'py-2.5',
  compact: 'py-1',
};

function SortHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  column: ListColumn<unknown>;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string, order: SortOrder) => void;
}) {
  if (!column.sortKey) return <>{column.header}</>;
  const active = sortBy === column.sortKey;
  const Icon = !active
    ? ArrowUpDown
    : sortOrder === 'ASC'
      ? ArrowUp
      : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() =>
        onSort(column.sortKey!, active && sortOrder === 'DESC' ? 'ASC' : 'DESC')
      }
      className={cn(
        '-mx-1 gap-1 uppercase',
        column.align === 'right' && 'flex-row-reverse',
        active && 'text-[var(--color-text)]',
      )}
    >
      {column.header}
      <Icon
        className={cn('h-3.5 w-3.5', !active && 'opacity-60')}
        aria-hidden
      />
    </Button>
  );
}

function RowMenu<T>({
  row,
  label,
  href,
  actions,
  helpers,
  onOpen,
}: {
  row: T;
  label: string;
  href: string;
  actions: RowAction<T>[];
  helpers: RowActionHelpers<T>;
  onOpen: () => void;
}) {
  const visible = actions.filter((action) => !action.hidden?.(row));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`More actions for ${label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        {/* "View" lives in the menu on tablets, where the button is hidden. */}
        <DropdownMenuItem asChild className="lg:hidden">
          <Link to={href} onClick={onOpen}>
            <Eye className="mr-2 h-4 w-4" aria-hidden />
            View
          </Link>
        </DropdownMenuItem>
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              onSelect={() => void action.onSelect(row, helpers)}
              className={cn(
                action.destructive && 'text-[#B42318] focus:text-[#B42318]',
              )}
            >
              {Icon ? <Icon className="mr-2 h-4 w-4" aria-hidden /> : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Tablet / desktop table. The header row stays fixed while the table
 * scrolls inside its card; the page itself never scrolls sideways.
 */
export function RegisterTable<T>({
  columns,
  rows,
  rowId,
  rowLabel,
  getRowHref,
  getAttention,
  rowActions = [],
  helpers,
  sortBy,
  sortOrder,
  onSort,
  loading,
  skeletonRows,
  density,
  selectedId,
  onOpen,
  onNavigate,
  caption,
  emptyContent,
}: {
  columns: ListColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  rowLabel: (row: T) => string;
  getRowHref: (row: T) => string;
  getAttention?: (row: T) => Attention;
  rowActions?: RowAction<T>[];
  helpers: RowActionHelpers<T>;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string, order: SortOrder) => void;
  loading: boolean;
  skeletonRows: number;
  density: Density;
  selectedId: string;
  onOpen: (row: T) => void;
  onNavigate: (href: string) => void;
  caption: string;
  emptyContent?: React.ReactNode;
}) {
  const padding = CELL_PADDING[density];
  const rowHeight = density === 'compact' ? 'h-12' : 'h-[60px]';
  const colCount = columns.length + 1;

  return (
    <div className="max-h-[calc(100dvh-220px)] min-h-[200px] overflow-auto overscroll-x-contain">
      <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm text-[#1B1F2E]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={
                  column.sortKey && sortBy === column.sortKey
                    ? sortOrder === 'ASC'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                className={cn(
                  'sticky top-0 z-10 border-b border-[#E6E8EF] bg-[#F8F9FC] px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-[#4A5165] uppercase',
                  column.align === 'right' ? 'text-right' : 'text-left',

                  column.hideOnTablet && 'max-lg:hidden',
                  column.className,
                )}
              >
                <SortHeader
                  column={column as ListColumn<unknown>}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>
            ))}
            <th
              scope="col"
              className="sticky top-0 z-10 w-28 border-b border-[#E6E8EF] bg-[#F8F9FC] px-3 py-2.5 text-right max-lg:w-14"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={index} aria-hidden className={rowHeight}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'border-b border-[#EEF0F4] px-3',
                      padding,

                      column.hideOnTablet && 'max-lg:hidden',
                    )}
                  >
                    <div className="h-3.5 w-24 animate-pulse rounded bg-[#EEF0F4]" />
                    <div className="mt-2 h-3 w-14 animate-pulse rounded bg-[#EEF0F4]" />
                  </td>
                ))}
                <td className={cn('border-b border-[#EEF0F4] px-3', padding)} />
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>{emptyContent}</td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowId(row);
              const href = getRowHref(row);
              const attention = getAttention?.(row) ?? null;
              const selected = selectedId === id;
              const label = rowLabel(row);
              return (
                <tr
                  key={id}
                  aria-selected={selected || undefined}
                  onClick={() => {
                    onOpen(row);
                    onNavigate(href);
                  }}
                  className={cn(
                    'group cursor-pointer',
                    rowHeight,
                    selected ? 'bg-[#F7F8FC]' : 'bg-white hover:bg-[#F7F8FC]',
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        'border-b border-[#EEF0F4] px-3 align-middle',
                        padding,
                        column.align === 'right' && 'text-right',
                        index === 0 &&
                          cn(
                            'border-r border-r-[#EEF0F4]',
                            selected
                              ? 'bg-[#F7F8FC]'
                              : 'bg-white group-hover:bg-[#F7F8FC]',
                            attention && ATTENTION_BAR[attention],
                          ),
                        column.hideOnTablet && 'max-lg:hidden',
                        column.className,
                      )}
                    >
                      {index === 0 ? (
                        <span className="flex flex-col items-start gap-1 leading-5">
                          <Link
                            to={href}
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpen(row);
                            }}
                            className="rounded font-bold text-[#3B4A8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
                          >
                            {column.cell(row)}
                          </Link>
                          {column.secondary?.(row)}
                        </span>
                      ) : (
                        <>
                          {column.cell(row)}
                          {column.secondary?.(row)}
                        </>
                      )}
                    </td>
                  ))}
                  <td
                    className={cn(
                      'border-b border-[#EEF0F4] px-3 text-right whitespace-nowrap',
                      padding,
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={href}
                        onClick={() => onOpen(row)}
                        aria-label={`View ${label}`}
                        className="inline-flex h-8 items-center rounded-lg border border-[#E6E8EF] bg-white px-3 text-[13px] font-semibold text-[#1B1F2E] hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] max-lg:hidden"
                      >
                        View
                      </Link>
                      <RowMenu
                        row={row}
                        label={label}
                        href={href}
                        actions={rowActions}
                        helpers={helpers}
                        onOpen={() => onOpen(row)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

/** "Showing 1–10 of 248", rows per page, Previous / page numbers / Next. */
export function ListPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0F4] px-3 py-2.5 text-[13px] text-[#5B6275]">
      <div className="flex items-center gap-4">
        <p aria-live="polite" className="tabular-nums">
          Showing {from}–{to} of {total}
        </p>
        <label className="flex items-center gap-2">
          Rows per page
          <Select
            value={String(limit)}
            onValueChange={(value) => onLimitChange(Number(value))}
          >
            <SelectTrigger
              aria-label="Rows per page"
              controlSize="sm"
              className="w-[72px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        {pageWindow(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? 'primary' : 'outline'}
              size="sm"
              aria-label={`Page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
              className="max-lg:hidden"
            >
              {item}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
