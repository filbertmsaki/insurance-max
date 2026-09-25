import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Key,
  Monitor,
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
import { phase16Api } from '@/modules/tenant/phase16/api/phase16';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { isStandardCompanyUser } from '@/lib/auth/permissions';

function formatMetricValue(
  value: string | number | null | undefined,
  suffix?: string,
) {
  if (value === null || value === undefined || value === '') {
    return 'Unavailable';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  const formatted = numeric.toLocaleString(undefined, {
    minimumFractionDigits: suffix === '%' ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `${formatted}${suffix ?? ''}`;
}

function formatWidgetValue(
  value: string | null | undefined,
  unit: string | undefined,
) {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  if (unit === 'MONEY') {
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (unit === 'PERCENTAGE') {
    return `${numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatMoneyRows(rows: MoneyAmount[] | null | undefined) {
  if (!rows?.length) return 'No amounts';
  return rows.map((row) => `${row.currency} ${row.amount}`).join(' | ');
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
  return tab === 'overview' ? '/dashboard' : `/dashboard/${tab}`;
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
          <Badge variant="primary">{total.toLocaleString()} total</Badge>
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
                        {Number(item.value).toLocaleString()}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {share.toFixed(0)}%
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
              {totalCount.toLocaleString()}
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
  const quotationKpis = data?.kpis.quotations;
  const policyKpis = data?.kpis.policies;
  const customerKpis = data?.kpis.customers;
  const financeKpis = data?.kpis.finance;
  const commissionKpis = data?.kpis.commissions;
  const tiramisKpis = data?.kpis.tiramis;

  if (error) {
    return <SectionError message={getErrorMessage(error)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Quotations"
          value={quotationKpis?.total_quotations ?? 0}
          loading={isLoading}
          description={`Completed ${quotationKpis?.completed_quotations ?? 0} | Conversion ${formatMetricValue(quotationKpis?.conversion_rate ?? 0, '%')}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Policies"
          value={policyKpis?.active_policies ?? 0}
          loading={isLoading}
          description={`Active of ${policyKpis?.total_policies ?? 0} | Expiring soon ${policyKpis?.expiring_within_30_days ?? 0}`}
        />
        <DashboardCard
          icon={Users}
          tone="info"
          title="Customers"
          value={customerKpis?.active_customers ?? 0}
          loading={isLoading}
          description={`Total ${customerKpis?.total_customers ?? 0} | Pending KYC ${customerKpis?.pending_kyc ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Open invoices"
          value={financeKpis?.open_invoices ?? 0}
          loading={isLoading}
          description={`Overdue ${financeKpis?.overdue_invoices ?? 0} | Receipts ${financeKpis?.total_receipts ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Quoted premium"
          value={formatMoneyRows(quotationKpis?.quoted_premium)}
          loading={isLoading}
          description="Quoted premium by currency"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Collected amount"
          value={formatMoneyRows(financeKpis?.collected_amount)}
          loading={isLoading}
          description="Receipts collected in the selected period"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Pending commissions"
          value={commissionKpis?.pending_transactions ?? 0}
          loading={isLoading}
          description={`Paid ${commissionKpis?.paid_transactions ?? 0} | Accrued ${formatMoneyRows(commissionKpis?.accrued_amount)}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="TIRAMIS follow-up"
          value={tiramisKpis?.pending_submissions ?? 0}
          loading={isLoading}
          description={`Failed ${tiramisKpis?.failed_submissions ?? 0} | Retryable ${tiramisKpis?.retryable_submissions ?? 0}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Quotation statuses"
          items={
            data?.charts.quotation_statuses.map((item) => ({
              label: item.label,
              value: item.count,
            })) ?? []
          }
        />
        <BreakdownCard
          title="Policy statuses"
          items={
            data?.charts.policy_statuses.map((item) => ({
              label: item.label,
              value: item.count,
            })) ?? []
          }
        />
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Quotation trend"
          rows={data?.charts.quotation_trend ?? []}
          countLabel="Quotation count"
          amountLabel="Quoted premium"
          amountField="quoted_premium"
        />
        <TrendCard
          groupBy={data?.context.period.group_by}
          title="Policy trend"
          rows={data?.charts.policy_trend ?? []}
          countLabel="Policy count"
          amountLabel="Total premium"
          amountField="total_premium"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Work queues"
          items={
            data?.work_queues.map((queue) => ({
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

function SalesContent({
  data,
  isLoading,
  error,
}: {
  data?: SalesResponse;
  isLoading: boolean;
  error: unknown;
}) {
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
          value={data?.kpis.total_quotations ?? 0}
          loading={isLoading}
          description={`Completed ${data?.kpis.completed_quotations ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Pending approval"
          value={data?.kpis.pending_approval ?? 0}
          loading={isLoading}
          description={`Awaiting payment ${data?.kpis.awaiting_payment ?? 0}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Ready for TIRAMIS"
          value={data?.kpis.ready_for_tiramis ?? 0}
          loading={isLoading}
          description={`Failed TIRAMIS ${data?.kpis.failed_tiramis ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Conversion rate"
          value={formatMetricValue(data?.kpis.conversion_rate ?? 0, '%')}
          loading={isLoading}
          description={`Converted ${data?.kpis.converted_quotations ?? 0} of ${data?.kpis.eligible_for_conversion ?? 0}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Quoted premium"
          items={
            data?.kpis.quoted_premium.map((row) => ({
              label: row.currency,
              value: row.amount,
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
          value={data?.kpis.total_policies ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.active_policies ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Expiring in 30 days"
          value={data?.kpis.expiring_within_30_days ?? 0}
          loading={isLoading}
          description={`Expired ${data?.kpis.expired_policies ?? 0}`}
        />
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Pending TIRAMIS sync"
          value={data?.kpis.pending_tiramis_sync ?? 0}
          loading={isLoading}
          description="Policies still awaiting regulatory sync"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Premium"
          value={formatMoneyRows(data?.kpis.total_premium)}
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
          value={data?.kpis.total_invoices ?? 0}
          loading={isLoading}
          description={`Open ${data?.kpis.open_invoices ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Overdue invoices"
          value={data?.kpis.overdue_invoices ?? 0}
          loading={isLoading}
          description={`Receipts ${data?.kpis.total_receipts ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Invoiced amount"
          value={formatMoneyRows(data?.kpis.invoiced_amount)}
          loading={isLoading}
          description="Total invoiced during the selected period"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Outstanding amount"
          value={formatMoneyRows(data?.kpis.outstanding_amount)}
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
              value: row.amount,
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
          value={data?.kpis.total_transactions ?? 0}
          loading={isLoading}
          description={`Pending ${data?.kpis.pending_transactions ?? 0}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="primary"
          title="Paid transactions"
          value={data?.kpis.paid_transactions ?? 0}
          loading={isLoading}
          description="Settled commission transactions"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Accrued amount"
          value={formatMoneyRows(data?.kpis.accrued_amount)}
          loading={isLoading}
          description="Accrued commissions by currency"
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Paid amount"
          value={formatMoneyRows(data?.kpis.paid_amount)}
          loading={isLoading}
          description="Paid commissions by currency"
        />
      </div>

      <BreakdownCard
        title="Commission status breakdown"
        items={
          data?.charts.status_breakdown.map((row) => ({
            label: `${row.status} (${row.currency})`,
            value: `${row.count} | ${row.amount}`,
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
          value={data?.kpis.total_submissions ?? 0}
          loading={isLoading}
          description={`Successful ${data?.kpis.successful_submissions ?? 0}`}
        />
        <DashboardCard
          icon={Monitor}
          tone="info"
          title="Pending submissions"
          value={data?.kpis.pending_submissions ?? 0}
          loading={isLoading}
          description="Still awaiting a final outcome"
        />
        <DashboardCard
          icon={AlertCircle}
          tone="danger"
          title="Failed submissions"
          value={data?.kpis.failed_submissions ?? 0}
          loading={isLoading}
          description={`Retryable ${data?.kpis.retryable_submissions ?? 0}`}
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
          )}
          loading={isLoading}
          description="Successful submissions over total"
        />
        <DashboardCard
          icon={Key}
          tone="secondary"
          title="Retryable queue"
          value={data?.kpis.retryable_submissions ?? 0}
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
          value={data?.totals.open_items ?? 0}
          loading={isLoading}
          description="All outstanding dashboard work queues"
        />
        {(data?.queues ?? []).slice(0, 3).map((queue) => (
          <DashboardCard
            key={queue.key}
            icon={Monitor}
            tone="info"
            title={queue.label}
            value={queue.count}
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
          value={data?.kpis.treaties_total ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.treaties_active ?? 0}`}
        />
        <DashboardCard
          icon={BarChart3}
          tone="warning"
          title="Cessions"
          value={data?.kpis.cessions_total ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.cessions_active ?? 0} | Declared ${data?.kpis.cessions_declared ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Recoveries outstanding"
          value={data?.kpis.recoveries_outstanding_amount ?? '0.00'}
          loading={isLoading}
          description={`Expected ${data?.kpis.recoveries_expected_amount ?? '0.00'} | Received ${data?.kpis.recoveries_received_amount ?? '0.00'}`}
        />
        <DashboardCard
          icon={Wallet}
          tone="success"
          title="Settlement balance"
          value={data?.kpis.settlements_balance_amount ?? '0.00'}
          loading={isLoading}
          description={`In flight ${data?.kpis.settlements_in_flight ?? 0} | Paid ${data?.kpis.settlements_paid_amount ?? '0.00'}`}
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
    apiClients?.data?.filter((client) => client.status === 'active').length ??
    0;

  const platformActions: ShortcutAction[] = [
    {
      key: 'companies',
      title: 'Companies',
      description: 'Manage onboarded companies and inspect tenant setup.',
      to: '/companies',
      badge: `${companies?.length ?? 0} companies`,
    },
    {
      key: 'api-clients',
      title: 'API clients',
      description: 'Audit active integration credentials and their usage.',
      to: '/api-clients',
      badge: `${activeClients} active`,
    },
    {
      key: 'reference-data',
      title: 'Reference data',
      description: 'Maintain countries, currencies, and shared reference sets.',
      to: '/reference-data',
    },
    {
      key: 'permissions',
      title: 'Roles and permissions',
      description: 'Review access grants, roles, and permission assignments.',
      to: '/permissions',
    },
    {
      key: 'reports',
      title: 'Reports',
      description: 'Open the reporting workbench for platform-wide reporting.',
      to: '/reports',
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
          value={companies?.length ?? 0}
          loading={companiesLoading}
          description="Companies onboarded to the platform"
        />
        <DashboardCard
          icon={Monitor}
          tone="info"
          title="Active Sessions"
          value={activeSessions}
          loading={sessionsLoading}
          description="Sessions that are currently active"
        />
        <DashboardCard
          icon={Smartphone}
          tone="warning"
          title="Trusted Devices"
          value={trustedDevices}
          loading={devicesLoading}
          description="Trusted devices available to users"
        />
        <DashboardCard
          icon={Key}
          tone="secondary"
          title="Active API Clients"
          value={activeClients}
          loading={apiClientsLoading}
          description="Active credentials for integrations"
        />
      </div>

      <ShortcutGrid title="Operational shortcuts" actions={platformActions} />
    </div>
  );
}

export function DashboardPage() {
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
    queryFn: phase16Api.getExecutiveDashboard,
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
        to: underwritingPaths.quotations,
      });
    }

    if (capabilities?.sections.policies) {
      actions.push({
        key: 'policies',
        title: 'Policy portfolio',
        description:
          'Open policy performance on the dashboard and inspect live policies.',
        tab: 'policies',
        to: underwritingPaths.policies,
      });
    }

    if (capabilities?.sections.finance) {
      actions.push({
        key: 'finance',
        title: 'Finance control',
        description:
          'Review invoice and receipt performance in the finance workspace.',
        tab: 'finance',
        to: '/finance/dashboard',
      });
    }

    if (capabilities?.sections.commissions) {
      actions.push({
        key: 'commissions',
        title: 'Commission control',
        description:
          'Monitor commission exposure and open the commission accrual register.',
        tab: 'commissions',
        to: '/finance/commission-accruals',
      });
    }

    if (capabilities?.sections.tiramis) {
      actions.push({
        key: 'tiramis',
        title: 'TIRAMIS monitoring',
        description:
          'Open submission monitoring and investigate failed or retryable items.',
        tab: 'tiramis',
        to: '/tiramis/dashboard',
      });
    }

    if (capabilities?.sections.tasks) {
      actions.push({
        key: 'tasks',
        title: 'Work queues',
        description:
          'Review operational queues on the dashboard and open formal work items.',
        tab: 'tasks',
        to: '/work-items',
      });
    }

    if (capabilities?.sections.reinsurance) {
      actions.push({
        key: 'reinsurance',
        title: 'Reinsurance desk',
        description:
          'Open treaty and cession monitoring plus the reinsurance workbench.',
        tab: 'reinsurance',
        to: '/reinsurance',
      });
    }

    return actions;
  }, [capabilities]);

  useEffect(() => {
    if (isPlatformAccount) return;
    if (routeTabParam && !capabilities) return;

    const canonicalPath = getDashboardPath(resolvedActiveTab);
    const currentPath = routeTabParam
      ? `/dashboard/${routeTabParam}`
      : '/dashboard';

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance operations"
        title={`${greetingFor()}, ${greetingName}!`}
        description={`Here's what's happening with ${capabilities?.organization.company_name ?? user?.companyName ?? 'your workspace'} today.`}
        status={
          <Badge variant="outline">
            {capabilities?.organization.company_type ?? 'COMPANY'}
          </Badge>
        }
      />

      {!canViewExecutive && isNormalCompanyUser ? null : !canViewExecutive ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Executive dashboard access is restricted</AlertTitle>
          <AlertDescription>
            This account does not currently have `dashboard:overview` or
            `dashboards:executive:read`. The operational dashboard below still
            respects your allowed sections and data scope.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {executiveWidgets.map((widget) => (
              <DashboardCard
                key={widget.code}
                icon={ShieldCheck}
                tone="primary"
                title={widget.name ?? widget.code}
                value={
                  widget.status === 'AVAILABLE'
                    ? formatWidgetValue(widget.data?.value, widget.data?.unit)
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

          <Card>
            <CardHeader className="border-b border-slate-200/70 py-4">
              <CardTitle>Dashboard freshness</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <p className="text-sm text-slate-600">
                Executive widgets are still sourced from the metric catalogue,
                while the section tabs below use the tenant dashboard service.
              </p>
              <div className="flex flex-wrap gap-2">
                {executiveWidgets.map((widget) => (
                  <Badge key={widget.code} variant="outline">
                    {widget.name ?? widget.code}:{' '}
                    {widget.freshness?.status ?? widget.status}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="border-b border-slate-200/70 py-4">
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date range
            </p>
            <Select
              value={datePreset}
              onValueChange={(value) =>
                handleDatePresetChange(value as DashboardDatePreset)
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
            <>
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
                    handleCustomRangeChange({ from: event.target.value })
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
                    handleCustomRangeChange({ to: event.target.value })
                  }
                />
              </div>
              {customRangeError ? (
                <p role="alert" className="text-sm text-red-600 lg:col-span-4">
                  {customRangeError} Showing {formatDateRange(appliedRange)}.
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-2 lg:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Period
              </p>
              <p className="flex h-9.5 items-center text-sm text-slate-700">
                {formatDateRange(appliedRange)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 border-b border-slate-200/70 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Tenant dashboard</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Scope:{' '}
                {currentContext?.scope.own_records_only
                  ? 'Own records'
                  : currentContext?.scope.can_view_all_branches
                    ? 'All branches'
                    : 'Assigned branches'}
              </Badge>
              <Badge variant="outline">
                Period:{' '}
                {formatDateRange(currentContext?.period ?? appliedRange)}
              </Badge>
              <Badge variant="outline">
                Generated: {formatTimestamp(generatedAt)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <Tabs
            value={resolvedActiveTab}
            onValueChange={(value) =>
              navigate(getDashboardPath(value as DashboardSectionId))
            }
            className="space-y-4"
          >
            <TabsList className="h-auto flex-wrap gap-1">
              {availableTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewContent
                data={overviewQuery.data}
                isLoading={overviewQuery.isLoading}
                error={overviewQuery.error}
              />
            </TabsContent>

            {availableTabs
              .filter((tab) => tab.id !== 'overview')
              .map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="space-y-6">
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
                      resolvedActiveTab === tab.id ? sectionQuery.error : null
                    }
                  />
                </TabsContent>
              ))}
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
  );
}
