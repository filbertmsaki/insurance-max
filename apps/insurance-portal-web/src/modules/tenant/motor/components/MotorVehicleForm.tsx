import { useForm, type UseFormReturn } from 'react-hook-form';
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
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import { VehicleDetailsFields } from '@/modules/tenant/quotations/wizard/components/VehicleDetailsFields';
import type { MotorCustomerOption } from '../types';
import {
  emptyVehicleRegisterValues,
  vehicleRegisterFormSchema,
  type VehicleRegisterFormValues,
} from '../vehicleRegisterForm';

interface Props {
  customerOptions: MotorCustomerOption[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: VehicleRegisterFormValues) => void;
  defaultValues?: VehicleRegisterFormValues;
}

/**
 * Register create/edit form. The vehicle fields are the same flat grid and
 * rules the quotation wizards use (VehicleDetailsFields); only the owner
 * customer, value, currency and status are register-specific.
 */
export function MotorVehicleForm({
  customerOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<VehicleRegisterFormValues>({
    resolver: zodResolver(vehicleRegisterFormSchema),
    defaultValues: defaultValues ?? emptyVehicleRegisterValues(),
  });
  // The shared fields only read and write `motor.*`, which this form has.
  const vehicleForm =
    form as unknown as UseFormReturn<QuotationFormSchemaValues>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Owner</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-3">
                  <FormLabel required>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customerOptions.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.customer_type === 'CORPORATE'
                            ? (customer.company_name ?? customer.customer_no)
                            : [customer.first_name, customer.last_name]
                                .filter(Boolean)
                                .join(' ') || customer.customer_no}{' '}
                          ({customer.customer_no})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vehicle details</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleDetailsFields form={vehicleForm} title={null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Value & status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="motor.vehicle_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle value</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
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
