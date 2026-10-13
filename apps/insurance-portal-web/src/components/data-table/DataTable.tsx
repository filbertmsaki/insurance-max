/* eslint-disable react-hooks/incompatible-library -- TanStack Table v8 exposes stable table helpers through useReactTable; this component is the intended boundary for that library. */
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';

import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/ContentStates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DataTableColumnHeader } from './DataTableColumnHeader';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import type { Column, DataTableProps, DataTableRowAction } from './types';

const SELECT_ID = '__select__';
const ACTIONS_ID = '__actions__';

type CellMeta = { className?: string; hideOnMobile?: boolean };

function buildInitialVisibility<T>(columns: Column<T>[]): VisibilityState {
  return Object.fromEntries(
    columns.map((column) => [column.key, column.defaultVisible !== false]),
  );
}

function resolve<T>(value: boolean | ((row: T) => boolean) | undefined, row: T) {
  return typeof value === 'function' ? value(row) : Boolean(value);
}

function RowActionsMenu<T>({ row, actions }: { row: T; actions: DataTableRowAction<T>[] }) {
  const visible = actions.filter((action) => !resolve(action.hidden, row));
  if (!visible.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Row actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {visible.map((action, index) => {
          const Icon = action.icon;
          return (
            <div key={action.label}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={resolve(action.disabled, row)}
                onClick={() => action.onClick(row)}
                className={cn(action.destructive && 'text-red-600 focus:text-red-600')}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading,
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  sortBy,
  sortOrder,
  onSortChange,
  rowKey,
  emptyMessage = 'No records found',
  noResultsMessage,
  caption,
  error,
  onRetry,
  showColumnVisibility = true,
  tableClassName,
  search,
  onSearchChange,
  searchPlaceholder,
  searchDebounceMs,
  filters,
  onFilterChange,
  onClearFilters,
  toolbarActions,
  onRefresh,
  isFetching,
  isRefreshing,
  rowActions,
  enableRowSelection,
  selectedRowKeys,
  onSelectionChange,
  bulkActions,
  exportOptions,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    buildInitialVisibility(columns),
  );
  const [internalSelection, setInternalSelection] = useState<Array<string | number>>([]);
  const selection = selectedRowKeys ?? internalSelection;
  const setSelection = (keys: Array<string | number>) => {
    if (!selectedRowKeys) setInternalSelection(keys);
    onSelectionChange?.(keys);
  };
  const selectedSet = new Set(selection);

  const keyOf = (row: T, index: number) =>
    rowKey?.(row, index) ?? (row as { id?: string | number }).id ?? index;
  const canSelect = (row: T) =>
    typeof enableRowSelection === 'function' ? enableRowSelection(row) : Boolean(enableRowSelection);

  const pageKeys = data
    .map((row, index) => (canSelect(row) ? keyOf(row, index) : null))
    .filter((key): key is string | number => key !== null);
  const pageSelectedCount = pageKeys.filter((key) => selectedSet.has(key)).length;
  const allPageSelected = pageKeys.length > 0 && pageSelectedCount === pageKeys.length;

  const tableColumns: ColumnDef<T>[] = [
    ...(enableRowSelection
      ? [
          {
            id: SELECT_ID,
            header: () => (
              <Checkbox
                aria-label="Select all rows on this page"
                checked={allPageSelected ? true : pageSelectedCount > 0 ? 'indeterminate' : false}
                disabled={!pageKeys.length}
                onCheckedChange={(checked) => {
                  const next = new Set(selection);
                  pageKeys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
                  setSelection([...next]);
                }}
              />
            ),
            cell: ({ row }) => {
              const key = keyOf(row.original, row.index);
              return (
                <Checkbox
                  aria-label="Select row"
                  checked={selectedSet.has(key)}
                  disabled={!canSelect(row.original)}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => {
                    const next = new Set(selection);
                    if (checked) next.add(key);
                    else next.delete(key);
                    setSelection([...next]);
                  }}
                />
              );
            },
            meta: { className: 'w-10' },
          } satisfies ColumnDef<T>,
        ]
      : []),
    ...columns.map(
      (column): ColumnDef<T> => ({
        id: column.key,
        accessorFn: (row) => row,
        enableSorting: Boolean(column.sortable),
        header: () => (
          <DataTableColumnHeader
            label={column.header}
            columnKey={column.key}
            sortable={column.sortable}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => column.cell(row.original),
        meta: { className: column.className, hideOnMobile: column.hideOnMobile },
      }),
    ),
    ...(rowActions?.length
      ? [
          {
            id: ACTIONS_ID,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => <RowActionsMenu row={row.original} actions={rowActions} />,
            meta: { className: 'w-12 text-right' },
          } satisfies ColumnDef<T>,
        ]
      : []),
  ];

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: total,
    pageCount: totalPages,
    state: {
      columnVisibility,
      pagination: { pageIndex: Math.max(page - 1, 0), pageSize: limit },
      sorting: sortBy ? [{ id: sortBy, desc: sortOrder === 'DESC' }] : [],
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const visibleMap = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.key, columnVisibility[column.key] !== false])),
    [columnVisibility, columns],
  );

  const emptyTitle =
    search || filters?.some((filter) => filter.value)
      ? (noResultsMessage ?? 'No matching records found')
      : emptyMessage;

  const toolbar = (
    <DataTableToolbar
      columns={columns}
      visible={visibleMap}
      onVisibilityChange={(key, value) => table.getColumn(key)?.toggleVisibility(value)}
      showColumnVisibility={showColumnVisibility}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchDebounceMs={searchDebounceMs}
      filters={filters}
      onFilterChange={onFilterChange}
      onClearFilters={onClearFilters}
      toolbarActions={toolbarActions}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing || isFetching}
      exportOptions={exportOptions}
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {toolbar}
        <TableSkeleton columns={Math.min(columns.length, 5)} />
      </div>
    );
  }

  const colSpan = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-4">
      {toolbar}
      {selection.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
        >
          <span>
            <span className="font-semibold">{selection.length}</span> selected
            {selection.length > pageSelectedCount && ' (including other pages)'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(selection, () => setSelection([]))}
            <Button variant="ghost" size="sm" onClick={() => setSelection([])}>
              Clear selection
            </Button>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden rounded-md border border-slate-200/70 bg-white shadow-sm">
        {isFetching && !isRefreshing && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-blue-100">
            <div className="h-full w-1/3 animate-pulse bg-blue-500" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className={tableClassName} aria-busy={isFetching || undefined}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-slate-50 hover:bg-slate-50">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as CellMeta | undefined;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(meta?.className, meta?.hideOnMobile && 'hidden md:table-cell')}
                        aria-sort={
                          header.column.id === sortBy
                            ? sortOrder === 'DESC'
                              ? 'descending'
                              : 'ascending'
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="p-0">
                    <ErrorState
                      description={typeof error === 'string' ? error : undefined}
                      onRetry={onRetry}
                    />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="p-0">
                    <EmptyState title={emptyTitle} />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, index) => {
                  const key = keyOf(row.original, index);
                  return (
                    <TableRow
                      key={key}
                      data-state={selectedSet.has(key) ? 'selected' : undefined}
                      className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as CellMeta | undefined;
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(meta?.className, meta?.hideOnMobile && 'hidden md:table-cell')}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <DataTablePagination
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
