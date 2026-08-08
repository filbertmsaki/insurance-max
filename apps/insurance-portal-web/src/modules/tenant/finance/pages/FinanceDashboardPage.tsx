import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { financeApi } from '../api';
import { MetricCard, formatMoney } from '../components';

export function FinanceDashboardPage() {
  const invoices = useQuery({
    queryKey: ['finance', 'dashboard', 'invoices'],
    queryFn: () => financeApi.getInvoices({ limit: 100 }),
  });
  const receipts = useQuery({
    queryKey: ['finance', 'dashboard', 'receipts'],
    queryFn: () => financeApi.getReceipts({ limit: 100 }),
  });
  const refunds = useQuery({
    queryKey: ['finance', 'dashboard', 'refunds'],
    queryFn: () => financeApi.getRefunds({ limit: 100 }),
  });
  const journals = useQuery({
    queryKey: ['finance', 'dashboard', 'journals'],
    queryFn: () => financeApi.getJournals({ limit: 100 }),
  });

  if (
    invoices.isLoading ||
    receipts.isLoading ||
    refunds.isLoading ||
    journals.isLoading
  ) {
    return <Skeleton className="h-[420px] w-full" />;
  }

  const invoiceData = invoices.data?.data ?? [];
  const receiptData = receipts.data?.data ?? [];
  const refundData = refunds.data?.data ?? [];
  const journalData = journals.data?.data ?? [];

  const totalOutstanding = invoiceData.reduce(
    (sum, invoice) => sum + Number(invoice.balance_amount ?? 0),
    0,
  );
  const totalCollected = receiptData.reduce(
    (sum, receipt) => sum + Number(receipt.amount ?? 0),
    0,
  );
  const totalRefunded = refundData
    .filter((refund) => refund.status === 'PAID')
    .reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Dashboard"
        description="Command-driven finance operations, balances, and audit history."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open Invoices" value={invoiceData.length} />
        <MetricCard
          title="Outstanding Balance"
          value={formatMoney(totalOutstanding)}
        />
        <MetricCard
          title="Receipts Posted"
          value={receiptData.length}
          hint={formatMoney(totalCollected)}
        />
        <MetricCard
          title="Paid Refunds"
          value={refundData.filter((item) => item.status === 'PAID').length}
          hint={formatMoney(totalRefunded)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-base font-semibold text-slate-900">
              Quick access
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/finance/invoices">Invoices</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/finance/payments">Payments</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/finance/receipts">Receipts</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/finance/reconciliation">Reconciliation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-slate-600">
            <h2 className="text-base font-semibold text-slate-900">
              Journal coverage
            </h2>
            <p>
              {journalData.length} finance journals are currently available for
              review.
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
