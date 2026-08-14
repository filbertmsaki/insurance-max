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
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients';
import { devicesApi } from '@/modules/shared/devices/api/devices';
import { sessionsApi } from '@/modules/shared/sessions/api/sessions';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { phase16Api } from '@/modules/tenant/phase16/api/phase16';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { usersApi } from '@/modules/tenant/users/api/users';

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
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
  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 px-3 py-2"
            >
              <span className="text-sm text-slate-600">{item.label}</span>
              <span className="text-sm font-semibold text-slate-950">
                {item.value}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No data available.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendCard({
  title,
  rows,
  countLabel,
  amountLabel,
  amountField,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  countLabel: string;
  amountLabel?: string;
  amountField?: string;
}) {
  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length ? (
          rows.slice(0, 10).map((row, index) => (
            <div
              key={`${row.period ?? 'period'}-${row.currency ?? row.status ?? index}`}
              className="rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-950">
                  {String(row.period ?? 'Unknown period')}
                </span>
                {'currency' in row && row.currency ? (
                  <Badge variant="outline">{String(row.currency)}</Badge>
                ) : 'status' in row && row.status ? (
                  <Badge variant="outline">{String(row.status)}</Badge>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                {Object.keys(row)
                  .filter((key) => key !== 'period' && key !== 'currency' && key !== 'status')
                  .map((key) => (
                    <span key={key}>
                      {key === amountField
                        ? amountLabel
                        : key.includes('count')
                          ? countLabel
                          : key}
                      : {String(row[key])}
                    </span>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No trend data available.</p>
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
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Card
            key={action.key}
            className="rounded-lg border-slate-200 shadow-none"
          >
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{action.title}</CardTitle>
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
          title="Quotations"
          value={quotationKpis?.total_quotations ?? 0}
          loading={isLoading}
          description={`Completed ${quotationKpis?.completed_quotations ?? 0} | Conversion ${formatMetricValue(quotationKpis?.conversion_rate ?? 0, '%')}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          title="Policies"
          value={policyKpis?.active_policies ?? 0}
          loading={isLoading}
          description={`Active of ${policyKpis?.total_policies ?? 0} | Expiring soon ${policyKpis?.expiring_within_30_days ?? 0}`}
        />
        <DashboardCard
          icon={Users}
          title="Customers"
          value={customerKpis?.active_customers ?? 0}
          loading={isLoading}
          description={`Total ${customerKpis?.total_customers ?? 0} | Pending KYC ${customerKpis?.pending_kyc ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          title="Open invoices"
          value={financeKpis?.open_invoices ?? 0}
          loading={isLoading}
          description={`Overdue ${financeKpis?.overdue_invoices ?? 0} | Receipts ${financeKpis?.total_receipts ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          title="Quoted premium"
          value={formatMoneyRows(quotationKpis?.quoted_premium)}
          loading={isLoading}
          description="Quoted premium by currency"
        />
        <DashboardCard
          icon={Wallet}
          title="Collected amount"
          value={formatMoneyRows(financeKpis?.collected_amount)}
          loading={isLoading}
          description="Receipts collected in the selected period"
        />
        <DashboardCard
          icon={Wallet}
          title="Pending commissions"
          value={commissionKpis?.pending_transactions ?? 0}
          loading={isLoading}
          description={`Paid ${commissionKpis?.paid_transactions ?? 0} | Accrued ${formatMoneyRows(commissionKpis?.accrued_amount)}`}
        />
        <DashboardCard
          icon={AlertCircle}
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
          title="Quotation trend"
          rows={data?.charts.quotation_trend ?? []}
          countLabel="Quotation count"
          amountLabel="Quoted premium"
          amountField="quoted_premium"
        />
        <TrendCard
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
          title="Total quotations"
          value={data?.kpis.total_quotations ?? 0}
          loading={isLoading}
          description={`Completed ${data?.kpis.completed_quotations ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          title="Pending approval"
          value={data?.kpis.pending_approval ?? 0}
          loading={isLoading}
          description={`Awaiting payment ${data?.kpis.awaiting_payment ?? 0}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          title="Ready for TIRAMIS"
          value={data?.kpis.ready_for_tiramis ?? 0}
          loading={isLoading}
          description={`Failed TIRAMIS ${data?.kpis.failed_tiramis ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
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
          title="Total policies"
          value={data?.kpis.total_policies ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.active_policies ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          title="Expiring in 30 days"
          value={data?.kpis.expiring_within_30_days ?? 0}
          loading={isLoading}
          description={`Expired ${data?.kpis.expired_policies ?? 0}`}
        />
        <DashboardCard
          icon={BarChart3}
          title="Pending TIRAMIS sync"
          value={data?.kpis.pending_tiramis_sync ?? 0}
          loading={isLoading}
          description="Policies still awaiting regulatory sync"
        />
        <DashboardCard
          icon={Wallet}
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
          title="Total invoices"
          value={data?.kpis.total_invoices ?? 0}
          loading={isLoading}
          description={`Open ${data?.kpis.open_invoices ?? 0}`}
        />
        <DashboardCard
          icon={AlertCircle}
          title="Overdue invoices"
          value={data?.kpis.overdue_invoices ?? 0}
          loading={isLoading}
          description={`Receipts ${data?.kpis.total_receipts ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          title="Invoiced amount"
          value={formatMoneyRows(data?.kpis.invoiced_amount)}
          loading={isLoading}
          description="Total invoiced during the selected period"
        />
        <DashboardCard
          icon={Wallet}
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
          title="Invoice trend"
          rows={data?.charts.invoice_trend ?? []}
          countLabel="Invoice count"
          amountLabel="Invoiced amount"
          amountField="invoiced_amount"
        />
        <TrendCard
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
          title="Commission transactions"
          value={data?.kpis.total_transactions ?? 0}
          loading={isLoading}
          description={`Pending ${data?.kpis.pending_transactions ?? 0}`}
        />
        <DashboardCard
          icon={ShieldCheck}
          title="Paid transactions"
          value={data?.kpis.paid_transactions ?? 0}
          loading={isLoading}
          description="Settled commission transactions"
        />
        <DashboardCard
          icon={Wallet}
          title="Accrued amount"
          value={formatMoneyRows(data?.kpis.accrued_amount)}
          loading={isLoading}
          description="Accrued commissions by currency"
        />
        <DashboardCard
          icon={Wallet}
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
          title="Total submissions"
          value={data?.kpis.total_submissions ?? 0}
          loading={isLoading}
          description={`Successful ${data?.kpis.successful_submissions ?? 0}`}
        />
        <DashboardCard
          icon={Monitor}
          title="Pending submissions"
          value={data?.kpis.pending_submissions ?? 0}
          loading={isLoading}
          description="Still awaiting a final outcome"
        />
        <DashboardCard
          icon={AlertCircle}
          title="Failed submissions"
          value={data?.kpis.failed_submissions ?? 0}
          loading={isLoading}
          description={`Retryable ${data?.kpis.retryable_submissions ?? 0}`}
        />
        <DashboardCard
          icon={BarChart3}
          title="Success rate"
          value={formatMetricValue(
            data?.kpis.total_submissions
              ? (data.kpis.successful_submissions / data.kpis.total_submissions) *
                  100
              : 0,
            '%',
          )}
          loading={isLoading}
          description="Successful submissions over total"
        />
        <DashboardCard
          icon={Key}
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
          title="Open items"
          value={data?.totals.open_items ?? 0}
          loading={isLoading}
          description="All outstanding dashboard work queues"
        />
        {(data?.queues ?? []).slice(0, 3).map((queue) => (
          <DashboardCard
            key={queue.key}
            icon={Monitor}
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
          title="Treaties"
          value={data?.kpis.treaties_total ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.treaties_active ?? 0}`}
        />
        <DashboardCard
          icon={BarChart3}
          title="Cessions"
          value={data?.kpis.cessions_total ?? 0}
          loading={isLoading}
          description={`Active ${data?.kpis.cessions_active ?? 0} | Declared ${data?.kpis.cessions_declared ?? 0}`}
        />
        <DashboardCard
          icon={Wallet}
          title="Recoveries outstanding"
          value={data?.kpis.recoveries_outstanding_amount ?? '0.00'}
          loading={isLoading}
          description={`Expected ${data?.kpis.recoveries_expected_amount ?? '0.00'} | Received ${data?.kpis.recoveries_received_amount ?? '0.00'}`}
        />
        <DashboardCard
          icon={Wallet}
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
  const { user } = useAuthStore();
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', { page: 1, limit: 1 }],
    queryFn: () => usersApi.getUsers({ page: 1, limit: 1 }),
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
  const trustedDevices = devices?.filter((device) => device.trusted).length ?? 0;
  const activeClients =
    apiClients?.data?.filter((client) => client.status === 'active').length ??
    0;

  const platformActions: ShortcutAction[] = [
    {
      key: 'users',
      title: 'Users and access',
      description: 'Review platform users, sessions, devices, and access.',
      to: '/users',
      badge: `${users?.pagination?.total ?? 0} users`,
    },
    {
      key: 'companies',
      title: 'Companies',
      description: 'Manage onboarded companies and inspect tenant setup.',
      to: '/companies',
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
        title="Dashboard"
        description={`Welcome back, ${user?.email ?? 'platform user'}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          icon={Users}
          title="Total Users"
          value={users?.pagination?.total ?? 0}
          loading={usersLoading}
          description="Accounts in the current workspace"
        />
        <DashboardCard
          icon={Monitor}
          title="Active Sessions"
          value={activeSessions}
          loading={sessionsLoading}
          description="Sessions that are currently active"
        />
        <DashboardCard
          icon={Smartphone}
          title="Trusted Devices"
          value={trustedDevices}
          loading={devicesLoading}
          description="Trusted devices available to users"
        />
        <DashboardCard
          icon={Key}
          title="Active API Clients"
          value={activeClients}
          loading={apiClientsLoading}
          description="Active credentials for integrations"
        />
      </div>

      <ShortcutGrid
        title="Operational shortcuts"
        actions={platformActions}
      />
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { tab: routeTabParam } = useParams<{ tab?: string }>();
  const { user } = useAuthStore();
  const isPlatformAccount = user?.scope === 'platform';
  const canViewExecutive =
    user?.permissions?.includes('dashboard:overview') ||
    user?.permissions?.includes('dashboards:executive:read');
  const [filters, setFilters] = useState<DashboardQueryParams>({
    from: startOfMonthIso(),
    to: todayIso(),
    group_by: 'DAY',
    limit: 10,
  });

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
  }, [availableTabs, routeTabParam]);

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
        title="Dashboard"
        description={`Operational summary for ${capabilities?.organization.company_name ?? user?.companyName ?? user?.email ?? 'your workspace'}`}
        status={
          <Badge variant="outline">
            {capabilities?.organization.company_type ?? 'COMPANY'}
          </Badge>
        }
      />

      {!canViewExecutive ? (
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

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Dashboard freshness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              From
            </p>
            <Input
              type="date"
              value={filters.from ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  from: event.target.value || undefined,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              To
            </p>
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  to: event.target.value || undefined,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Group By
            </p>
            <Select
              value={filters.group_by ?? 'DAY'}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  group_by: value as DashboardGroupBy,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Day</SelectItem>
                <SelectItem value="WEEK">Week</SelectItem>
                <SelectItem value="MONTH">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Result Limit
            </p>
            <Input
              type="number"
              min={1}
              max={50}
              value={filters.limit ?? 10}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value) || 10,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Tenant dashboard</CardTitle>
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
                Period: {currentContext?.period.from ?? filters.from} to{' '}
                {currentContext?.period.to ?? filters.to}
              </Badge>
              <Badge variant="outline">
                Generated: {formatTimestamp(generatedAt)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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

      <ShortcutGrid
        title="Operational shortcuts"
        actions={tenantActions}
        onOpenTab={(tab) => navigate(getDashboardPath(tab))}
      />
    </div>
  );
}
