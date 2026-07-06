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
import { motorFleetSchema, type MotorFleetFormValues } from '../schemas';
import type { MotorCustomerOption, QuotationOption, PolicyOption } from '../types';

interface Props {
  customerOptions: MotorCustomerOption[];
  quotationOptions: QuotationOption[];
  policyOptions: PolicyOption[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: MotorFleetFormValues) => void;
  defaultValues?: Partial<MotorFleetFormValues>;
}

export function MotorFleetForm({
  customerOptions,
  quotationOptions,
  policyOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<MotorFleetFormValues>({
    resolver: zodResolver(motorFleetSchema),
    defaultValues: {
      customer_id: '',
      quotation_id: '',
      policy_id: '',
      fleet_no: '',
      fleet_name: '',
      total_vehicles: '',
      total_sum_insured: '',
      total_premium: '',
      status: 'ACTIVE',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fleet Identity</CardTitle>
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
                          {customer.customer_type === 'CORPORATE'
                            ? customer.company_name ?? customer.customer_no
                            : [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.customer_no}
                          {' '}
                          ({customer.customer_no})
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
              name="fleet_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fleet No.</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fleet_name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Fleet Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
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
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Optional quotation" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No quotation</SelectItem>
                      {quotationOptions.map((quotation) => (
                        <SelectItem key={quotation.id} value={quotation.id}>
                          {quotation.quotation_no} ({quotation.status})
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
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Optional policy" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No policy</SelectItem>
                      {policyOptions.map((policy) => (
                        <SelectItem key={policy.id} value={policy.id}>
                          {policy.policy_no} ({policy.policy_status})
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
              name="total_vehicles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Vehicles</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_sum_insured"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Sum Insured</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_premium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Premium</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
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
