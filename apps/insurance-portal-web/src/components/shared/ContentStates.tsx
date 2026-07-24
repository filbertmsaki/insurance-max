import type { ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function EmptyState({ title = 'No records found', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center text-slate-400"><Inbox className="h-10 w-10" aria-hidden="true" /><p className="text-sm font-medium text-slate-600">{title}</p>{description && <p className="max-w-sm text-xs leading-5">{description}</p>}{action}</div>
}

export function ErrorState({ title = 'Unable to load data', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center"><AlertCircle className="h-10 w-10 text-red-400" aria-hidden="true" /><p className="text-sm font-medium text-slate-700">{title}</p>{description && <p className="max-w-sm text-xs leading-5 text-slate-500">{description}</p>}{onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry</Button>}</div>
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return <div aria-label="Loading table" className="space-y-3">{Array.from({ length: rows }).map((_, row) => <div key={row} className="grid gap-3 rounded-lg border border-slate-100 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }).map((__, column) => <Skeleton key={column} className="h-4 w-full" />)}</div>)}</div>
}
