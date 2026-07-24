import { type ReactNode, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { SortOrder } from '@/types'
import { cn } from '@/lib/utils'
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'
import { EmptyState, ErrorState, TableSkeleton } from './ContentStates'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  cell: (row: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
  defaultVisible?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  sortBy?: string
  sortOrder?: SortOrder
  onSortChange?: (key: string, order: SortOrder) => void
  rowKey?: (row: T, index: number) => string | number
  emptyMessage?: string
  caption?: string
  error?: ReactNode
  onRetry?: () => void
  showColumnVisibility?: boolean
}

function SortIcon({ column, sortBy, sortOrder }: { column: string; sortBy?: string; sortOrder?: SortOrder }) {
  if (sortBy !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
  return sortOrder === 'ASC' ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600" /> : <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />
}

export function DataTable<T>({ columns, data, loading, page, limit, total, totalPages, onPageChange, onLimitChange, sortBy, sortOrder, onSortChange, rowKey, emptyMessage = 'No records found', caption, error, onRetry, showColumnVisibility = true }: DataTableProps<T>) {
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>({})
  const visibleColumns = useMemo(() => columns.filter((column) => column.key === 'actions' || column.defaultVisible !== false && hiddenColumns[column.key] !== false), [columns, hiddenColumns])
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const handleSort = (key: string) => {
    if (!onSortChange) return
    onSortChange(key, sortBy === key && sortOrder === 'ASC' ? 'DESC' : 'ASC')
  }

  if (loading) return <TableSkeleton columns={Math.min(columns.length, 5)} />

  return (
    <div className="space-y-4">
      {showColumnVisibility && <div className="flex justify-end"><ColumnVisibilityMenu columns={columns} visible={Object.fromEntries(columns.map((column) => [column.key, visibleColumns.some((item) => item.key === column.key)]))} onChange={(key, value) => setHiddenColumns((current) => ({ ...current, [key]: value }))} /></div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader><TableRow className="bg-slate-50 hover:bg-slate-50">{visibleColumns.map((col) => <TableHead key={col.key} className={cn(col.className, col.hideOnMobile && 'hidden md:table-cell')}>{col.sortable && onSortChange ? <button type="button" aria-label={'Sort by ' + col.header} onClick={() => handleSort(col.key)} className={cn('flex items-center text-left font-medium hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', sortBy === col.key ? 'text-slate-900' : 'text-slate-500')}>{col.header}<SortIcon column={col.key} sortBy={sortBy} sortOrder={sortOrder} /></button> : col.header}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {error ? <TableRow><TableCell colSpan={visibleColumns.length} className="p-0"><ErrorState description={typeof error === 'string' ? error : undefined} onRetry={onRetry} /></TableCell></TableRow> : data.length === 0 ? <TableRow><TableCell colSpan={visibleColumns.length} className="p-0"><EmptyState title={emptyMessage} /></TableCell></TableRow> : data.map((row, i) => <TableRow key={rowKey?.(row, i) ?? i}>{visibleColumns.map((col) => <TableCell key={col.key} className={cn(col.className, col.hideOnMobile && 'hidden md:table-cell')}>{col.cell(row)}</TableCell>)}</TableRow>)}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-2"><span className="hidden sm:inline">Rows per page:</span><Select value={String(limit)} onValueChange={(v) => { onLimitChange(Number(v)); onPageChange(1) }}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
        <span className="text-xs">{from}–{to} of {total}</span>
        <div className="flex items-center gap-1"><Button aria-label="First page" variant="ghost" size="icon" onClick={() => onPageChange(1)} disabled={page === 1} className="h-8 w-8"><ChevronsLeft className="h-4 w-4" /></Button><Button aria-label="Previous page" variant="ghost" size="icon" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button><span className="px-2 text-xs tabular-nums">{page} / {totalPages || 1}</span><Button aria-label="Next page" variant="ghost" size="icon" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button><Button aria-label="Last page" variant="ghost" size="icon" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="h-8 w-8"><ChevronsRight className="h-4 w-4" /></Button></div>
      </div>
    </div>
  )
}