import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FilePlus2, Play, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import {
  formatMoney,
  formatNumber,
} from '@/modules/shared/formatting/number-format';

import {
  saasBillingApi,
  type CompanySubscription,
  type SaasBillingCycle,
  type SaasInvoice,
  type SaasInvoiceAdjustment,
} from '../api';

type DialogMode = 'payment' | 'void' | 'adjustment' | null;

interface InvoiceDialogState {
  mode: DialogMode;
  invoice: SaasInvoice | null;
}

const emptyDialog: InvoiceDialogState = { mode: null, invoice: null };

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function statusVariant(status?: string | null) {
  const normalized = status?.toUpperCase();
  if (['ACTIVE', 'PAID', 'PUBLISHED', 'INVOICED', 'CLOSED'].includes(normalized ?? '')) {
    return 'success' as const;
  }
  if (['OVERDUE', 'SUSPENDED', 'VOID', 'CANCELLED', 'FAILED'].includes(normalized ?? '')) {
    return 'danger' as const;
  }
  if (['DRAFT', 'OPEN', 'TRIALING', 'PENDING'].includes(normalized ?? '')) {
    return 'warning' as const;
  }
  return 'muted' as const;
}

function money(value: string | number | null | undefined, currency?: string | null) {
  return formatMoney(value ?? 0, currency ?? undefined);
}

const STATUS_FILTER_KEYS = ['status'] as const;
type StatusFilterKey = (typeof STATUS_FILTER_KEYS)[number];
const toOptions = (values: string[]) =>
  values.map((value) => ({ label: value.replace(/_/g, ' '), value }));
const INVOICE_STATUS_OPTIONS = toOptions([
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
]);
const CYCLE_STATUS_OPTIONS = toOptions([
  'OPEN',
  'CALCULATED',
  'INVOICED',
  'CLOSED',
  'CANCELLED',
]);
const SUBSCRIPTION_STATUS_OPTIONS = toOptions([
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED',
]);
type BillingTab = 'invoices' | 'cycles' | 'subscriptions' | 'plans';

export function SaasBillingPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<InvoiceDialogState>(emptyDialog);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_reference: '',
    payment_date: '',
    notes: '',
  });
  const [voidReason, setVoidReason] = useState('');
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment_type: 'CREDIT' as 'CREDIT' | 'DEBIT' | 'WRITE_OFF',
    amount: '',
    reason: '',
  });

  const plansQuery = useQuery({
    queryKey: ['platform', 'saas', 'plans'],
    queryFn: saasBillingApi.listPlans,
  });
  const [tab, setTab] = useState<BillingTab>('invoices');
  const summaryQuery = useQuery({
    queryKey: ['platform', 'saas', 'summary'],
    queryFn: ({ signal }) => saasBillingApi.getSummary(signal),
  });
  const invoicesTable = useServerTable<SaasInvoice, StatusFilterKey>({
    queryKey: ['platform', 'saas', 'invoices'],
    fetcher: (params, signal) => saasBillingApi.listInvoicesPage(params, signal),
    filterKeys: STATUS_FILTER_KEYS,
    prefix: 'inv',
    defaultSortBy: 'created_at',
    enabled: tab === 'invoices',
  });
  const cyclesTable = useServerTable<SaasBillingCycle, StatusFilterKey>({
    queryKey: ['platform', 'saas', 'cycles'],
    fetcher: (params, signal) => saasBillingApi.listCyclesPage(params, signal),
    filterKeys: STATUS_FILTER_KEYS,
    prefix: 'cyc',
    defaultSortBy: 'period_end',
    enabled: tab === 'cycles',
  });
  const subscriptionsTable = useServerTable<
    CompanySubscription,
    StatusFilterKey
  >({
    queryKey: ['platform', 'saas', 'subscriptions'],
    fetcher: (params, signal) =>
      saasBillingApi.listSubscriptionsPage(params, signal),
    filterKeys: STATUS_FILTER_KEYS,
    prefix: 'sub',
    defaultSortBy: 'created_at',
    enabled: tab === 'subscriptions',
  });
  const adjustmentsQuery = useQuery({
    queryKey: ['platform', 'saas', 'adjustments', dialog.invoice?.id],
    queryFn: () => saasBillingApi.listInvoiceAdjustments(dialog.invoice?.id ?? ''),
    enabled: Boolean(dialog.invoice?.id),
  });

  const invalidateBilling = () =>
    queryClient.invalidateQueries({ queryKey: ['platform', 'saas'] });

  const processBillingMutation = useMutation({
    mutationFn: saasBillingApi.processBilling,
    onSuccess: (result) => {
      void invalidateBilling();
      toast.success(
        `Billing processed: ${result.cyclesProcessed ?? 0} cycles, ${result.invoicesIssued ?? 0} invoices`,
      );
    },
    onError: () => toast.error('Billing run failed'),
  });

  const processDunningMutation = useMutation({
    mutationFn: saasBillingApi.processDunning,
    onSuccess: (result) => {
      void invalidateBilling();
      toast.success(`Dunning processed: ${result.processed ?? 0} invoices`);
    },
    onError: () => toast.error('Dunning failed'),
  });

  const scheduledChangesMutation = useMutation({
    mutationFn: saasBillingApi.processScheduledChanges,
    onSuccess: (result) => {
      void invalidateBilling();
      toast.success(`Scheduled changes processed: ${result.processed ?? 0}`);
    },
    onError: () => toast.error('Scheduled change processing failed'),
  });

  const issueInvoiceMutation = useMutation({
    mutationFn: saasBillingApi.issueInvoice,
    onSuccess: () => {
      void invalidateBilling();
      toast.success('Invoice issued');
    },
    onError: () => toast.error('Invoice issue failed'),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      saasBillingApi.recordPayment(dialog.invoice?.id ?? '', {
        amount: paymentForm.amount,
        payment_reference: paymentForm.payment_reference,
        payment_date: paymentForm.payment_date || undefined,
        notes: paymentForm.notes || undefined,
      }),
    onSuccess: () => {
      setDialog(emptyDialog);
      setPaymentForm({
        amount: '',
        payment_reference: '',
        payment_date: '',
        notes: '',
      });
      void invalidateBilling();
      toast.success('Payment recorded');
    },
    onError: () => toast.error('Payment recording failed'),
  });

  const voidMutation = useMutation({
    mutationFn: () => saasBillingApi.voidInvoice(dialog.invoice?.id ?? '', voidReason),
    onSuccess: () => {
      setDialog(emptyDialog);
      setVoidReason('');
      void invalidateBilling();
      toast.success('Invoice voided');
    },
    onError: () => toast.error('Invoice void failed'),
  });

  const adjustmentMutation = useMutation({
    mutationFn: () =>
      saasBillingApi.createAdjustment(dialog.invoice?.id ?? '', adjustmentForm),
    onSuccess: () => {
      setAdjustmentForm({
        adjustment_type: 'CREDIT',
        amount: '',
        reason: '',
      });
      void invalidateBilling();
      void queryClient.invalidateQueries({
        queryKey: ['platform', 'saas', 'adjustments', dialog.invoice?.id],
      });
      toast.success('Adjustment created');
    },
    onError: () => toast.error('Adjustment creation failed'),
  });

  const approveAdjustmentMutation = useMutation({
    mutationFn: saasBillingApi.approveAdjustment,
    onSuccess: () => {
      void invalidateBilling();
      void queryClient.invalidateQueries({
        queryKey: ['platform', 'saas', 'adjustments', dialog.invoice?.id],
      });
      toast.success('Adjustment approved');
    },
    onError: () => toast.error('Adjustment approval failed'),
  });

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const summary = summaryQuery.data;

  const invoiceColumns: Column<SaasInvoice>[] = [
    {
      key: 'invoice_no',
      header: 'Invoice',
      sortable: true,
      cell: (invoice) => <span className="font-medium">{invoice.invoice_no}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (invoice) => (
        <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
      ),
    },
    {
      key: 'due_at',
      header: 'Due',
      sortable: true,
      cell: (invoice) => formatDate(invoice.due_at),
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      cell: (invoice) => money(invoice.total_amount, invoice.currency),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      sortable: true,
      cell: (invoice) => money(invoice.paid_amount, invoice.currency),
    },
    {
      key: 'balance_amount',
      header: 'Balance',
      sortable: true,
      cell: (invoice) => money(invoice.balance_amount, invoice.currency),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (invoice) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openInvoiceDialog('payment', invoice)}
          >
            Pay
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openInvoiceDialog('adjustment', invoice)}
          >
            Adjust
          </Button>
          <Button
            size="sm"
            variant="soft-danger"
            onClick={() => openInvoiceDialog('void', invoice)}
          >
            Void
          </Button>
        </div>
      ),
    },
  ];

  const cycleColumns: Column<SaasBillingCycle>[] = [
    {
      key: 'period_end',
      header: 'Period',
      sortable: true,
      cell: (cycle) => (
        <>
          {formatDate(cycle.period_start)} - {formatDate(cycle.period_end)}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (cycle) => (
        <Badge variant={statusVariant(cycle.status)}>{cycle.status}</Badge>
      ),
    },
    {
      key: 'base_amount',
      header: 'Base',
      sortable: true,
      cell: (cycle) => money(cycle.base_amount, cycle.currency),
    },
    {
      key: 'usage_amount',
      header: 'Usage',
      sortable: true,
      cell: (cycle) => money(cycle.usage_amount, cycle.currency),
    },
    {
      key: 'tax_amount',
      header: 'Tax',
      sortable: true,
      cell: (cycle) => money(cycle.tax_amount, cycle.currency),
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      cell: (cycle) => money(cycle.total_amount, cycle.currency),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (cycle) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => issueInvoiceMutation.mutate(cycle.id)}
            disabled={
              issueInvoiceMutation.isPending || cycle.status === 'INVOICED'
            }
          >
            <FilePlus2 className="h-4 w-4" />
            Issue
          </Button>
        </div>
      ),
    },
  ];

  const subscriptionColumns: Column<CompanySubscription>[] = [
    {
      key: 'subscription_no',
      header: 'Subscription',
      sortable: true,
      cell: (subscription) => (
        <span className="font-medium">{subscription.subscription_no}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (subscription) => (
        <Badge variant={statusVariant(subscription.status)}>
          {subscription.status}
        </Badge>
      ),
    },
    {
      key: 'billing_interval',
      header: 'Interval',
      sortable: true,
      cell: (subscription) => subscription.billing_interval,
    },
    {
      key: 'base_price',
      header: 'Base Price',
      sortable: true,
      cell: (subscription) =>
        money(subscription.base_price, subscription.currency),
    },
    {
      key: 'current_period_start',
      header: 'Current Period',
      sortable: true,
      cell: (subscription) => (
        <>
          {formatDate(subscription.current_period_start)} -{' '}
          {formatDate(subscription.current_period_end)}
        </>
      ),
    },
    {
      key: 'next_billing_at',
      header: 'Next Billing',
      sortable: true,
      cell: (subscription) => formatDate(subscription.next_billing_at),
    },
  ];

  function openInvoiceDialog(mode: DialogMode, invoice: SaasInvoice) {
    setDialog({ mode, invoice });
    setPaymentForm((current) => ({
      ...current,
      amount: invoice.balance_amount,
    }));
  }

  function submitDialog() {
    if (dialog.mode === 'payment') {
      paymentMutation.mutate();
    }
    if (dialog.mode === 'void') {
      voidMutation.mutate();
    }
    if (dialog.mode === 'adjustment') {
      adjustmentMutation.mutate();
    }
  }

  const dialogBusy =
    paymentMutation.isPending ||
    voidMutation.isPending ||
    adjustmentMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="SaaS Billing"
        description="Run platform billing, review subscriptions, issue invoices, and manage owner-controlled invoice adjustments."
        action={
          <>
            <Button
              variant="outline"
              onClick={() => scheduledChangesMutation.mutate()}
              disabled={scheduledChangesMutation.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Scheduled Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => processDunningMutation.mutate()}
              disabled={processDunningMutation.isPending}
            >
              <CreditCard className="h-4 w-4" />
              Dunning
            </Button>
            <Button
              onClick={() => processBillingMutation.mutate()}
              disabled={processBillingMutation.isPending}
            >
              <Play className="h-4 w-4" />
              Billing Run
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active subscriptions"
          value={summary?.activeSubscriptions ?? 0}
        />
        <MetricCard label="Open cycles" value={summary?.openCycles ?? 0} />
        <MetricCard
          label="Invoice balance"
          value={formatMoney(
            summary?.invoiceBalance ?? 0,
            summary?.currency ?? undefined,
          )}
        />
        <MetricCard
          label="Overdue invoices"
          value={summary?.overdueInvoices ?? 0}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as BillingTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                {...invoicesTable.tableProps}
                columns={invoiceColumns}
                searchPlaceholder="Search invoices…"
                filters={tableFilters(invoicesTable.state.filters, [
                  {
                    key: 'status',
                    label: 'Status',
                    options: INVOICE_STATUS_OPTIONS,
                  },
                ])}
                emptyMessage="No records found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                {...cyclesTable.tableProps}
                columns={cycleColumns}
                searchPlaceholder="Search cycles…"
                filters={tableFilters(cyclesTable.state.filters, [
                  {
                    key: 'status',
                    label: 'Status',
                    options: CYCLE_STATUS_OPTIONS,
                  },
                ])}
                emptyMessage="No records found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                {...subscriptionsTable.tableProps}
                columns={subscriptionColumns}
                searchPlaceholder="Search subscriptions…"
                filters={tableFilters(subscriptionsTable.state.filters, [
                  {
                    key: 'status',
                    label: 'Status',
                    options: SUBSCRIPTION_STATUS_OPTIONS,
                  },
                ])}
                emptyMessage="No records found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Trial</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-xs text-slate-500">{plan.code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(plan.status)}>
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{plan.billing_interval}</TableCell>
                      <TableCell>{money(plan.base_price, plan.currency)}</TableCell>
                      <TableCell>{plan.trial_days} days</TableCell>
                      <TableCell>
                        v{formatNumber(plan.current_version_number, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && <EmptyRow colSpan={6} />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(dialog.mode)} onOpenChange={(open) => !open && setDialog(emptyDialog)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === 'payment' && 'Record Payment'}
              {dialog.mode === 'void' && 'Void Invoice'}
              {dialog.mode === 'adjustment' && 'Invoice Adjustment'}
            </DialogTitle>
            <DialogDescription>
              {dialog.invoice?.invoice_no ?? 'Selected invoice'}
            </DialogDescription>
          </DialogHeader>

          {dialog.mode === 'payment' && (
            <div className="space-y-4">
              <Field label="Amount">
                <Input
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Reference">
                <Input
                  value={paymentForm.payment_reference}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      payment_reference: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Payment date">
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      payment_date: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          )}

          {dialog.mode === 'void' && (
            <Field label="Reason">
              <Textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
              />
            </Field>
          )}

          {dialog.mode === 'adjustment' && (
            <div className="space-y-4">
              <Field label="Type">
                <Select
                  value={adjustmentForm.adjustment_type}
                  onValueChange={(value) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustment_type: value as 'CREDIT' | 'DEBIT' | 'WRITE_OFF',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="WRITE_OFF">Write off</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount">
                <Input
                  value={adjustmentForm.amount}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Reason">
                <Textarea
                  value={adjustmentForm.reason}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(adjustmentsQuery.data ?? []).map((adjustment) => (
                      <AdjustmentRow
                        key={adjustment.id}
                        adjustment={adjustment}
                        onApprove={() =>
                          approveAdjustmentMutation.mutate(adjustment.id)
                        }
                        disabled={approveAdjustmentMutation.isPending}
                      />
                    ))}
                    {(adjustmentsQuery.data ?? []).length === 0 && (
                      <EmptyRow colSpan={4} />
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(emptyDialog)}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={dialogBusy}>
              {dialogBusy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-800">{value}</div>
      </CardContent>
    </Card>
  );
}

function AdjustmentRow({
  adjustment,
  onApprove,
  disabled,
}: {
  adjustment: SaasInvoiceAdjustment;
  onApprove: () => void;
  disabled: boolean;
}) {
  return (
    <TableRow>
      <TableCell>{adjustment.adjustment_type}</TableCell>
      <TableCell>
        <Badge variant={statusVariant(adjustment.status)}>
          {adjustment.status}
        </Badge>
      </TableCell>
      <TableCell>{formatMoney(adjustment.amount)}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onApprove}
            disabled={disabled || adjustment.status === 'APPROVED'}
          >
            Approve
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-slate-500">
        No records found
      </TableCell>
    </TableRow>
  );
}
