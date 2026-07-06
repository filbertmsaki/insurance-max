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
import { useQuotationCurrentCompanyId } from '../hooks';
import { quotationFormSchema, type QuotationFormSchemaValues } from '../schemas';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { InsuranceCategory, InsuranceProduct, InsuranceSubClass } from '@/types/product-engine';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

interface Props {
  customerOptions: CustomerRecord[];
  categoryOptions: InsuranceCategory[];
  productOptions: InsuranceProduct[];
  subClassOptions: InsuranceSubClass[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: QuotationFormSchemaValues) => void;
  defaultValues?: Partial<QuotationFormSchemaValues>;
}

export function QuotationForm({
  customerOptions,
  categoryOptions,
  productOptions,
  subClassOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const currentCompanyId = useQuotationCurrentCompanyId();
  const formDefaults: QuotationFormSchemaValues = {
    insurer_company_id: currentCompanyId,
    intermediary_company_id: '',
    branch_id: '',
    department_id: '',
    customer_id: '',
    category_id: '',
    product_id: '',
    sub_class_id: '',
    quotation_type: 'NON_MOTOR',
    channel_type: 'DIRECT',
    status: 'DRAFT',
    currency: 'TZS',
    sum_insured: '',
    basic_premium: '',
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: '',
    total_premium: '',
    net_premium: '',
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    rating_version: '',
    rejection_reason: '',
    ...defaultValues,
  };
  formDefaults.insurer_company_id = defaultValues?.insurer_company_id ?? currentCompanyId;
  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: formDefaults,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation Setup</CardTitle>
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
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customerOptions.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {getCustomerDisplayName(customer)} ({customer.customer_no})
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
              name="quotation_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MOTOR">Motor</SelectItem>
                      <SelectItem value="NON_MOTOR">Non-Motor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productOptions.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.product_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
              <FormField
              control={form.control}
              name="sub_class_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Class</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {subClassOptions.map((subClass) => (
                        <SelectItem key={subClass.id} value={subClass.id}>{subClass.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="channel_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DIRECT">Direct</SelectItem>
                      <SelectItem value="BROKER">Broker</SelectItem>
                      <SelectItem value="AGENCY">Agency</SelectItem>
                      <SelectItem value="BANCASSURANCE">Bancassurance</SelectItem>
                      <SelectItem value="API">API</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {['DRAFT', 'RATED', 'REFERRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED', 'CANCELLED'].map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {[
              ['sum_insured', 'Sum Insured'],
              ['basic_premium', 'Basic Premium'],
              ['total_discount', 'Total Discount'],
              ['total_tax', 'Total Tax'],
              ['total_charges', 'Total Charges'],
              ['total_commission', 'Total Commission'],
              ['total_premium', 'Total Premium'],
              ['net_premium', 'Net Premium'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof QuotationFormSchemaValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valid_from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valid From</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valid_until"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valid Until</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rating_version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating Version</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rejection_reason"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Rejection Reason</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
