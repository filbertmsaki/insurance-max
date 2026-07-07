import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { InvoiceRecord } from '../types';
import { receiptFormSchema, type ReceiptFormValues } from '../schemas';

interface Props {
  customerOptions: CustomerRecord[];
  invoiceOptions: InvoiceRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: ReceiptFormValues) => void;
  defaultValues?: Partial<ReceiptFormValues>;
}

export function ReceiptForm({
  customerOptions,
  invoiceOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      customer_id: '',
      invoice_id: '',
      payment_method: '',
      amount: '',
      currency: 'TZS',
      payment_reference: '',
      received_by: '',
      received_at: new Date().toISOString(),
      status: 'RECEIVED',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="customer_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {customerOptions.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>{getCustomerDisplayName(customer)} ({customer.customer_no})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoice_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {invoiceOptions.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_no}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="payment_reference" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Reference</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="received_at" render={({ field }) => (
              <FormItem>
                <FormLabel>Received At</FormLabel>
                <FormControl><Input type="datetime-local" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}

