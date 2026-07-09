import { useMemo } from 'react';
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
import {
  useQuotationCurrentCompanyId,
  useQuotationDistributionChannels,
} from '../hooks';
import {
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  quotationFormSchema,
  type QuotationFormSchemaValues,
} from '../schemas';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type {
  InsuranceCategory,
  InsuranceProduct,
} from '@/types/product-engine';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

interface Props {
  customerOptions: CustomerRecord[];
  categoryOptions: InsuranceCategory[];
  productOptions: InsuranceProduct[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: QuotationFormSchemaValues) => void;
  defaultValues?: Partial<QuotationFormSchemaValues>;
}

export function QuotationForm({
  customerOptions,
  categoryOptions,
  productOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const currentCompanyId = useQuotationCurrentCompanyId();
  const { data: distributionChannels = [] } =
    useQuotationDistributionChannels();
  const formDefaults: QuotationFormSchemaValues = {
    insurer_company_id: currentCompanyId,
    intermediary_company_id: '',
    branch_id: '',
    department_id: '',
    policyholder_mode: 'existing',
    customer_id: '',
    policyholder: getCustomerDefaultValues(),
    category_id: '',
    product_id: '',
    risks: [createEmptyRiskRow()],
    addons: [],
    motor_mode: 'existing',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
    quotation_flow: 'NON_MOTOR',
    quotation_type: 'NON_MOTOR',
    is_fleet: false,
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
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    rating_version: '',
    rejection_reason: '',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    officer_name: '',
    officer_title: '',
    payment_mode_tira: '1',
    sale_point_id: '',
    exchange_rate: '',
    ...defaultValues,
  };
  formDefaults.insurer_company_id =
    defaultValues?.insurer_company_id ?? currentCompanyId;
  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: formDefaults,
  });
  const channelType = form.watch('channel_type');
  const productId = form.watch('product_id');
  const intermediaryCompanyId = form.watch('intermediary_company_id');
  const intermediaryOptions = useMemo(() => {
    if (channelType === 'DIRECT' || !productId) return [];

    const uniqueCompanies = new Map<
      string,
      { id: string; name: string; slug: string; company_type: string }
    >();

    distributionChannels.forEach((channel) => {
      if (
        channel.channel_type !== channelType ||
        channel.product_id !== productId ||
        channel.status !== 'ACTIVE' ||
        !channel.can_quote ||
        !channel.intermediary_company
      ) {
        return;
      }

      const company = channel.intermediary_company;
      if (!uniqueCompanies.has(company.id)) {
        uniqueCompanies.set(company.id, company);
      }
    });

    return [...uniqueCompanies.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [channelType, distributionChannels, productId]);

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
              name="quotation_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
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
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productOptions.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_name}
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
              name="channel_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('intermediary_company_id', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DIRECT">Direct</SelectItem>
                      <SelectItem value="BROKER">Broker</SelectItem>
                      <SelectItem value="AGENCY">Agency</SelectItem>
                      <SelectItem value="BANCASSURANCE">
                        Bancassurance
                      </SelectItem>
                      <SelectItem value="API">API</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {channelType !== 'DIRECT' ? (
              <FormField
                control={form.control}
                name="intermediary_company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {channelType === 'BROKER'
                        ? 'Broker Company'
                        : channelType === 'AGENCY'
                          ? 'Agency Company'
                          : channelType === 'BANCASSURANCE'
                            ? 'Bancassurance Company'
                            : 'Intermediary Company'}{' '}
                      (required)
                    </FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={intermediaryOptions.length === 0}
                      >
                        <option value="">
                          {intermediaryOptions.length === 0
                            ? 'No linked companies available'
                            : 'Select intermediary company'}
                        </option>
                        {intermediaryOptions.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[
                        'DRAFT',
                        'RATED',
                        'REFERRED',
                        'PENDING_APPROVAL',
                        'APPROVED',
                        'REJECTED',
                        'CONVERTED',
                        'EXPIRED',
                        'CANCELLED',
                      ].map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
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
                name={
                  name as Exclude<
                    keyof QuotationFormSchemaValues,
                    | 'is_fleet'
                    | 'policyholder'
                    | 'risks'
                    | 'addons'
                    | 'motor'
                    | 'fleet'
                    | 'nonMotor'
                  >
                }
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
