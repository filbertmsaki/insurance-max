import { useForm, useWatch } from 'react-hook-form';
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
  motorVehicleFormSchema,
  type MotorVehicleFormValues,
} from '../schemas';
import type { MotorCustomerOption } from '../types';
import {
  VehicleReferencePicker,
  type VehicleReferenceKind,
} from '@/components/shared/VehicleReferencePicker';
import { useVehicleReference } from '@/modules/platform/reference-data/hooks';

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
    resolver: zodResolver(motorVehicleFormSchema),
    defaultValues: {
      customer_id: '',
      motor_type: 1,
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
  const motorType = useWatch({ control: form.control, name: 'motor_type' });
  const makeValue = useWatch({ control: form.control, name: 'make' });
  const makeQuery = useVehicleReference(
    'makes',
    { search: String(makeValue ?? '') || undefined, is_active: true },
    Boolean(makeValue),
  );
  const selectedMake = makeQuery.data?.find(
    (item) =>
      item.name.toLowerCase() ===
      String(makeValue ?? '')
        .trim()
        .toLowerCase(),
  );
  const referenceKinds: Record<string, VehicleReferenceKind> = {
    make: 'makes',
    model: 'models',
    body_type: 'body_type',
    color: 'colour',
    fuel_type: 'fuel_type',
  };

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
            <FormField
              control={form.control}
              name="motor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Motor Type</FormLabel>
                  <Select
                    value={String(field.value ?? '')}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Registered</SelectItem>
                      <SelectItem value="2">In transit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="registration_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={motorType !== 2}>
                    Registration No.
                  </FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {[
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
                      {referenceKinds[name] ? (
                        <VehicleReferencePicker
                          kind={referenceKinds[name]}
                          value={String(field.value ?? '')}
                          makeId={selectedMake?.id}
                          placeholder={`Select ${label.toLowerCase()}`}
                          searchPlaceholder={`Search ${label.toLowerCase()}`}
                          disabled={name === 'model' && !selectedMake}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (name === 'make')
                              form.setValue('model', '', {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                          }}
                        />
                      ) : (
                        <Input {...field} value={field.value ?? ''} />
                      )}
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
