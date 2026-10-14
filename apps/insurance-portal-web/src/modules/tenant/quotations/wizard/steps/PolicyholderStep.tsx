import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  Building2,
  ChevronDown,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { WizardFormItem } from '../components/WizardFormItem';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerStatusBadge } from '@/modules/tenant/customers/components/CustomerStatusBadge';
import { Combobox } from '@/components/ui/combobox';
import { LocationReferenceSelects } from '@/modules/platform/reference-data/components/LocationReferenceSelects';
import {
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import { StepSection } from '../components/StepSection';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  newCustomerInDialog?: boolean;
}

function PolicyholderDetailsContainer({
  enabled,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  children,
}: {
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Use these details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DetailItem = [label: string, value?: string | number | null];

function hasValue(value?: string | number | null) {
  return value !== null && value !== undefined && value !== '';
}

function DetailGroup({ title, items }: { title: string; items: DetailItem[] }) {
  const visible = items.filter(([, value]) => hasValue(value));
  if (visible.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <dl className="space-y-1.5">
        {visible.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function QuickFact({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ExistingCustomerCard({
  customer,
  onChangeCustomer,
  onEditDetails,
}: {
  customer: CustomerRecord;
  onChangeCustomer: () => void;
  onEditDetails: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isCorporate = customer.customer_type === 'CORPORATE';
  const displayName = getCustomerDisplayName(customer);
  const idTypeLabel = CUSTOMER_ID_TYPE_OPTIONS.find(
    (option) => option.value === customer.id_type,
  )?.label;
  const genderLabel = CUSTOMER_GENDER_OPTIONS.find(
    (option) => option.value === customer.gender,
  )?.label;
  const location = [customer.district, customer.region]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
          {isCorporate ? (
            <Building2 className="h-5 w-5" />
          ) : (
            getInitials(displayName) || <UserCircle2 className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-slate-900">
              {displayName}
            </p>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {customer.customer_no} · {isCorporate ? 'Corporate' : 'Individual'}
          </p>
        </div>

        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEditDetails}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onChangeCustomer}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Change
          </Button>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
        {customer.phone && <QuickFact icon={Phone}>{customer.phone}</QuickFact>}
        {customer.email && <QuickFact icon={Mail}>{customer.email}</QuickFact>}
        {customer.id_number && (
          <QuickFact icon={CreditCard}>
            {idTypeLabel ? `${idTypeLabel}: ` : ''}
            {customer.id_number}
          </QuickFact>
        )}
        {location && <QuickFact icon={MapPin}>{location}</QuickFact>}
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          aria-expanded={showDetails}
        >
          {showDetails ? 'Hide details' : 'Show details'}
          <ChevronDown
            className={[
              'h-3.5 w-3.5 transition-transform',
              showDetails ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>
      </div>

      {showDetails && (
        <div className="grid gap-5 border-t border-slate-100 p-4 sm:grid-cols-2">
          {isCorporate ? (
            <DetailGroup
              title="Company"
              items={[
                ['Company name', customer.company_name],
                ['Registration no.', customer.registration_no],
                ['Incorporation no.', customer.incorporation_certificate_no],
                ['TIN', customer.tin],
                ['VRN', customer.vrn],
              ]}
            />
          ) : (
            <DetailGroup
              title="Personal"
              items={[
                ['Gender', genderLabel],
                [
                  'Date of birth',
                  customer.date_of_birth
                    ? formatCoverDateLabel(customer.date_of_birth)
                    : null,
                ],
                ['Nationality', customer.nationality],
              ]}
            />
          )}
          <DetailGroup
            title="Contact"
            items={[
              ['Alternate phone', customer.alternate_phone],
              ['Fax', customer.fax],
              ['Contact person', customer.contact_name],
              ['Contact role', customer.contact_role],
              ['Contact phone', customer.contact_phone],
              ['Contact email', customer.contact_email],
            ]}
          />
          <DetailGroup
            title="Address"
            items={[
              ['Country', customer.country],
              ['Ward', customer.ward],
              ['Street', customer.street],
              ['Postal address', customer.postal_address],
            ]}
          />
        </div>
      )}
    </div>
  );
}

// Dynamic nested paths (policyholder.full_name, policyholder.id_number, ...) can't be
// enumerated as a literal union without duplicating every CustomerFormValues key here,
// so this cast is the pragmatic bridge into RHF's FieldPath type for a dynamic name.
function fieldName(name: string): FieldPath<QuotationFormSchemaValues> {
  return `policyholder.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function PolicyholderStep({
  form,
  customerOptions,
  newCustomerInDialog = false,
}: Props) {
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const mode = form.watch('policyholder_mode');
  const customerId = form.watch('customer_id');
  const selectedCustomer = customerOptions.find((c) => c.id === customerId);
  const today = new Date().toISOString().slice(0, 10);

  const customerType = form.watch('policyholder.customer_type');
  const currentIdType = form.watch('policyholder.id_type');
  const policyholderCountry = form.watch('policyholder.country');
  const policyholderCountryCode = form.watch('policyholder.country_code');
  const policyholderRegion = form.watch('policyholder.region');
  const policyholderDistrict = form.watch('policyholder.district');
  const idFieldOptions = CUSTOMER_ID_TYPE_OPTIONS.filter(
    (option) =>
      option.appliesTo === 'BOTH' || option.appliesTo === customerType,
  );
  const customerSearchOptions = customerOptions.map((customer) => {
    const searchText = [
      getCustomerDisplayName(customer),
      customer.customer_no,
      customer.phone,
      customer.email,
      customer.id_number,
      customer.registration_no,
      customer.tin,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      value: customer.id,
      label: `${getCustomerDisplayName(customer)} · ${customer.phone || customer.id_number || customer.customer_no}`,
      keywords: [searchText],
    };
  });

  function openNewCustomerDialog() {
    if (mode !== 'new') form.setValue('customer_id', '');
    form.setValue('policyholder_mode', 'new');
    setIsNewCustomerDialogOpen(true);
  }

  function closeNewCustomerDialog() {
    setIsNewCustomerDialogOpen(false);
    form.setValue('policyholder_mode', 'existing');
  }

  async function confirmNewCustomerDetails() {
    const valid = await form.trigger('policyholder', { shouldFocus: true });
    if (valid) setIsNewCustomerDialogOpen(false);
  }

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
      <StepSection title="Policyholder" first>
        <div className="flex gap-2">
          {[
            { value: 'existing' as const, label: 'Existing Customer' },
            { value: 'new' as const, label: 'New Customer' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (option.value === 'new' && newCustomerInDialog) {
                  openNewCustomerDialog();
                  return;
                }
                form.setValue('policyholder_mode', option.value);
                setIsNewCustomerDialogOpen(false);
              }}
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
                <FormLabel required>Existing Customer</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={customerSearchOptions}
                    placeholder="Search or select a customer"
                    searchPlaceholder="Name, phone, email, customer no, ID, registration, TIN"
                    emptyText="No matching customer found."
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        ) : newCustomerInDialog ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {form.watch('policyholder.full_name') || 'New policyholder'}
              </p>
              <p className="text-xs text-slate-500">
                {form.watch('policyholder.phone') ||
                  'Add the policyholder details to continue.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewCustomerDialogOpen(true)}
            >
              {form.watch('policyholder.full_name')
                ? 'Edit details'
                : 'Enter details'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Fill in the policyholder details below. A new customer record will
            be created when you save this quotation.
          </p>
        )}

        {mode === 'existing' && selectedCustomer && (
          <ExistingCustomerCard
            customer={selectedCustomer}
            onChangeCustomer={() => form.setValue('customer_id', '')}
            onEditDetails={() => {
              form.setValue(
                'policyholder',
                getCustomerDefaultValues(selectedCustomer),
              );
              form.setValue('policyholder_mode', 'new');
              if (newCustomerInDialog) setIsNewCustomerDialogOpen(true);
            }}
          />
        )}
      </StepSection>

      {mode === 'new' && (
        <PolicyholderDetailsContainer
          enabled={newCustomerInDialog}
          open={isNewCustomerDialogOpen}
          onOpenChange={(open) => {
            setIsNewCustomerDialogOpen(open);
            if (!open) form.setValue('policyholder_mode', 'existing');
          }}
          onConfirm={() => void confirmNewCustomerDetails()}
          onCancel={closeNewCustomerDialog}
        >
          <StepSection
            title="New Policyholder Details"
            contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="mb-2 block">Customer Type</Label>
              <div className="flex gap-2">
                {[
                  { value: 'INDIVIDUAL' as const, label: 'Individual' },
                  { value: 'CORPORATE' as const, label: 'Corporate' },
                ].map((option) => (
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

            <FormField
              control={form.control}
              name={fieldName('full_name')}
              render={({ field }) => (
                <WizardFormItem className="sm:col-span-2 lg:col-span-2">
                  <FormLabel required>Full Name</FormLabel>
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
              )}
            />

            <FormField
              control={form.control}
              name={fieldName('date_of_birth')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel required>
                    Date of Birth / Incorporation Date
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      max={today}
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />

            {customerType === 'INDIVIDUAL' && (
              <FormField
                control={form.control}
                name={fieldName('gender')}
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel required>Gender</FormLabel>
                    <Select
                      value={toSelectValue(field.value as string)}
                      onValueChange={(value) =>
                        field.onChange(fromSelectValue(value))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </WizardFormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name={fieldName('id_type')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel required>Identification Type</FormLabel>
                  <Select
                    value={
                      field.value ? String(field.value) : SELECT_NONE_VALUE
                    }
                    onValueChange={(value) => {
                      field.onChange(
                        value === SELECT_NONE_VALUE ? '' : Number(value),
                      );
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {idFieldOptions.map((option) => (
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
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name={fieldName('id_number')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel required>Identification Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name={fieldName('phone')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel required>Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
            <FormField
              control={form.control}
              name={fieldName('email')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
            <FormField
              control={form.control}
              name={fieldName('fax')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Fax (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value as string} />
                  </FormControl>
                </WizardFormItem>
              )}
            />

            <div className="sm:col-span-2 lg:col-span-3">
              <LocationReferenceSelects
                required
                country={policyholderCountry}
                countryCode={policyholderCountryCode}
                region={policyholderRegion}
                district={policyholderDistrict}
                errors={{
                  country: form.formState.errors.policyholder?.country?.message,
                  region: form.formState.errors.policyholder?.region?.message,
                  district:
                    form.formState.errors.policyholder?.district?.message,
                }}
                onCountryChange={(country, code) => {
                  form.setValue('policyholder.country', country, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  form.setValue('policyholder.country_code', code, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                onRegionChange={(region) =>
                  form.setValue('policyholder.region', region, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onDistrictChange={(district) =>
                  form.setValue('policyholder.district', district, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <FormField
              control={form.control}
              name={fieldName('street')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Street (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value as string} />
                  </FormControl>
                </WizardFormItem>
              )}
            />
            <FormField
              control={form.control}
              name={fieldName('postal_address')}
              render={({ field }) => (
                <WizardFormItem className="sm:col-span-2 lg:col-span-2">
                  <FormLabel>Postal Address</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
          </StepSection>
        </PolicyholderDetailsContainer>
      )}
    </>
  );
}
