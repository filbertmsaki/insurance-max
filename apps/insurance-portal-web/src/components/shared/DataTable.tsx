import { type ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { SortOrder } from '@/types'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  /** Pagination from backend envelope */
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  /** Sorting */
  sortBy?: string
  sortOrder?: SortOrder
  onSortChange?: (key: string, order: SortOrder) => void
}

function SortIcon({ column, sortBy, sortOrder }: { column: string; sortBy?: string; sortOrder?: SortOrder }) {
  if (sortBy !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
  return sortOrder === 'ASC'
    ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600" />
    : <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />
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
}: DataTableProps<T>) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const handleSort = (key: string) => {
    if (!onSortChange) return
    if (sortBy === key) {
      onSortChange(key, sortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      onSortChange(key, 'ASC')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable && onSortChange ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'flex items-center text-left font-medium hover:text-slate-900',
                        sortBy === col.key ? 'text-slate-900' : 'text-slate-500',
                      )}
                    >
                      {col.header}
                      <SortIcon column={col.key} sortBy={sortBy} sortOrder={sortOrder} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Inbox className="h-10 w-10" />
                    <p className="text-sm font-medium">No records found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page:</span>
          <Select value={String(limit)} onValueChange={(v) => { onLimitChange(Number(v)); onPageChange(1) }}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs">
          {from}–{to} of {total}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onPageChange(1)} disabled={page === 1} className="h-8 w-8">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs tabular-nums">
            {page} / {totalPages || 1}
          </span>
          <Button variant="ghost" size="icon" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="h-8 w-8">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
