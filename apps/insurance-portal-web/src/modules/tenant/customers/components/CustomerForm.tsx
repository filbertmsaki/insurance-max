import { useEffect } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { customerFormSchema, getCustomerDefaultValues } from '../schemas';
import { LocationReferenceSelects } from '@/modules/platform/reference-data/components/LocationReferenceSelects';
import {
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_ID_TYPE_OPTIONS,
  POLICY_HOLDER_FIELD_MAX_LENGTH as MAX,
  POLICY_HOLDER_TYPE_OPTIONS,
  type CustomerFormValues,
  type CustomerRecord,
} from '../types';

interface CustomerFormProps {
  customer?: CustomerRecord | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => void;
}

export function CustomerForm({
  customer,
  isPending,
  submitLabel,
  onSubmit,
}: CustomerFormProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema) as Resolver<CustomerFormValues>,
    defaultValues: getCustomerDefaultValues(customer),
  });

  useEffect(() => {
    if (customer) form.reset(getCustomerDefaultValues(customer));
  }, [customer, form]);

  const policyHolderType = useWatch({
    control: form.control,
    name: 'policy_holder_type',
  });
  const countryCode = useWatch({ control: form.control, name: 'country_code' });
  const region = useWatch({ control: form.control, name: 'region' });
  const district = useWatch({ control: form.control, name: 'district' });
  const isIndividual = policyHolderType === 1;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Policyholder</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="policy_holder_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Policyholder Type</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POLICY_HOLDER_TYPE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
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
              name="policy_holder_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    {isIndividual ? 'Full Name' : 'Registered Company Name'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX.policy_holder_name}
                      placeholder={
                        isIndividual ? 'John Michael Doe' : 'ABC Holdings Ltd'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="policy_holder_birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    {isIndividual ? 'Date of Birth' : 'Incorporation Date'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={isIndividual}>
                    {isIndividual ? 'Gender' : 'Gender (optional)'}
                  </FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUSTOMER_GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
            <CardTitle className="text-base">Identification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="policy_holder_id_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>ID Type</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUSTOMER_ID_TYPE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
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
              name="policy_holder_id_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>ID Number</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX.policy_holder_id_number}
                      placeholder="ID number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact and Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="policy_holder_phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX.policy_holder_phone_number}
                      placeholder="+255 700 000 000"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="policy_holder_fax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fax (optional)</FormLabel>
                  <FormControl>
                    <Input maxLength={MAX.policy_holder_fax} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email_address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Email Address (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      maxLength={MAX.email_address}
                      placeholder="customer@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <LocationReferenceSelects
                required
                countryCode={countryCode}
                region={region}
                district={district}
                errors={{
                  country: form.formState.errors.country_code?.message,
                  region: form.formState.errors.region?.message,
                  district: form.formState.errors.district?.message,
                }}
                onCountryChange={(_country, nextCode) =>
                  form.setValue('country_code', nextCode, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onRegionChange={(nextRegion) =>
                  form.setValue('region', nextRegion, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onDistrictChange={(nextDistrict) =>
                  form.setValue('district', nextDistrict, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Street</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX.street}
                      placeholder="Street"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postal_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Address (optional)</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX.postal_address}
                      placeholder="P.O. Box 123"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isPending}
          >
            Reset
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
