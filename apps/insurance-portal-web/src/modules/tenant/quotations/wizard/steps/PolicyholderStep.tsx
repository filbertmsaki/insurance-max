import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
}

// Dynamic nested paths (policyholder.full_name, policyholder.id_number, ...) can't be
// enumerated as a literal union without duplicating every CustomerFormValues key here,
// so this cast is the pragmatic bridge into RHF's FieldPath type for a dynamic name.
function fieldName(name: string): FieldPath<QuotationFormSchemaValues> {
  return `policyholder.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function PolicyholderStep({ form, customerOptions }: Props) {
  const mode = form.watch('policyholder_mode');
  const customerId = form.watch('customer_id');
  const selectedCustomer = customerOptions.find((c) => c.id === customerId);
  const today = new Date().toISOString().slice(0, 10);

  const customerType = form.watch('policyholder.customer_type');
  const currentIdType = form.watch('policyholder.id_type');
  const idFieldOptions = CUSTOMER_ID_TYPE_OPTIONS.filter(
    (option) => option.appliesTo === 'BOTH' || option.appliesTo === customerType,
  );

  function handleCustomerTypeChange(nextType: 'INDIVIDUAL' | 'CORPORATE') {
    form.setValue('policyholder.customer_type', nextType);

    const idTypeStillValid = CUSTOMER_ID_TYPE_OPTIONS.some(
      (option) =>
        option.value === currentIdType &&
        (option.appliesTo === 'BOTH' || option.appliesTo === nextType),
    );

    if (!idTypeStillValid) {
      form.setValue('policyholder.id_type', '');
    }

    if (nextType === 'CORPORATE') {
      form.setValue('policyholder.gender', '');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2. Policyholder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(
              [
                { value: 'existing' as const, label: 'Existing Customer' },
                { value: 'new' as const, label: 'New Customer' },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue('policyholder_mode', option.value)}
                className={[
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  mode === option.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Existing Customer</FormLabel>
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={(value) => field.onChange(fromSelectValue(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Search or select a customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
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
          ) : (
            <p className="text-sm text-slate-500">
              Fill in the policyholder details below. A new customer record will be created when you
              save this quotation.
            </p>
          )}

          {mode === 'existing' && selectedCustomer && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{getCustomerDisplayName(selectedCustomer)}</p>
              <p className="text-slate-600">{selectedCustomer.customer_no}</p>
              <div className="mt-2 grid gap-1 text-slate-600 md:grid-cols-2">
                <p>Phone: {selectedCustomer.phone}</p>
                <p>Email: {selectedCustomer.email ?? '—'}</p>
                <p>
                  ID: {selectedCustomer.id_type ?? '—'} / {selectedCustomer.id_number ?? '—'}
                </p>
                <p>
                  Location: {selectedCustomer.region}, {selectedCustomer.district}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {mode === 'new' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Policyholder Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="mb-2 block">Customer Type</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'INDIVIDUAL' as const, label: 'Individual' },
                    { value: 'CORPORATE' as const, label: 'Corporate' },
                  ]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleCustomerTypeChange(option.value)}
                    className={[
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                      customerType === option.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <FormField control={form.control} name={fieldName('full_name')} render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value as string}
                    placeholder={
                      customerType === 'INDIVIDUAL'
                        ? 'Augustino Aidan Mwageni'
                        : 'KISWIGU Company Ltd'
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name={fieldName('date_of_birth')} render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth / Incorporation Date</FormLabel>
                <FormControl><Input type="date" max={today} {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {customerType === 'INDIVIDUAL' && (
              <FormField control={form.control} name={fieldName('gender')} render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select
                    value={toSelectValue(field.value as string)}
                    onValueChange={(value) => field.onChange(fromSelectValue(value))}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name={fieldName('id_type')} render={({ field }) => (
              <FormItem>
                <FormLabel>Identification Type</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SELECT_NONE_VALUE}
                  onValueChange={(value) => {
                    field.onChange(value === SELECT_NONE_VALUE ? '' : Number(value));
                  }}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {idFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name={fieldName('id_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Identification Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name={fieldName('phone')} render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('email')} render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl><Input type="email" {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('fax')} render={({ field }) => (
              <FormItem>
                <FormLabel>Fax (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name={fieldName('country_code')} render={({ field }) => (
              <FormItem>
                <FormLabel>Country Code (ISO alpha-3)</FormLabel>
                <FormControl><Input maxLength={3} {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('region')} render={({ field }) => (
              <FormItem>
                <FormLabel>Region</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('district')} render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('street')} render={({ field }) => (
              <FormItem>
                <FormLabel>Street (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('postal_address')} render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Postal Address</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
