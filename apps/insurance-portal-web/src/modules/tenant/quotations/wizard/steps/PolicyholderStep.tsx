import { UserCircle2 } from 'lucide-react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormLabel, FormMessage } from '@/components/ui/form';
import { WizardFormItem } from '../components/WizardFormItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerStatusBadge } from '@/modules/tenant/customers/components/CustomerStatusBadge';
import {
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import { StepSection } from '../components/StepSection';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-28 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">
        {value === null || value === undefined || value === '' ? (
          <span className="font-normal text-slate-400">Not provided</span>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

function ExistingCustomerCard({
  customer,
  onChangeCustomer,
}: {
  customer: CustomerRecord;
  onChangeCustomer: () => void;
}) {
  const idTypeLabel = CUSTOMER_ID_TYPE_OPTIONS.find(
    (option) => option.value === customer.id_type,
  )?.label;
  const genderLabel = CUSTOMER_GENDER_OPTIONS.find(
    (option) => option.value === customer.gender,
  )?.label;
  const hasContactPerson =
    customer.contact_name || customer.contact_role || customer.contact_phone || customer.contact_email;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <UserCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">
                {getCustomerDisplayName(customer)}
              </p>
              <Badge variant="outline">{customer.customer_type.replace(/_/g, ' ')}</Badge>
              <CustomerStatusBadge status={customer.status} />
            </div>
            <code className="text-xs text-slate-400">{customer.customer_no}</code>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onChangeCustomer}>
          Change customer
        </Button>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {customer.customer_type === 'CORPORATE' ? 'Company Details' : 'Personal Details'}
          </p>
          {customer.customer_type === 'CORPORATE' ? (
            <>
              <DetailRow label="Company Name" value={customer.company_name} />
              <DetailRow label="Registration No." value={customer.registration_no} />
              <DetailRow label="Incorporation No." value={customer.incorporation_certificate_no} />
              <DetailRow label="TIN" value={customer.tin} />
              <DetailRow label="VRN" value={customer.vrn} />
            </>
          ) : (
            <>
              <DetailRow label="First Name" value={customer.first_name} />
              <DetailRow label="Middle Name" value={customer.middle_name} />
              <DetailRow label="Last Name" value={customer.last_name} />
              <DetailRow label="Gender" value={genderLabel} />
              <DetailRow
                label="Date of Birth"
                value={customer.date_of_birth ? formatCoverDateLabel(customer.date_of_birth) : null}
              />
              <DetailRow label="Nationality" value={customer.nationality} />
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Contact Details
          </p>
          <DetailRow label="Phone" value={customer.phone} />
          <DetailRow label="Alternate Phone" value={customer.alternate_phone} />
          <DetailRow label="Email" value={customer.email} />
          <DetailRow label="Fax" value={customer.fax} />
          {hasContactPerson && (
            <>
              <DetailRow label="Contact Person" value={customer.contact_name} />
              <DetailRow label="Contact Role" value={customer.contact_role} />
              <DetailRow label="Contact Phone" value={customer.contact_phone} />
              <DetailRow label="Contact Email" value={customer.contact_email} />
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Identification &amp; Verification
          </p>
          <DetailRow label="ID Type" value={idTypeLabel} />
          <DetailRow label="ID Number" value={customer.id_number} />
          <DetailRow label="Document Type" value={customer.document_type} />
          <DetailRow label="Document No." value={customer.document_no} />
          <DetailRow label="KYC Status" value={customer.kyc_status.replace(/_/g, ' ')} />
          <DetailRow label="Document Verified" value={customer.document_verified ? 'Yes' : 'No'} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address</p>
          <DetailRow label="Country" value={customer.country} />
          <DetailRow label="Region" value={customer.region} />
          <DetailRow label="District" value={customer.district} />
          <DetailRow label="Ward" value={customer.ward} />
          <DetailRow label="Street" value={customer.street} />
          <DetailRow label="Postal Address" value={customer.postal_address} />
        </div>
      </div>
    </div>
  );
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
          <ExistingCustomerCard
            customer={selectedCustomer}
            onChangeCustomer={() => form.setValue('customer_id', '')}
          />
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
