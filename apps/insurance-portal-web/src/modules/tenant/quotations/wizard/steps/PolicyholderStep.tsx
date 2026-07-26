import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormLabel, FormMessage } from '@/components/ui/form';
import { WizardFormItem } from '../components/WizardFormItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import { StepSection } from '../components/StepSection';
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
    <>
      <StepSection title="Step 2. Policyholder" first>
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
                'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
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
              <WizardFormItem>
                <FormLabel>Existing Customer (required)</FormLabel>
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
              </WizardFormItem>
            )}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Fill in the policyholder details below. A new customer record will be
            created when you save this quotation.
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
      </StepSection>

      {mode === 'new' && (
        <StepSection
          title="New Policyholder Details"
          contentClassName="grid gap-3 md:grid-cols-2"
        >
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
                    'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
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
            <WizardFormItem className="md:col-span-2">
              <FormLabel>Full Name (required)</FormLabel>
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
            </WizardFormItem>
          )} />

          <FormField control={form.control} name={fieldName('date_of_birth')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Date of Birth / Incorporation Date (required)</FormLabel>
              <FormControl><Input type="date" max={today} {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />

          {customerType === 'INDIVIDUAL' && (
            <FormField control={form.control} name={fieldName('gender')} render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Gender (required)</FormLabel>
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
              </WizardFormItem>
            )} />
          )}

          <FormField control={form.control} name={fieldName('id_type')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Identification Type (required)</FormLabel>
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
            </WizardFormItem>
          )} />

          <FormField control={form.control} name={fieldName('id_number')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Identification Number (required)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />

          <FormField control={form.control} name={fieldName('phone')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Phone Number (required)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('email')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Email (optional)</FormLabel>
              <FormControl><Input type="email" {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('fax')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Fax (optional)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
            </WizardFormItem>
          )} />

          <FormField control={form.control} name={fieldName('country_code')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Country Code (ISO alpha-3, required)</FormLabel>
              <FormControl><Input maxLength={3} {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('region')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Region (required)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('district')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>District (required)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('street')} render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Street (optional)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
            </WizardFormItem>
          )} />
          <FormField control={form.control} name={fieldName('postal_address')} render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <FormLabel>Postal Address</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </WizardFormItem>
          )} />
        </StepSection>
      )}
    </>
  );
}
