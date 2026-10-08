/* eslint-disable react-hooks/incompatible-library -- TanStack Table v8 exposes stable table helpers through useReactTable; this component is the intended boundary for that library. */
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';

import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/ContentStates';
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
import type { Column, DataTableProps } from './types';

function buildInitialVisibility<T>(columns: Column<T>[]): VisibilityState {
  return Object.fromEntries(
    columns.map((column) => [column.key, column.defaultVisible !== false]),
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
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    buildInitialVisibility(columns),
  );

  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
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
        meta: {
          className: column.className,
          hideOnMobile: column.hideOnMobile,
        },
      })),
    [columns, onSortChange, sortBy, sortOrder],
  );

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
      pagination: {
        pageIndex: Math.max(page - 1, 0),
        pageSize: limit,
      },
      sorting: sortBy
        ? [{ id: sortBy, desc: sortOrder === 'DESC' }]
        : [],
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const visibleMap = Object.fromEntries(
    columns.map((column) => [
      column.key,
      table.getColumn(column.key)?.getIsVisible() ?? true,
    ]),
  );

  const emptyTitle =
    search || filters?.some((filter) => filter.value)
      ? (noResultsMessage ?? 'No matching records found')
      : emptyMessage;

  const toolbar = (
    <DataTableToolbar
      columns={columns}
      visible={visibleMap}
      onVisibilityChange={(key, value) =>
        table.getColumn(key)?.toggleVisibility(value)
      }
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

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="relative overflow-hidden rounded-md border border-slate-200/70 bg-white shadow-sm">
        {isFetching && !isRefreshing && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-blue-100">
            <div className="h-full w-1/3 animate-pulse bg-blue-500" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className={tableClassName}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-slate-50 hover:bg-slate-50"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      | { className?: string; hideOnMobile?: boolean }
                      | undefined;

                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          meta?.className,
                          meta?.hideOnMobile && 'hidden md:table-cell',
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    <ErrorState
                      description={
                        typeof error === 'string' ? error : undefined
                      }
                      onRetry={onRetry}
                    />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    <EmptyState title={emptyTitle} />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow key={rowKey?.(row.original, index) ?? row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | { className?: string; hideOnMobile?: boolean }
                        | undefined;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            meta?.className,
                            meta?.hideOnMobile && 'hidden md:table-cell',
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
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
