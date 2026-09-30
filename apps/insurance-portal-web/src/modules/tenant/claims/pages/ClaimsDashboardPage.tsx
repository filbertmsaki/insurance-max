import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  FolderOpen,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { DonutChart, TrendBarChart } from '@/components/shared/charts';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';
import { CLAIM_STATUS_META } from '../constants';
import { useClaimsDashboard } from '../hooks';
import { claimsPaths } from '../paths';
import type {
  ClaimQueue,
  ClaimsDashboardBreakdown,
  ClaimsDashboardSummary,
} from '../types';
import { formatClaimMoney } from '../utils';

type Counts = ClaimsDashboardSummary['counts'];

/** The lifecycle as a funnel; each stage opens its claim queue. */
const FUNNEL: Array<{ key: keyof Counts; label: string; queue?: ClaimQueue }> =
  [
    { key: 'notification', label: 'Notification', queue: 'notification' },
    { key: 'pending_intimation', label: 'Intimation', queue: 'intimation' },
    { key: 'under_assessment', label: 'Assessment', queue: 'assessment' },
    { key: 'pending_approval', label: 'Awaiting approval' },
    {
      key: 'pending_discharge',
      label: 'Discharge voucher',
      queue: 'discharge',
    },
    { key: 'pending_payment', label: 'Payment', queue: 'payment' },
    { key: 'partially_paid', label: 'Partially paid', queue: 'payment' },
    { key: 'settled', label: 'Settled' },
    { key: 'rejected', label: 'Rejected', queue: 'rejection' },
  ];

function Funnel({ counts }: { counts: Counts }) {
  const max = Math.max(...FUNNEL.map((stage) => counts[stage.key]), 1);
  return (
    <ul className="space-y-2">
      {FUNNEL.map((stage) => {
        const value = counts[stage.key];
        const label = stage.queue ? (
          <Link
            to={claimsPaths.queue(stage.queue)}
            className="hover:text-blue-600 hover:underline"
          >
            {stage.label}
          </Link>
        ) : (
          stage.label
        );
        return (
          <li
            key={stage.key}
            className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"
          >
            <span className="truncate text-slate-600">{label}</span>
            <span className="h-2.5 rounded-full bg-slate-100">
              <span
                className="block h-2.5 rounded-full bg-blue-500"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{value}</span>
          </li>
        );
      })}
    </ul>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: ClaimsDashboardBreakdown[];
}) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <EmptyState text="No claims in this period." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title.replace(/^By /, '')}</TableHead>
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.claims}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatClaimMoney(row.approved)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatClaimMoney(row.paid)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

/**
 * Claims dashboard: open workload by stage, money at risk, breakdowns and
 * the health of TIRA submissions. Figures follow the user's data scope.
 */
export function ClaimsDashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dashboard = useClaimsDashboard({
    from: from || undefined,
    to: to || undefined,
  });
  const data = dashboard.data;
  const loading = dashboard.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Claims dashboard"
        description="Workload by stage, reserves and payments, and TIRA submission health."
        action={
          <div className="flex flex-wrap items-end gap-2 text-xs text-slate-500">
            <label className="space-y-1">
              <span>Reported from</span>
              <Input
                type="date"
                aria-label="Reported from"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span>to</span>
              <Input
                type="date"
                aria-label="Reported to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        }
      />

      {dashboard.isError ? (
        <ClaimErrorAlert
          error={dashboard.error}
          title="The dashboard could not be loaded"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={FolderOpen}
          tone="primary"
          title="Open claims"
          value={data?.counts.open ?? 0}
          description={`${data?.counts.newly_reported ?? 0} reported in the last 30 days`}
          loading={loading}
        />
        <DashboardCard
          icon={ShieldCheck}
          tone="warning"
          title="Outstanding reserve"
          value={formatClaimMoney(data?.amounts.reserve)}
          description={`${data?.counts.pending_approval_items ?? 0} items awaiting approval`}
          loading={loading}
        />
        <DashboardCard
          icon={Wallet}
          tone="info"
          title="Approved, unpaid"
          value={formatClaimMoney(data?.amounts.outstanding)}
          description={`Approved in total ${formatClaimMoney(data?.amounts.approved)}`}
          loading={loading}
        />
        <DashboardCard
          icon={Banknote}
          tone="success"
          title="Paid"
          value={formatClaimMoney(data?.amounts.paid)}
          description={`${data?.counts.settled ?? 0} settled, ${data?.counts.closed ?? 0} closed`}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title="Claims by stage"
            description="Select a stage to open its queue."
          >
            {data ? <Funnel counts={data.counts} /> : null}
          </SectionCard>
        </div>
        <SectionCard title="TIRA submissions">
          {data ? (
            <div className="space-y-3">
              <DonutChart
                totalLabel="Submissions"
                data={[
                  { label: 'Accepted', value: data.tira.accepted },
                  { label: 'Awaiting TIRA', value: data.tira.pending },
                  { label: 'Failed', value: data.tira.failed },
                  {
                    label: 'Needs reconciliation',
                    value: data.tira.reconciliation_required,
                  },
                ]}
              />
              {data.tira.failed + data.tira.reconciliation_required > 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {data.tira.failed + data.tira.reconciliation_required}{' '}
                  submissions need attention
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        title="Claims reported per month"
        description="Last 12 months; the line shows the amount paid."
      >
        {data?.by_month.length ? (
          <TrendBarChart
            valueLabel="Claims"
            secondaryLabel="Paid"
            data={data.by_month.map((row) => ({
              label: row.month,
              value: Number(row.claims),
              secondary: Number(row.paid ?? 0),
            }))}
          />
        ) : (
          <EmptyState text="No claims reported in the last 12 months." />
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <BreakdownTable title="By product" rows={data?.by_product ?? []} />
        <BreakdownTable title="By class" rows={data?.by_class ?? []} />
        <BreakdownTable title="By branch" rows={data?.by_branch ?? []} />
      </div>

      <SectionCard title="By status">
        {data?.by_status.length ? (
          <div className="flex flex-wrap gap-2">
            {data.by_status.map((row) => (
              <Link
                key={row.status}
                to={`${claimsPaths.list}?status=${row.status}`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:border-blue-300"
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" />
                {CLAIM_STATUS_META[row.status as keyof typeof CLAIM_STATUS_META]
                  ?.label ?? row.status}
                <span className="font-semibold tabular-nums">{row.count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState text="No claims yet." />
        )}
      </SectionCard>
    </div>
  );
}
