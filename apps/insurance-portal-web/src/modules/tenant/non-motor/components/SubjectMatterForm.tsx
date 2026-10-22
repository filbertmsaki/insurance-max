import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { subjectMatterSchema, type SubjectMatterFormValues } from '../schemas';
import type { MotorCustomerOption } from '@/modules/tenant/motor/types';

interface Props {
  customers: MotorCustomerOption[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: SubjectMatterFormValues) => void;
  defaultValues?: Partial<SubjectMatterFormValues>;
}

export function SubjectMatterForm({
  customers,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<SubjectMatterFormValues>({
    resolver: zodResolver(subjectMatterSchema),
    defaultValues: {
      customer_id: '',
      subject_type: '',
      subject_code: '',
      description: '',
      location: '',
      country: '',
      region: '',
      district: '',
      ward: '',
      latitude: '',
      longitude: '',
      value: '',
      currency: 'TZS',
      status: 'ACTIVE',
      metadata_json: '',
      ...defaultValues,
    },
  });

  const getCustomerLabel = (customer: MotorCustomerOption) =>
    customer.company_name ??
    ([customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
      customer.id);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subject Matter</CardTitle>
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
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {getCustomerLabel(customer)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {[
              ['subject_type', 'Subject Type'],
              ['subject_code', 'Subject Code'],
              ['currency', 'Currency'],
              ['status', 'Status'],
              ['country', 'Country'],
              ['region', 'Region'],
              ['district', 'District'],
              ['ward', 'Ward'],
              ['latitude', 'Latitude'],
              ['longitude', 'Longitude'],
              ['value', 'Value'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof SubjectMatterFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value == null ? '' : String(field.value)}
                        onChange={(event) =>
                          name === 'subject_code'
                            ? field.onChange(
                                event.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                              )
                            : field.onChange(event)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value == null ? '' : String(field.value)}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value == null ? '' : String(field.value)}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata_json"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Metadata JSON</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value == null ? '' : String(field.value)}
                      rows={4}
                      placeholder='{"key":"value"}'
                    />
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
