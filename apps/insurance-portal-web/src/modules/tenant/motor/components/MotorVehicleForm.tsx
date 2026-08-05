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
import { motorVehicleSchema, type MotorVehicleFormValues } from '../schemas';
import type { MotorCustomerOption } from '../types';

interface Props {
  customerOptions: MotorCustomerOption[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: MotorVehicleFormValues) => void;
  defaultValues?: Partial<MotorVehicleFormValues>;
}

export function MotorVehicleForm({
  customerOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<MotorVehicleFormValues>({
    resolver: zodResolver(motorVehicleSchema),
    defaultValues: {
      customer_id: '',
      registration_no: '',
      chassis_no: '',
      engine_no: '',
      make: '',
      model: '',
      body_type: '',
      color: '',
      manufacture_year: '',
      usage_type: '',
      vehicle_category: '',
      seating_capacity: '',
      tonnage: '',
      cubic_capacity: '',
      fuel_type: '',
      vehicle_value: '',
      currency: 'TZS',
      status: 'ACTIVE',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vehicle Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
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
            {[
              ['registration_no', 'Registration No.'],
              ['chassis_no', 'Chassis No.'],
              ['engine_no', 'Engine No.'],
              ['make', 'Make'],
              ['model', 'Model'],
              ['body_type', 'Body Type'],
              ['color', 'Color'],
              ['usage_type', 'Usage Type'],
              ['vehicle_category', 'Vehicle Category'],
              ['fuel_type', 'Fuel Type'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof MotorVehicleFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            {[
              ['manufacture_year', 'Manufacture Year'],
              ['seating_capacity', 'Seating Capacity'],
              ['tonnage', 'Tonnage'],
              ['cubic_capacity', 'Cubic Capacity'],
              ['vehicle_value', 'Vehicle Value'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof MotorVehicleFormValues}
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
