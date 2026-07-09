import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  getCustomerIdFieldName,
  type CustomerIdType,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
}

// Dynamic nested paths (policyholder.first_name, policyholder.nida_no, ...) can't be
// enumerated as a literal union without duplicating every CustomerFormValues key here,
// so this cast is the pragmatic bridge into RHF's FieldPath type for a dynamic name.
function fieldName(name: string): FieldPath<QuotationFormSchemaValues> {
  return `policyholder.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function PolicyholderStep({ form, customerOptions }: Props) {
  const mode = form.watch('policyholder_mode');
  const customerId = form.watch('customer_id');
  const selectedCustomer = customerOptions.find((c) => c.id === customerId);

  const customerType = form.watch('policyholder.customer_type');
  const idType = form.watch('policyholder.id_type');
  const selectedIdField = getCustomerIdFieldName(customerType, idType as CustomerIdType | '');
  const idFieldOptions = CUSTOMER_ID_TYPE_OPTIONS.filter(
    (option) => option.appliesTo === 'BOTH' || option.appliesTo === customerType,
  );

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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Search or select a customer" />
                      </SelectTrigger>
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
                    onClick={() => form.setValue('policyholder.customer_type', option.value)}
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

            {customerType === 'INDIVIDUAL' ? (
              <>
                <FormField control={form.control} name={fieldName('first_name')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('middle_name')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('last_name')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('gender')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('date_of_birth')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value as string} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('nationality')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
              </>
            ) : (
              <>
                <FormField control={form.control} name={fieldName('company_name')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('registration_no')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration No (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('incorporation_certificate_no')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incorporation Certificate No (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('tin')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>TIN (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={fieldName('vrn')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>VRN (optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
              </>
            )}

            <FormField control={form.control} name={fieldName('id_type')} render={({ field }) => (
              <FormItem>
                <FormLabel>Identification Type</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {idFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {selectedIdField && (
              <FormField control={form.control} name={fieldName(selectedIdField)} render={({ field }) => (
                <FormItem>
                  <FormLabel>{idFieldOptions.find((o) => o.field === selectedIdField)?.label} Number</FormLabel>
                  <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name={fieldName('phone')} render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('alternate_phone')} render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate Phone (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('email')} render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl><Input type="email" {...field} value={field.value as string} /></FormControl>
                <FormMessage />
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
            <FormField control={form.control} name={fieldName('ward')} render={({ field }) => (
              <FormItem>
                <FormLabel>Ward (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('street')} render={({ field }) => (
              <FormItem>
                <FormLabel>Street (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={fieldName('postal_address')} render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Address (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name={fieldName('document_verified')} render={({ field }) => (
              <FormItem className="flex items-center gap-2 md:col-span-2">
                <FormControl>
                  <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Identity document verified</FormLabel>
              </FormItem>
            )} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
