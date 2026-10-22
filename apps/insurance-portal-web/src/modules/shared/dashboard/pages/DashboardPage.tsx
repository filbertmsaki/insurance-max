import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Filter,
  Key,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { CHART_COLORS } from '@/components/shared/chart-colors';
import {
  DonutChart,
  TrendBarChart,
  type TrendPoint,
} from '@/components/shared/charts';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  dashboardApi,
  type CommissionsResponse,
  type CountBreakdownItem,
  type DashboardCapabilitiesResponse,
  type DashboardGroupBy,
  type DashboardQueryParams,
  type DashboardSectionId,
  type DashboardSectionResponse,
  type FinanceResponse,
  type MoneyAmount,
  type OverviewResponse,
  type PoliciesResponse,
  type ReinsuranceResponse,
  type SalesResponse,
  type TasksResponse,
  type TaskQueue,
  type TiramisResponse,
} from '@/modules/shared/dashboard/api/dashboard';
import {
  DASHBOARD_DATE_PRESETS,
  formatDateRange,
  formatPeriodCount,
  formatTrendPeriod,
  getDateRangeError,
  groupByForRange,
  resolveDatePreset,
  type DashboardDatePreset,
  type DashboardDateRange,
} from '@/modules/shared/dashboard/utils/dateRange';
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients';
import { devicesApi } from '@/modules/shared/devices/api/devices';
import { sessionsApi } from '@/modules/shared/sessions/api/sessions';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { analyticsApi } from '@/modules/tenant/analytics/api';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { isStandardCompanyUser } from '@/lib/auth/permissions';
import {
  formatMoney,
  formatNumber,
  formatPercentage,
  type NumberFormatSettings,
} from '@/modules/shared/formatting/number-format';
import { useActiveNumberFormatSettings } from '@/modules/shared/formatting/number-format-context';

function formatMetricValue(
  value: string | number | null | undefined,
  suffix?: string,
  settings?: NumberFormatSettings,
) {
  if (value === null || value === undefined || value === '') {
    return 'Unavailable';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (suffix === '%') {
    return formatPercentage(numeric, settings);
  }

  return formatNumber(numeric, 2, settings);
}

function formatWidgetValue(
  value: string | null | undefined,
  unit: string | undefined,
  settings?: NumberFormatSettings,
) {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  if (unit === 'MONEY') {
    return formatMoney(numeric, undefined, settings);
  }

  if (unit === 'PERCENTAGE') {
    return formatPercentage(numeric, settings);
  }

  return formatNumber(numeric, 2, settings);
}

function formatMoneyRows(
  rows: MoneyAmount[] | null | undefined,
  settings?: NumberFormatSettings,
) {
  if (!rows?.length) return 'No amounts';
  return rows
    .map((row) => formatMoney(row.amount, row.currency, settings))
    .join(' | ');
}

function formatPrimaryMoney(
  rows: MoneyAmount[] | null | undefined,
  settings?: NumberFormatSettings,
) {
  if (!rows?.length) return '0';
  const [first, ...rest] = rows;
  const formatted = formatMoney(first.amount, first.currency, settings);
  return rest.length ? `${formatted}+` : formatted;
}

function formatCount(
  value: string | number | null | undefined,
  settings?: NumberFormatSettings,
) {
  return formatNumber(Number(value ?? 0), 0, settings);
}

function getQueueTotal(rows: TaskQueue[] | null | undefined) {
  return rows?.reduce((sum, queue) => sum + queue.count, 0) ?? 0;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while loading dashboard data.';
}

function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function useGreetingName() {
  const { user, profile } = useAuthStore();
  return profile?.first_name ?? user?.email?.split('@')[0] ?? 'there';
}

const DASHBOARD_TAB_ORDER: DashboardSectionId[] = [
  'overview',
  'sales',
  'policies',
  'finance',
  'commissions',
  'tiramis',
  'tasks',
  'reinsurance',
];

function normalizeDashboardTab(value?: string): DashboardSectionId | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  return (
    DASHBOARD_TAB_ORDER.find((tab) => tab.toLowerCase() === normalized) ?? null
  );
}

function getDashboardPath(tab: DashboardSectionId) {
  return tab === 'overview' ? '/apps/dashboard' : `/apps/dashboard/${tab}`;
}

function buildTabList(capabilities?: DashboardCapabilitiesResponse) {
  const sections = capabilities?.sections;
  const tabs: Array<{ id: DashboardSectionId; label: string }> = [];

  if (!sections) {
    return [{ id: 'overview' as const, label: 'Overview' }];
  }

  if (sections.overview) tabs.push({ id: 'overview', label: 'Overview' });
  if (sections.sales) tabs.push({ id: 'sales', label: 'Sales' });
  if (sections.policies) tabs.push({ id: 'policies', label: 'Policies' });
  if (sections.finance) tabs.push({ id: 'finance', label: 'Finance' });
  if (sections.commissions)
    tabs.push({ id: 'commissions', label: 'Commissions' });
  if (sections.tiramis) tabs.push({ id: 'tiramis', label: 'TIRAMIS' });
  if (sections.tasks) tabs.push({ id: 'tasks', label: 'Tasks' });
  if (sections.reinsurance)
    tabs.push({ id: 'reinsurance', label: 'Reinsurance' });

  return tabs.length ? tabs : [{ id: 'overview' as const, label: 'Overview' }];
}

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string | number }>;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const numeric =
    items.length > 0 && items.every((item) => typeof item.value === 'number');
  const total = numeric
    ? items.reduce((sum, item) => sum + Number(item.value), 0)
    : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-200/70 py-4">
        <CardTitle>{title}</CardTitle>
        {numeric ? (
          <Badge variant="primary">
            {formatCount(total, numberFormatSettings)} total
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pt-5">
        {!items.length ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No data available.
          </p>
        ) : numeric ? (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <DonutChart
              data={items.map((item) => ({
                label: item.label,
                value: Number(item.value),
              }))}
            />
            <ul className="w-full min-w-0 flex-1 space-y-3">
              {items.map((item, index) => {
                const share = total ? (Number(item.value) / total) * 100 : 0;
                const color = CHART_COLORS[index % CHART_COLORS.length];
                return (
                  <li key={item.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2 text-slate-600">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">
                        {formatCount(Number(item.value), numberFormatSettings)}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {formatPercentage(share, numberFormatSettings)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, background: color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-[13px] text-slate-600">{item.label}</span>
                <span className="text-right text-[13px] font-semibold text-slate-800">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function toTrendPoints(
  rows: Array<Record<string, string | number>>,
  amountField?: string,
  groupBy?: DashboardGroupBy,
): TrendPoint[] {
  // Rows may repeat a period once per currency/status: sum counts per period
  // and chart the amount of the first currency encountered.
  const primaryCurrency = rows.find((row) => row.currency)?.currency;
  const byPeriod = new Map<string, TrendPoint>();
  for (const row of rows) {
    const period = String(row.period ?? 'Unknown');
    const point = byPeriod.get(period) ?? {
      label: period,
      value: 0,
      secondary: 0,
    };
    const countKey = Object.keys(row).find(
      (key) => key.includes('count') || key === 'count',
    );
    point.value += countKey ? Number(row[countKey]) || 0 : 0;
    if (
      amountField &&
      row[amountField] !== undefined &&
      (!row.currency || row.currency === primaryCurrency)
    ) {
      point.secondary =
        (point.secondary ?? 0) + (Number(row[amountField]) || 0);
    }
    byPeriod.set(period, point);
  }
  // Sort on the raw ISO bucket before relabelling for display.
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, point]) => ({
      ...point,
      label: formatTrendPeriod(period, groupBy),
    }));
}

function TrendCard({
  title,
  rows,
  countLabel,
  amountLabel,
  amountField,
  groupBy,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  countLabel: string;
  amountLabel?: string;
  amountField?: string;
  groupBy?: DashboardGroupBy;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const points = toTrendPoints(rows, amountField, groupBy);
  const primaryCurrency = rows.find((row) => row.currency)?.currency;
  const totalCount = points.reduce((sum, point) => sum + point.value, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-200/70 py-4">
        <CardTitle>{title}</CardTitle>
        {points.length ? (
          <span className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {formatCount(totalCount, numberFormatSettings)}
            </span>{' '}
            in {formatPeriodCount(points.length, groupBy)}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pt-5">
        {points.length ? (
          <TrendBarChart
            data={points}
            valueLabel={countLabel}
            secondaryLabel={
              amountLabel
                ? `${amountLabel}${primaryCurrency ? ` (${String(primaryCurrency)})` : ''}`
                : undefined
            }
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            No trend data available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ShortcutAction {
  key: string;
  title: string;
  description: string;
  to?: string;
  tab?: DashboardSectionId;
  badge?: string;
}

function ShortcutGrid({
  title,
  actions,
  onOpenTab,
}: {
  title: string;
  actions: ShortcutAction[];
  onOpenTab?: (tab: DashboardSectionId) => void;
}) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="border-b border-slate-200/70 py-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Card
            key={action.key}
            className="rounded-lg border-slate-200 shadow-none"
          >
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{action.title}</CardTitle>
                {action.badge ? (
                  <Badge variant="outline">{action.badge}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">{action.description}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {action.to ? (
                <Button
                  variant="outline"
                  onClick={() => navigate(action.to as string)}
                >
                  Open workspace
                </Button>
              ) : null}
              {action.tab ? (
                <Button
                  onClick={() => onOpenTab?.(action.tab as DashboardSectionId)}
                >
                  Open dashboard tab
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardActionHeader({
  greetingName,
  organizationName,
  dateRange,
  generatedAt,
  filterMenu,
  onRefresh,
  isRefreshing,
}: {
  greetingName: string;
  organizationName: string;
  dateRange: string;
  generatedAt?: string;
  filterMenu: ReactNode;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-slate-800">
          Welcome back, {greetingName}!
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Track {organizationName} production, policies, finance, TIRAMIS, and
          work queues.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 bg-white">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateRange}
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-white">
            <RefreshCw className="h-3.5 w-3.5" />
            {formatTimestamp(generatedAt)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {filterMenu}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-white"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function DashboardFilterMenu({
  datePreset,
  appliedRange,
  customRange,
  customRangeError,
  companyType,
  scopeLabel,
  assignedBranchCount,
  onDatePresetChange,
  onCustomRangeChange,
}: {
  datePreset: DashboardDatePreset;
  appliedRange: DashboardDateRange;
  customRange: DashboardDateRange;
  customRangeError: string | null;
  companyType: string;
  scopeLabel: string;
  assignedBranchCount: number;
  onDatePresetChange: (preset: DashboardDatePreset) => void;
  onCustomRangeChange: (patch: Partial<DashboardDateRange>) => void;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-white">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="border-b border-slate-200/70 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">
            Dashboard filters
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the reporting window and review the active data scope.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date range
            </p>
            <Select
              value={datePreset}
              onValueChange={(value) =>
                onDatePresetChange(value as DashboardDatePreset)
              }
            >
              <SelectTrigger aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DASHBOARD_DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  From
                </p>
                <Input
                  type="date"
                  aria-label="From"
                  value={customRange.from}
                  max={customRange.to || undefined}
                  onChange={(event) =>
                    onCustomRangeChange({ from: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  To
                </p>
                <Input
                  type="date"
                  aria-label="To"
                  value={customRange.to}
                  min={customRange.from || undefined}
                  onChange={(event) =>
                    onCustomRangeChange({ to: event.target.value })
                  }
                />
              </div>
              {customRangeError ? (
                <p role="alert" className="text-sm text-red-600 sm:col-span-2">
                  {customRangeError} Showing {formatDateRange(appliedRange)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-md border border-slate-200/70 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Period
              </span>
              <span className="text-right text-sm font-semibold text-slate-800">
                {formatDateRange(appliedRange)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Company
              </span>
              <Badge variant="outline" className="bg-white">
                {companyType}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Branch scope
              </span>
              <Badge variant="outline" className="bg-white">
                {scopeLabel}
              </Badge>
            </div>
            {assignedBranchCount > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Assigned branches
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {formatCount(assignedBranchCount, numberFormatSettings)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProgressRing({ value }: { value: number }) {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const clamped = Math.max(0, Math.min(value, 100));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,.28)"
          strokeWidth="5"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#fff"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
        {formatPercentage(clamped, {
          ...numberFormatSettings,
          percentage_decimal_places: 0,
        })}
      </span>
    </div>
  );
}

function OperationalTargetCard({
  conversionRate,
  completedQuotations,
  eligibleQuotations,
  activePolicies,
}: {
  conversionRate: number;
  completedQuotations: number;
  eligibleQuotations: number;
  activePolicies: number;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-vz-primary via-violet-500 to-vz-secondary p-5 text-white shadow-sm">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.22),transparent_58%)]" />
      <div className="relative z-10 flex h-full min-h-32 items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Your production target</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-white/80">
            Quotation conversion is at{' '}
            {formatPercentage(conversionRate, numberFormatSettings)}, with{' '}
            {formatCount(completedQuotations, numberFormatSettings)} completed
            quotations and {formatCount(activePolicies, numberFormatSettings)}{' '}
            active policies in this period.
          </p>
          <p className="mt-3 text-xs font-semibold underline underline-offset-4">
            Eligible pipeline:{' '}
            {formatCount(eligibleQuotations, numberFormatSettings)}
          </p>
        </div>
        <ProgressRing value={conversionRate} />
      </div>
    </Card>
  );
}

function ActivityCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ key: string; label: string; meta: string; tone?: string }>;
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-200/70 py-3.5">
        <CardTitle className="text-[14px]">{title}</CardTitle>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          <ClipboardList className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {!items.length ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: item.tone ?? CHART_COLORS[0] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-5 text-slate-700">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {item.meta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Dashboard section unavailable</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function OverviewContent({
  data,
  isLoading,
  error,
}: {
  data?: OverviewResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const quotationKpis = data?.kpis.quotations;
  const policyKpis = data?.kpis.policies;
  const customerKpis = data?.kpis.customers;
  const financeKpis = data?.kpis.finance;
  const commissionKpis = data?.kpis.commissions;
  const tiramisKpis = data?.kpis.tiramis;
  const conversionRate = quotationKpis?.conversion_rate ?? 0;
  const openQueueItems = getQueueTotal(data?.work_queues);
  const alertItems =
    data?.alerts.slice(0, 8).map((alert, index) => ({
      key: alert.code + index,
      label: alert.message,
      meta: `${alert.severity.toUpperCase()} priority - ${alert.code}`,
      tone: alert.severity === 'high' ? '#f06548' : '#f7b84b',
    })) ?? [];
  const queueItems =
    data?.work_queues.slice(0, 6).map((queue, index) => ({
      key: queue.key,
      label: queue.label,
      meta: `${formatCount(queue.count, numberFormatSettings)} item${queue.count === 1 ? '' : 's'} waiting`,
      tone: CHART_COLORS[index % CHART_COLORS.length],
    })) ?? [];

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <div className="lg:col-span-2">
            <OperationalTargetCard
              conversionRate={conversionRate}
              completedQuotations={quotationKpis?.completed_quotations ?? 0}
              eligibleQuotations={quotationKpis?.eligible_for_conversion ?? 0}
              activePolicies={policyKpis?.active_policies ?? 0}
            />
          </div>
          <DashboardCard
            icon={Users}
            tone="info"
            title="Total customers"
            value={formatCount(
              customerKpis?.total_customers,
              numberFormatSettings,
            )}
            loading={isLoading}
            description={`${formatCount(
              customerKpis?.active_customers,
              numberFormatSettings,
            )} active`}
          />
          <DashboardCard
            icon={Wallet}
            tone="success"
            title="Policy premium"
            value={formatPrimaryMoney(
              policyKpis?.total_premium,
              numberFormatSettings,
            )}
            loading={isLoading}
            description="Issued policy premium"
          />
          <DashboardCard
            icon={BarChart3}
            tone="warning"
            title="Quotations"
            value={formatCount(
              quotationKpis?.total_quotations,
              numberFormatSettings,
            )}
            loading={isLoading}
            description={`${formatCount(
              quotationKpis?.completed_quotations,
              numberFormatSettings,
            )} completed | ${formatMetricValue(
              conversionRate,
              '%',
              numberFormatSettings,
            )} conversion`}
          />
          <DashboardCard
            icon={ShieldCheck}
            tone="primary"
            title="Active policies"
            value={formatCount(
              policyKpis?.active_policies,
              numberFormatSettings,
            )}
            loading={isLoading}
            description={`${formatCount(
              policyKpis?.expiring_within_30_days,
              numberFormatSettings,
            )} expiring in 30 days`}
          />
          <DashboardCard
            icon={Wallet}
            tone="success"
            title="Collected"
            value={formatPrimaryMoney(
              financeKpis?.collected_amount,
              numberFormatSettings,
            )}
            loading={isLoading}
            description={`${formatCount(
              financeKpis?.open_invoices,
              numberFormatSettings,
            )} open invoices | ${formatCount(
              financeKpis?.overdue_invoices,
              numberFormatSettings,
            )} overdue`}
          />
          <DashboardCard
            icon={AlertCircle}
            tone="danger"
            title="Operational queue"
            value={formatCount(openQueueItems, numberFormatSettings)}
            loading={isLoading}
            description={`${formatCount(
              tiramisKpis?.failed_submissions,
              numberFormatSettings,
            )} failed TIRAMIS | ${formatCount(
              tiramisKpis?.retryable_submissions,
              numberFormatSettings,
            )} retryable`}
          />
        </div>

        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Revenue and policy analytics"
          rows={data?.charts.policy_trend ?? []}
          countLabel="Policy count"
          amountLabel="Total premium"
          amountField="total_premium"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <TrendCard
            groupBy={data?.context.period.group_by}
            title="Quotation pipeline"
            rows={data?.charts.quotation_trend ?? []}
            countLabel="Quotation count"
            amountLabel="Quoted premium"
            amountField="quoted_premium"
          />
          <BreakdownCard
            title="Quotation statuses"
            items={
              data?.charts.quotation_statuses.map((item) => ({
                label: item.label,
                value: item.count,
              })) ?? []
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <BreakdownCard
          title="Policy portfolio"
          items={
            data?.charts.policy_statuses.map((item) => ({
              label: item.label,
              value: item.count,
            })) ?? []
          }
        />
        <BreakdownCard
          title="TIRAMIS status"
          items={
            data?.charts.tiramis_statuses.map((item) => ({
              label: item.label,
              value: item.count,
            })) ?? []
          }
        />
        <ActivityCard
          title="Work queues"
          items={queueItems}
          emptyLabel="No work queues waiting."
        />
        <ActivityCard
          title="Recent alerts"
          items={alertItems}
          emptyLabel="No operational alerts."
        />
        <BreakdownCard
          title="Commissions"
          items={[
            {
              label: 'Pending transactions',
              value: formatCount(
                commissionKpis?.pending_transactions,
                numberFormatSettings,
              ),
            },
            {
              label: 'Paid transactions',
              value: formatCount(
                commissionKpis?.paid_transactions,
                numberFormatSettings,
              ),
            },
            {
              label: 'Accrued amount',
              value: formatMoneyRows(
                commissionKpis?.accrued_amount,
                numberFormatSettings,
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function SalesContent({
  data,
  isLoading,
  error,
}: {
  data?: SalesResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Total quotations"
          value={formatCount(data?.kpis.total_quotations, numberFormatSettings)}
          loading={isLoading}
          description={`Completed ${formatCount(
            data?.kpis.completed_quotations,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Pending approval"
          value={formatCount(data?.kpis.pending_approval, numberFormatSettings)}
          loading={isLoading}
          description={`Awaiting payment ${formatCount(
            data?.kpis.awaiting_payment,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Ready for TIRAMIS"
          value={formatCount(
            data?.kpis.ready_for_tiramis,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Failed TIRAMIS ${formatCount(
            data?.kpis.failed_tiramis,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Conversion rate"
          value={formatMetricValue(
            data?.kpis.conversion_rate ?? 0,
            '%',
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Converted ${formatCount(
            data?.kpis.converted_quotations,
            numberFormatSettings,
          )} of ${formatCount(
            data?.kpis.eligible_for_conversion,
            numberFormatSettings,
          )}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Quoted premium"
          items={
            data?.kpis.quoted_premium.map((row) => ({
              label: row.currency,
              value: formatMoney(
                row.amount,
                row.currency,
                numberFormatSettings,
              ),
            })) ?? []
          }
        />
        <BreakdownCard
          title="Quotation statuses"
          items={
            data?.charts.status_breakdown.map((row) => ({
              label: row.label,
              value: row.count,
            })) ?? []
          }
        />
      </div>

      <TrendCard
        groupBy={data?.context.period.group_by}
        title="Quotation trend"
        rows={data?.charts.trend ?? []}
        countLabel="Quotation count"
        amountLabel="Quoted premium"
        amountField="quoted_premium"
      />
    </div>
  );
}

function PoliciesContent({
  data,
  isLoading,
  error,
}: {
  data?: PoliciesResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Total policies"
          value={formatCount(data?.kpis.total_policies, numberFormatSettings)}
          loading={isLoading}
          description={`Active ${formatCount(
            data?.kpis.active_policies,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Expiring in 30 days"
          value={formatCount(
            data?.kpis.expiring_within_30_days,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Expired ${formatCount(
            data?.kpis.expired_policies,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Pending TIRAMIS sync"
          value={formatCount(
            data?.kpis.pending_tiramis_sync,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Policies still awaiting regulatory sync"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Premium"
          value={formatMoneyRows(
            data?.kpis.total_premium,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Policy premium by currency"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Policy statuses"
          items={
            data?.charts.status_breakdown.map((row) => ({
              label: row.label,
              value: row.count,
            })) ?? []
          }
        />
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Policy trend"
          rows={data?.charts.trend ?? []}
          countLabel="Policy count"
          amountLabel="Total premium"
          amountField="total_premium"
        />
      </div>
    </div>
  );
}

function FinanceContent({
  data,
  isLoading,
  error,
}: {
  data?: FinanceResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Total invoices"
          value={formatCount(data?.kpis.total_invoices, numberFormatSettings)}
          loading={isLoading}
          description={`Open ${formatCount(
            data?.kpis.open_invoices,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Overdue invoices"
          value={formatCount(data?.kpis.overdue_invoices, numberFormatSettings)}
          loading={isLoading}
          description={`Receipts ${formatCount(
            data?.kpis.total_receipts,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Invoiced amount"
          value={formatMoneyRows(
            data?.kpis.invoiced_amount,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Total invoiced during the selected period"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Outstanding amount"
          value={formatMoneyRows(
            data?.kpis.outstanding_amount,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Uncollected balances by currency"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Collected amount"
          items={
            data?.kpis.collected_amount.map((row) => ({
              label: row.currency,
              value: formatMoney(
                row.amount,
                row.currency,
                numberFormatSettings,
              ),
            })) ?? []
          }
        />
        <BreakdownCard
          title="Finance visibility"
          items={[
            {
              label: 'Mode',
              value: data?.kpis.finance_visibility_mode ?? 'Unavailable',
            },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Invoice trend"
          rows={data?.charts.invoice_trend ?? []}
          countLabel="Invoice count"
          amountLabel="Invoiced amount"
          amountField="invoiced_amount"
        />
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Receipt trend"
          rows={data?.charts.receipt_trend ?? []}
          countLabel="Receipt count"
          amountLabel="Collected amount"
          amountField="collected_amount"
        />
      </div>
    </div>
  );
}

function CommissionsContent({
  data,
  isLoading,
  error,
}: {
  data?: CommissionsResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Commission transactions"
          value={formatCount(
            data?.kpis.total_transactions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Pending ${formatCount(
            data?.kpis.pending_transactions,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Paid transactions"
          value={formatCount(
            data?.kpis.paid_transactions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Settled commission transactions"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Accrued amount"
          value={formatMoneyRows(
            data?.kpis.accrued_amount,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Accrued commissions by currency"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Paid amount"
          value={formatMoneyRows(data?.kpis.paid_amount, numberFormatSettings)}
          loading={isLoading}
          description="Paid commissions by currency"
        />
      </div>

      <BreakdownCard
        title="Commission status breakdown"
        items={
          data?.charts.status_breakdown.map((row) => ({
            label: `${row.status} (${row.currency})`,
            value: `${formatCount(row.count, numberFormatSettings)} | ${formatMoney(
              row.amount,
              row.currency,
              numberFormatSettings,
            )}`,
          })) ?? []
        }
      />
    </div>
  );
}

function TiramisContent({
  data,
  isLoading,
  error,
}: {
  data?: TiramisResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Total submissions"
          value={formatCount(
            data?.kpis.total_submissions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Successful ${formatCount(
            data?.kpis.successful_submissions,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={Monitor}
          tone="info"
          title="Pending submissions"
          value={formatCount(
            data?.kpis.pending_submissions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Still awaiting a final outcome"
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Failed submissions"
          value={formatCount(
            data?.kpis.failed_submissions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Retryable ${formatCount(
            data?.kpis.retryable_submissions,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Success rate"
          value={formatMetricValue(
            data?.kpis.total_submissions
              ? (data.kpis.successful_submissions /
                  data.kpis.total_submissions) *
                  100
              : 0,
            '%',
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Successful submissions over total"
        />
        <DashboardCard
          icon={Key}
          tone="secondary"
          title="Retryable queue"
          value={formatCount(
            data?.kpis.retryable_submissions,
            numberFormatSettings,
          )}
          loading={isLoading}
          description="Submissions that can be retried"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="TIRAMIS statuses"
          items={
            data?.charts.status_breakdown.map((row: CountBreakdownItem) => ({
              label: row.label,
              value: row.count,
            })) ?? []
          }
        />
        <BreakdownCard
          title="Recent failures"
          items={
            data?.recent_failures.map((failure) => ({
              label: `${failure.business_reference ?? failure.tracking_id} - ${failure.status}`,
              value: formatTimestamp(failure.created_at),
            })) ?? []
          }
        />
      </div>
    </div>
  );
}

function TasksContent({
  data,
  isLoading,
  error,
}: {
  data?: TasksResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Open items"
          value={formatCount(data?.totals.open_items, numberFormatSettings)}
          loading={isLoading}
          description="All outstanding dashboard work queues"
        />
        {(data?.queues ?? []).slice(0, 3).map((queue) => (
          <DashboardCard
            key={queue.key}
            icon={Monitor}
            tone="info"
            title={queue.label}
            value={formatCount(queue.count, numberFormatSettings)}
            loading={isLoading}
            description="Current queue volume"
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Queues"
          items={
            data?.queues.map((queue) => ({
              label: queue.label,
              value: queue.count,
            })) ?? []
          }
        />
        <BreakdownCard
          title="Alerts"
          items={
            data?.alerts.map((alert) => ({
              label: `${alert.severity.toUpperCase()} - ${alert.code}`,
              value: alert.message,
            })) ?? []
          }
        />
      </div>
    </div>
  );
}

function ReinsuranceContent({
  data,
  isLoading,
  error,
}: {
  data?: ReinsuranceResponse;
  isLoading: boolean;
  error: unknown;
}) {
  const numberFormatSettings = useActiveNumberFormatSettings();

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Treaties"
          value={formatCount(data?.kpis.treaties_total, numberFormatSettings)}
          loading={isLoading}
          description={`Active ${formatCount(
            data?.kpis.treaties_active,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Cessions"
          value={formatCount(data?.kpis.cessions_total, numberFormatSettings)}
          loading={isLoading}
          description={`Active ${formatCount(
            data?.kpis.cessions_active,
            numberFormatSettings,
          )} | Declared ${formatCount(
            data?.kpis.cessions_declared,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Recoveries outstanding"
          value={formatMoney(
            data?.kpis.recoveries_outstanding_amount ?? '0.00',
            undefined,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`Expected ${formatMoney(
            data?.kpis.recoveries_expected_amount ?? '0.00',
            undefined,
            numberFormatSettings,
          )} | Received ${formatMoney(
            data?.kpis.recoveries_received_amount ?? '0.00',
            undefined,
            numberFormatSettings,
          )}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Settlement balance"
          value={formatMoney(
            data?.kpis.settlements_balance_amount ?? '0.00',
            undefined,
            numberFormatSettings,
          )}
          loading={isLoading}
          description={`In flight ${formatCount(
            data?.kpis.settlements_in_flight,
            numberFormatSettings,
          )} | Paid ${formatMoney(
            data?.kpis.settlements_paid_amount ?? '0.00',
            undefined,
            numberFormatSettings,
          )}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Reinsurance pipeline"
          items={[
            {
              label: 'Declarations ready',
              value: data?.kpis.declarations_ready ?? 0,
            },
            {
              label: 'Declarations submitted',
              value: data?.kpis.declarations_submitted ?? 0,
            },
            {
              label: 'Declarations accepted',
              value: data?.kpis.declarations_accepted ?? 0,
            },
            {
              label: 'Recoveries open',
              value: data?.kpis.recoveries_open ?? 0,
            },
            {
              label: 'Settlements total',
              value: data?.kpis.settlements_total ?? 0,
            },
          ]}
        />
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Declaration trend"
          rows={data?.charts.declaration_trend ?? []}
          countLabel="Declarations"
        />
      </div>
    </div>
  );
}

function SectionContent({
  tab,
  data,
  isLoading,
  error,
}: {
  tab: DashboardSectionId;
  data?: DashboardSectionResponse;
  isLoading: boolean;
  error: unknown;
}) {
  switch (tab) {
    case 'sales':
      return (
        <SalesContent
          data={data as SalesResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'policies':
      return (
        <PoliciesContent
          data={data as PoliciesResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'finance':
      return (
        <FinanceContent
          data={data as FinanceResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'commissions':
      return (
        <CommissionsContent
          data={data as CommissionsResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'tiramis':
      return (
        <TiramisContent
          data={data as TiramisResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'tasks':
      return (
        <TasksContent
          data={data as TasksResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'reinsurance':
      return (
        <ReinsuranceContent
          data={data as ReinsuranceResponse | undefined}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'overview':
    default:
      return null;
  }
}

function PlatformDashboardPage() {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const greetingName = useGreetingName();
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.getCompanies,
  });
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.getSessions,
  });
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });
  const { data: apiClients, isLoading: apiClientsLoading } = useQuery({
    queryKey: ['api-clients', { page: 1, limit: 1 }],
    queryFn: () => apiClientsApi.getApiClients({ page: 1, limit: 1 }),
  });

  const activeSessions = sessions?.length ?? 0;
  const trustedDevices =
    devices?.filter((device) => device.trusted).length ?? 0;
  const activeClients =
    apiClients?.filter((client) => client.status === 'active').length ?? 0;

  const platformActions: ShortcutAction[] = [
    {
      key: 'companies',
      title: 'Companies',
      description: 'Manage onboarded companies and inspect tenant setup.',
      to: '/apps/companies',
      badge: `${formatCount(companies?.length, numberFormatSettings)} companies`,
    },
    {
      key: 'api-clients',
      title: 'API clients',
      description: 'Audit active integration credentials and their usage.',
      to: '/apps/api-clients',
      badge: `${formatCount(activeClients, numberFormatSettings)} active`,
    },
    {
      key: 'reference-data',
      title: 'Reference data',
      description: 'Maintain countries, currencies, and shared reference sets.',
      to: '/apps/reference-data',
    },
    {
      key: 'permissions',
      title: 'Roles and permissions',
      description: 'Review access grants, roles, and permission assignments.',
      to: '/apps/permissions',
    },
    {
      key: 'reports',
      title: 'Reports',
      description: 'Open the reporting workbench for platform-wide reporting.',
      to: '/apps/reports',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform operations"
        title={`${greetingFor()}, ${greetingName}!`}
        description="Here's what's happening across the platform today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          icon={Users}
          tone="info"
          title="Total Companies"
          value={formatCount(companies?.length, numberFormatSettings)}
          loading={companiesLoading}
          description="Companies onboarded to the platform"
        />
        <DashboardCard
          icon={Monitor}
          tone="info"
          title="Active Sessions"
          value={formatCount(activeSessions, numberFormatSettings)}
          loading={sessionsLoading}
          description="Sessions that are currently active"
        />
        <DashboardCard
          icon={Smartphone}
          tone="warning"
          title="Trusted Devices"
          value={formatCount(trustedDevices, numberFormatSettings)}
          loading={devicesLoading}
          description="Trusted devices available to users"
        />
        <DashboardCard
          icon={Key}
          tone="secondary"
          title="Active API Clients"
          value={formatCount(activeClients, numberFormatSettings)}
          loading={apiClientsLoading}
          description="Active credentials for integrations"
        />
      </div>

      <ShortcutGrid title="Operational shortcuts" actions={platformActions} />
    </div>
  );
}

export function DashboardPage() {
  const numberFormatSettings = useActiveNumberFormatSettings();
  const navigate = useNavigate();
  const { tab: routeTabParam } = useParams<{ tab?: string }>();
  const { user } = useAuthStore();
  const greetingName = useGreetingName();
  const isPlatformAccount = user?.scope === 'platform';
  const isNormalCompanyUser = isStandardCompanyUser(user);
  const canViewExecutive =
    !isNormalCompanyUser &&
    (user?.permissions?.includes('dashboard:overview') ||
      user?.permissions?.includes('dashboards:executive:read'));
  const [datePreset, setDatePreset] =
    useState<DashboardDatePreset>('this_month');
  const [appliedRange, setAppliedRange] = useState<DashboardDateRange>(() =>
    resolveDatePreset('this_month'),
  );
  // Draft inputs for the custom range; only valid ranges reach the queries.
  const [customRange, setCustomRange] =
    useState<DashboardDateRange>(appliedRange);
  const customRangeError =
    datePreset === 'custom' ? getDateRangeError(customRange) : null;
  const filters = useMemo<DashboardQueryParams>(
    () => ({ ...appliedRange, group_by: groupByForRange(appliedRange) }),
    [appliedRange],
  );

  const handleDatePresetChange = (preset: DashboardDatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setCustomRange(appliedRange);
      return;
    }
    setAppliedRange(resolveDatePreset(preset));
  };

  const handleCustomRangeChange = (patch: Partial<DashboardDateRange>) => {
    const next = { ...customRange, ...patch };
    setCustomRange(next);
    if (!getDateRangeError(next)) {
      setAppliedRange(next);
    }
  };

  const capabilitiesQuery = useQuery({
    queryKey: ['tenant-dashboard', 'capabilities'],
    queryFn: dashboardApi.getCapabilities,
    enabled: !isPlatformAccount,
  });
  const overviewQuery = useQuery({
    queryKey: ['tenant-dashboard', 'overview', filters],
    queryFn: () => dashboardApi.getOverview(filters),
    enabled: !isPlatformAccount,
  });
  const executiveQuery = useQuery({
    queryKey: ['tenant-dashboard', 'executive', filters],
    queryFn: analyticsApi.getExecutiveDashboard,
    enabled: !isPlatformAccount && Boolean(canViewExecutive),
  });

  const capabilities =
    capabilitiesQuery.data ?? overviewQuery.data?.capabilities ?? undefined;
  const availableTabs = useMemo(
    () => buildTabList(capabilities),
    [capabilities],
  );
  const resolvedActiveTab = useMemo(() => {
    if (routeTabParam) {
      const normalizedRouteTab = normalizeDashboardTab(routeTabParam);
      if (normalizedRouteTab) {
        if (!capabilities) {
          return normalizedRouteTab;
        }

        if (availableTabs.some((tab) => tab.id === normalizedRouteTab)) {
          return normalizedRouteTab;
        }
      }

      return availableTabs[0]?.id ?? 'overview';
    }

    if (availableTabs.some((tab) => tab.id === 'overview')) {
      return 'overview';
    }

    return availableTabs[0]?.id ?? 'overview';
  }, [availableTabs, routeTabParam, capabilities]);

  const sectionQuery = useQuery({
    queryKey: ['tenant-dashboard', 'section', resolvedActiveTab, filters],
    queryFn: () =>
      dashboardApi.getSection(
        resolvedActiveTab as Exclude<DashboardSectionId, 'overview'>,
        filters,
      ),
    enabled: !isPlatformAccount && resolvedActiveTab !== 'overview',
  });

  const executiveWidgets = executiveQuery.data?.widgets ?? [];
  const currentContext =
    resolvedActiveTab === 'overview'
      ? overviewQuery.data?.context
      : (sectionQuery.data as DashboardSectionResponse | undefined)?.context;
  const generatedAt =
    resolvedActiveTab === 'overview'
      ? overviewQuery.data?.generated_at
      : (sectionQuery.data as DashboardSectionResponse | undefined)
          ?.generated_at;
  const organizationName =
    capabilities?.organization.company_name ??
    user?.companyName ??
    'your workspace';
  const companyType = capabilities?.organization.company_type ?? 'COMPANY';
  const scopeLabel = currentContext?.scope.own_records_only
    ? 'Own records'
    : currentContext?.scope.can_view_all_branches
      ? 'All branches'
      : 'Assigned branches';
  const assignedBranchCount =
    capabilities?.scope.assigned_branch_ids.length ??
    currentContext?.scope.allowed_branch_ids.length ??
    0;
  const isDashboardRefreshing =
    capabilitiesQuery.isFetching ||
    overviewQuery.isFetching ||
    sectionQuery.isFetching ||
    executiveQuery.isFetching;
  const refreshDashboard = () => {
    void capabilitiesQuery.refetch();
    void overviewQuery.refetch();
    if (resolvedActiveTab !== 'overview') {
      void sectionQuery.refetch();
    }
    if (canViewExecutive) {
      void executiveQuery.refetch();
    }
  };
  const tenantActions = useMemo(() => {
    const actions: ShortcutAction[] = [];

    if (capabilities?.sections.overview) {
      actions.push({
        key: 'overview',
        title: 'Operational overview',
        description:
          'Return to the KPI summary, work queues, and active alerts.',
        tab: 'overview',
      });
    }

    if (capabilities?.sections.sales) {
      actions.push({
        key: 'sales',
        title: 'Quotation pipeline',
        description:
          'Open the sales dashboard tab and jump into the quotation register.',
        tab: 'sales',
        to: sharedUnderwritePaths.quotations,
      });
    }

    if (capabilities?.sections.policies) {
      actions.push({
        key: 'policies',
        title: 'Policy portfolio',
        description:
          'Open policy performance on the dashboard and inspect live policies.',
        tab: 'policies',
        to: sharedUnderwritePaths.policies,
      });
    }

    if (capabilities?.sections.finance) {
      actions.push({
        key: 'finance',
        title: 'Finance control',
        description:
          'Review invoice and receipt performance in the finance workspace.',
        tab: 'finance',
        to: '/apps/finance/dashboard',
      });
    }

    if (capabilities?.sections.commissions) {
      actions.push({
        key: 'commissions',
        title: 'Commission control',
        description:
          'Monitor commission exposure and open the commission accrual register.',
        tab: 'commissions',
        to: '/apps/finance/commission-accruals',
      });
    }

    if (capabilities?.sections.tiramis) {
      actions.push({
        key: 'tiramis',
        title: 'TIRAMIS monitoring',
        description:
          'Open submission monitoring and investigate failed or retryable items.',
        tab: 'tiramis',
        to: '/apps/tiramis/dashboard',
      });
    }

    if (capabilities?.sections.tasks) {
      actions.push({
        key: 'tasks',
        title: 'Work queues',
        description:
          'Review operational queues on the dashboard and open formal work items.',
        tab: 'tasks',
        to: '/apps/work-items',
      });
    }

    if (capabilities?.sections.reinsurance) {
      actions.push({
        key: 'reinsurance',
        title: 'Reinsurance desk',
        description:
          'Open treaty and cession monitoring plus the reinsurance workbench.',
        tab: 'reinsurance',
        to: '/apps/reinsurance',
      });
    }

    return actions;
  }, [capabilities]);

  useEffect(() => {
    if (isPlatformAccount) return;
    if (routeTabParam && !capabilities) return;

    const canonicalPath = getDashboardPath(resolvedActiveTab);
    const currentPath = routeTabParam
      ? `/apps/dashboard/${routeTabParam}`
      : '/apps/dashboard';

    if (currentPath !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [
    capabilities,
    isPlatformAccount,
    navigate,
    resolvedActiveTab,
    routeTabParam,
  ]);

  if (isPlatformAccount) {
    return <PlatformDashboardPage />;
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f3f3f9] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <DashboardActionHeader
          greetingName={greetingName}
          organizationName={organizationName}
          dateRange={formatDateRange(appliedRange)}
          generatedAt={generatedAt ?? overviewQuery.data?.generated_at}
          filterMenu={
            <DashboardFilterMenu
              datePreset={datePreset}
              appliedRange={appliedRange}
              customRange={customRange}
              customRangeError={customRangeError}
              companyType={companyType}
              scopeLabel={scopeLabel}
              assignedBranchCount={assignedBranchCount}
              onDatePresetChange={handleDatePresetChange}
              onCustomRangeChange={handleCustomRangeChange}
            />
          }
          onRefresh={refreshDashboard}
          isRefreshing={isDashboardRefreshing}
        />

        {!canViewExecutive && isNormalCompanyUser ? null : !canViewExecutive ? (
          <Alert className="bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Executive dashboard access is restricted</AlertTitle>
            <AlertDescription>
              This account does not currently have `dashboard:overview` or
              `dashboards:executive:read`. The operational dashboard below still
              respects your allowed sections and data scope.
            </AlertDescription>
          </Alert>
        ) : executiveWidgets.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {executiveWidgets.map((widget) => (
              <DashboardCard
                key={widget.code}
                icon={ShieldCheck}
                tone="primary"
                title={widget.name ?? widget.code}
                value={
                  widget.status === 'AVAILABLE'
                    ? formatWidgetValue(
                        widget.data?.value,
                        widget.data?.unit,
                        numberFormatSettings,
                      )
                    : widget.status === 'NO_DATA'
                      ? 'No data'
                      : 'Unavailable'
                }
                loading={executiveQuery.isLoading}
                description={`Freshness ${widget.freshness?.status ?? widget.status}`}
                status={
                  <Badge variant="outline">
                    {widget.freshness?.status ?? widget.status}
                  </Badge>
                }
              />
            ))}
          </div>
        ) : null}

        <Card className="overflow-hidden border-none shadow-sm">
          <CardContent className="p-0">
            <Tabs
              value={resolvedActiveTab}
              onValueChange={(value) =>
                navigate(getDashboardPath(value as DashboardSectionId))
              }
            >
              <div className="overflow-x-auto border-b border-slate-200/70 px-3">
                <TabsList className="min-w-max border-b-0 bg-transparent">
                  {availableTabs.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-4 sm:p-5">
                <TabsContent value="overview" className="mt-0">
                  <OverviewContent
                    data={overviewQuery.data}
                    isLoading={overviewQuery.isLoading}
                    error={overviewQuery.error}
                  />
                </TabsContent>

                {availableTabs
                  .filter((tab) => tab.id !== 'overview')
                  .map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="mt-0">
                      <SectionContent
                        tab={tab.id}
                        data={
                          resolvedActiveTab === tab.id
                            ? sectionQuery.data
                            : undefined
                        }
                        isLoading={
                          resolvedActiveTab === tab.id && sectionQuery.isLoading
                        }
                        error={
                          resolvedActiveTab === tab.id
                            ? sectionQuery.error
                            : null
                        }
                      />
                    </TabsContent>
                  ))}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {!isNormalCompanyUser ? (
          <ShortcutGrid
            title="Operational shortcuts"
            actions={tenantActions}
            onOpenTab={(tab) => navigate(getDashboardPath(tab))}
          />
        ) : null}
      </div>
    </div>
  );
}
