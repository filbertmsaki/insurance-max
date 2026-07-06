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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { InsuranceCategory, InsuranceProduct, InsuranceSubClass } from '@/types/product-engine';
import { usePolicyCurrentCompanyId } from '../hooks';
import { policyFormSchema, type PolicyFormSchemaValues } from '../schemas';

interface Props {
  customerOptions: CustomerRecord[];
  categoryOptions: InsuranceCategory[];
  productOptions: InsuranceProduct[];
  subClassOptions: InsuranceSubClass[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: PolicyFormSchemaValues) => void;
  defaultValues?: Partial<PolicyFormSchemaValues>;
}

export function PolicyForm({
  customerOptions,
  categoryOptions,
  productOptions,
  subClassOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const currentCompanyId = usePolicyCurrentCompanyId();
  const formDefaults: PolicyFormSchemaValues = {
    insurer_company_id: currentCompanyId,
    intermediary_company_id: '',
    branch_id: '',
    department_id: '',
    customer_id: '',
    quotation_id: '',
    proposal_id: '',
    category_id: '',
    product_id: '',
    sub_class_id: '',
    channel_type: 'DIRECT',
    policy_status: 'DRAFT',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    issue_date: new Date().toISOString().slice(0, 10),
    currency: 'TZS',
    sum_insured: '',
    basic_premium: '',
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: '',
    total_premium: '',
    net_premium: '',
    reinsurance_required: false,
    reinsurance_status: '',
    retention_amount: '',
    ceded_sum_insured: '',
    ceded_premium: '',
    tira_status: '',
    tira_portal_transaction_id: '',
    tiramis_transaction_id: '',
    ...defaultValues,
  };
  formDefaults.insurer_company_id = defaultValues?.insurer_company_id ?? currentCompanyId;
  const form = useForm<PolicyFormSchemaValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: formDefaults,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Policy Setup</CardTitle>
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
            <FormField control={form.control} name="quotation_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Quotation ID</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="category_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                  <SelectContent>{categoryOptions.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="product_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                  <SelectContent>{productOptions.map((product) => <SelectItem key={product.id} value={product.id}>{product.product_name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sub_class_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-Class</FormLabel>
                <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {subClassOptions.map((subClass) => <SelectItem key={subClass.id} value={subClass.id}>{subClass.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="channel_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Channel</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="policy_status" render={({ field }) => (
              <FormItem>
                <FormLabel>Policy Status</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {[
              ['start_date', 'Start Date', 'date'],
              ['end_date', 'End Date', 'date'],
              ['issue_date', 'Issue Date', 'date'],
              ['currency', 'Currency', 'text'],
              ['sum_insured', 'Sum Insured', 'number'],
              ['basic_premium', 'Basic Premium', 'number'],
              ['total_discount', 'Total Discount', 'number'],
              ['total_tax', 'Total Tax', 'number'],
              ['total_charges', 'Total Charges', 'number'],
              ['total_commission', 'Total Commission', 'number'],
              ['total_premium', 'Total Premium', 'number'],
              ['net_premium', 'Net Premium', 'number'],
              ['retention_amount', 'Retention Amount', 'number'],
              ['ceded_sum_insured', 'Ceded Sum Insured', 'number'],
              ['ceded_premium', 'Ceded Premium', 'number'],
            ].map(([name, label, type]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof PolicyFormSchemaValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type={type as string} {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField control={form.control} name="reinsurance_required" render={({ field }) => (
              <FormItem className="md:col-span-2 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                </FormControl>
                <FormLabel className="!mt-0">Reinsurance required</FormLabel>
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
