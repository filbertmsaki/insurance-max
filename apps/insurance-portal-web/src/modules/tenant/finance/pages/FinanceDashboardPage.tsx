import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canSeeNavLeaf } from '@/components/layout/nav-config';
import { financeDestinations, financeDirectory } from '../finance-navigation';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { financeApi } from '../api';
import { MetricCard } from '../components';
import type { FinanceDashboardAmount } from '../api';

function currencyAmounts(rows: FinanceDashboardAmount[]) {
  if (!rows.length) return 'No balances';
  return rows
    .map((row) => {
      // Keep PostgreSQL NUMERIC totals as strings all the way to display.
      const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(row.amount);
      if (!match) return `${row.currency} unavailable`;
      const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${row.currency} ${match[1]}${grouped}${match[3] ? `.${match[3]}` : ''}`;
    })
    .join(' · ');
}

function recordCount(rows: FinanceDashboardAmount[]) {
  return rows.reduce((total, row) => total + row.count, 0);
}

export function FinanceDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const shortcuts = [
    financeDirectory,
    ...financeDestinations.filter((leaf) =>
      [
        '/apps/finance/invoices',
        '/apps/finance/payments',
        '/apps/finance/receipts',
        '/apps/finance/reconciliation',
      ].includes(leaf.to),
    ),
  ].filter((leaf) => canSeeNavLeaf(user, leaf));
  const summary = useQuery({
    queryKey: ['finance', 'dashboard', 'summary'],
    queryFn: financeApi.getDashboardSummary,
  });

  if (summary.isLoading) {
    return <Skeleton className="h-[420px] w-full" />;
  }

  if (summary.isError || !summary.data) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6">
        <p>Finance totals could not be loaded.</p>
        <Button onClick={() => void summary.refetch()}>Retry</Button>
      </div>
    );
  }

  const { openInvoices, receipts, paidRefunds, journalCount } = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Dashboard"
        description="Command-driven finance operations, balances, and audit history."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open Invoices" value={recordCount(openInvoices)} />
        <MetricCard
          title="Outstanding Balance"
          value={currencyAmounts(openInvoices)}
        />
        <MetricCard
          title="Receipts Posted"
          value={recordCount(receipts)}
          hint={currencyAmounts(receipts)}
        />
        <MetricCard
          title="Paid Refunds"
          value={recordCount(paidRefunds)}
          hint={currencyAmounts(paidRefunds)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-base font-semibold text-slate-900">
              Quick access
            </h2>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((leaf) => (
                <Button asChild size="sm" variant="outline" key={leaf.to}>
                  <Link to={leaf.to}>{leaf.label}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-slate-600">
            <h2 className="text-base font-semibold text-slate-900">
              Journal coverage
            </h2>
            <p>
              {journalCount} operational journal entries are currently available
              for review. Certified foundation journals are reviewed separately.
            </p>
            <p>
              Invoice paid state and quotation payment readiness should now come
              from allocations and posted finance commands, not manual edits.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
