import type { ComponentType, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Trend = { value: string; direction?: 'up' | 'down' | 'neutral' }

interface DashboardCardProps {
  title: string
  value?: ReactNode
  icon?: ComponentType<{ className?: string }>
  description?: ReactNode
  trend?: Trend
  status?: ReactNode
  action?: ReactNode
  loading?: boolean
  className?: string
}

export function DashboardCard({ title, value, icon: Icon, description, trend, status, action, loading, className }: DashboardCardProps) {
  return (
    <Card className={cn('flex h-full min-h-36 flex-col rounded-xl border-slate-200 shadow-sm', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon className="h-4 w-4" aria-hidden="true" /></span>}
        {action}
      </CardHeader>
      <CardContent className="mt-auto space-y-2">
        {loading ? <Skeleton className="h-9 w-24" /> : <div className="flex flex-wrap items-baseline gap-2"><p className="text-3xl font-semibold tracking-tight text-slate-950">{value ?? '—'}</p>{status}</div>}
        {!loading && description && <div className="text-xs leading-5 text-slate-500">{description}</div>}
        {!loading && trend && <div className={cn('flex items-center gap-1 text-xs font-medium', trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-red-600' : 'text-slate-500')}>
          {trend.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : trend.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
          {trend.value}
        </div>}
      </CardContent>
    </Card>
  )
}

export const StatisticCard = DashboardCard
export const SummaryCard = DashboardCard
export const FinancialCard = DashboardCard
export const StatusCard = DashboardCard
export const ProgressCard = DashboardCard
