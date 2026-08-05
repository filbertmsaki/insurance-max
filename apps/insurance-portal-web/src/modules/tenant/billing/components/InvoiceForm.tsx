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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { useBillingCurrentCompanyId } from '../hooks';
import { invoiceFormSchema, type InvoiceFormValues } from '../schemas';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';

interface Props {
  customerOptions: CustomerRecord[];
  policyOptions: PolicyRecord[];
  quotationOptions: QuotationListItem[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: InvoiceFormValues) => void;
  defaultValues?: Partial<InvoiceFormValues>;
}

export function InvoiceForm({
  customerOptions,
  policyOptions,
  quotationOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const currentCompanyId = useBillingCurrentCompanyId();
  const formDefaults: InvoiceFormValues = {
    insurer_company_id: currentCompanyId,
    intermediary_company_id: '',
    customer_id: '',
    quotation_id: '',
    policy_id: '',
    endorsement_id: '',
    cancellation_id: '',
    renewal_id: '',
    invoice_type: 'POLICY',
    currency: 'TZS',
    gross_amount: '',
    discount_amount: '',
    tax_amount: '',
    charges_amount: '',
    total_amount: '',
    paid_amount: '',
    balance_amount: '',
    status: 'DRAFT',
    due_date: '',
    ...defaultValues,
  };
  formDefaults.insurer_company_id =
    defaultValues?.insurer_company_id ?? currentCompanyId;

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: formDefaults,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customerOptions.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {getCustomerDisplayName(customer)} (
                          {customer.customer_no})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoice_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quotation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) =>
                      field.onChange(value === 'none' ? '' : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {quotationOptions.map((quotation) => (
                        <SelectItem key={quotation.id} value={quotation.id}>
                          {quotation.quotation_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="policy_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) =>
                      field.onChange(value === 'none' ? '' : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {policyOptions.map((policy) => (
                        <SelectItem key={policy.id} value={policy.id}>
                          {policy.policy_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {[
              ['gross_amount', 'Gross Amount'],
              ['discount_amount', 'Discount Amount'],
              ['tax_amount', 'Tax Amount'],
              ['charges_amount', 'Charges Amount'],
              ['total_amount', 'Total Amount'],
              ['paid_amount', 'Paid Amount'],
              ['balance_amount', 'Balance Amount'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof InvoiceFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value == null ? '' : String(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
