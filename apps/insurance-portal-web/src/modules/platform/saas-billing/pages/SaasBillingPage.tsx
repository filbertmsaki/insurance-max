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
  formatMoney,
  formatNumber,
} from '@/modules/shared/formatting/number-format';

import {
  saasBillingApi,
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

function metricTotal(values: Array<string | number | null | undefined>) {
  return values.reduce<number>((sum, value) => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);
}

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
  const subscriptionsQuery = useQuery({
    queryKey: ['platform', 'saas', 'subscriptions'],
    queryFn: saasBillingApi.listSubscriptions,
  });
  const cyclesQuery = useQuery({
    queryKey: ['platform', 'saas', 'cycles'],
    queryFn: saasBillingApi.listCycles,
  });
  const invoicesQuery = useQuery({
    queryKey: ['platform', 'saas', 'invoices'],
    queryFn: saasBillingApi.listInvoices,
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

  const invoices = invoicesQuery.data ?? [];
  const cycles = cyclesQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  const summary = useMemo(
    () => ({
      activeSubscriptions: subscriptions.filter((row) =>
        ['ACTIVE', 'TRIALING'].includes(row.status),
      ).length,
      openCycles: cycles.filter((row) => row.status === 'OPEN').length,
      invoiceBalance: metricTotal(invoices.map((invoice) => invoice.balance_amount)),
      overdueInvoices: invoices.filter((invoice) => invoice.status === 'OVERDUE')
        .length,
    }),
    [cycles, invoices, subscriptions],
  );

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
        <MetricCard label="Active subscriptions" value={summary.activeSubscriptions} />
        <MetricCard label="Open cycles" value={summary.openCycles} />
        <MetricCard
          label="Invoice balance"
          value={formatMoney(summary.invoiceBalance, invoices[0]?.currency)}
        />
        <MetricCard label="Overdue invoices" value={summary.overdueInvoices} />
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_no}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.due_at)}</TableCell>
                      <TableCell>
                        {money(invoice.total_amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        {money(invoice.paid_amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        {money(invoice.balance_amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && <EmptyRow colSpan={7} />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle) => (
                    <CycleRow
                      key={cycle.id}
                      cycle={cycle}
                      onIssue={() => issueInvoiceMutation.mutate(cycle.id)}
                      disabled={issueInvoiceMutation.isPending}
                    />
                  ))}
                  {cycles.length === 0 && <EmptyRow colSpan={7} />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Current Period</TableHead>
                    <TableHead>Next Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        {subscription.subscription_no}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{subscription.billing_interval}</TableCell>
                      <TableCell>
                        {money(subscription.base_price, subscription.currency)}
                      </TableCell>
                      <TableCell>
                        {formatDate(subscription.current_period_start)} -{' '}
                        {formatDate(subscription.current_period_end)}
                      </TableCell>
                      <TableCell>{formatDate(subscription.next_billing_at)}</TableCell>
                    </TableRow>
                  ))}
                  {subscriptions.length === 0 && <EmptyRow colSpan={6} />}
                </TableBody>
              </Table>
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

function CycleRow({
  cycle,
  onIssue,
  disabled,
}: {
  cycle: SaasBillingCycle;
  onIssue: () => void;
  disabled: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        {formatDate(cycle.period_start)} - {formatDate(cycle.period_end)}
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(cycle.status)}>{cycle.status}</Badge>
      </TableCell>
      <TableCell>{money(cycle.base_amount, cycle.currency)}</TableCell>
      <TableCell>{money(cycle.usage_amount, cycle.currency)}</TableCell>
      <TableCell>{money(cycle.tax_amount, cycle.currency)}</TableCell>
      <TableCell>{money(cycle.total_amount, cycle.currency)}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onIssue}
            disabled={disabled || cycle.status === 'INVOICED'}
          >
            <FilePlus2 className="h-4 w-4" />
            Issue
          </Button>
        </div>
      </TableCell>
    </TableRow>
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
