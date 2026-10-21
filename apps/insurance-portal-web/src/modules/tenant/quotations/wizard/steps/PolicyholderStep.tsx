import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  UserCircle2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { hasPermission } from '@/lib/auth/permissions';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateCustomer,
  useCustomer,
} from '@/modules/tenant/customers/hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
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
import { LocationReferenceSelects } from '@/modules/platform/reference-data/components/LocationReferenceSelects';
import { CustomerSearchField } from '../components/CustomerSearchField';
import {
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import { StepSection } from '../components/StepSection';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  /** Customers already loaded by the caller; others are fetched by ID. */
  customerOptions: CustomerRecord[];
  newCustomerInDialog?: boolean;
  hideSectionTitle?: boolean;
  hideNewCustomerButton?: boolean;
  /** Compact selected-customer rows and actions in the Motor mobile wizard. */
  compactOnMobile?: boolean;
}

const CREATE_CUSTOMER_PERMISSION = 'customers:create';

/** Carries what was typed in the search into the new-customer form. */
function prefillPolicyholderFromSearch(
  values: QuotationFormSchemaValues['policyholder'],
  search: string,
): QuotationFormSchemaValues['policyholder'] {
  const term = search.trim();
  if (!term) return values;
  const digits = term.replace(/[\s()+.-]/g, '');
  if (/^\d{9,12}$/.test(digits)) return { ...values, phone: term };
  if (/^\d{13,}$/.test(digits)) return { ...values, id_number: term };
  if (/[a-z]/i.test(term) && !/\d/.test(term)) {
    return { ...values, full_name: term };
  }
  return values;
}

/** Policyholder facts TIRA needs that an older customer record may lack. */
// eslint-disable-next-line react-refresh/only-export-components
export function missingPolicyholderDetails(customer: CustomerRecord): string[] {
  const missing: Array<[boolean, string]> = [
    [!getCustomerDisplayName(customer), 'name'],
    [!customer.date_of_birth, 'date of birth'],
    [!customer.id_type || !customer.id_number, 'ID number'],
    [!customer.phone, 'phone number'],
    [!customer.region, 'region'],
    [!customer.district, 'district'],
    [customer.customer_type !== 'CORPORATE' && !customer.gender, 'gender'],
  ];
  return missing.filter(([isMissing]) => isMissing).map(([, label]) => label);
}

function PolicyholderDetailsContainer({
  enabled,
  open,
  confirmLabel,
  confirming,
  onOpenChange,
  onConfirm,
  onCancel,
  children,
}: {
  enabled: boolean;
  open: boolean;
  confirmLabel: string;
  confirming: boolean;
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
          <Button type="button" onClick={onConfirm} disabled={confirming}>
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
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
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-slate-900">
              {value}
            </dd>
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
  compactOnMobile = false,
}: {
  customer: CustomerRecord;
  onChangeCustomer: () => void;
  onEditDetails: () => void;
  compactOnMobile?: boolean;
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
  const missing = missingPolicyholderDetails(customer);
  return (
    <div
      role="group"
      aria-label="Selected customer"
      className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div
        className={cn(
          'flex flex-wrap items-start gap-3 p-4',
          compactOnMobile &&
            'flex-nowrap gap-2 p-3 sm:flex-wrap sm:gap-3 sm:p-4',
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700',
            compactOnMobile && 'h-9 w-9 sm:h-11 sm:w-11',
          )}
        >
          {isCorporate ? (
            <Building2 className="h-5 w-5" />
          ) : (
            getInitials(displayName) || <UserCircle2 className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'min-w-0 break-words font-semibold text-slate-900',
                compactOnMobile && 'text-sm sm:text-base',
              )}
            >
              {displayName}
            </p>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {customer.customer_no} · {isCorporate ? 'Corporate' : 'Individual'}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Edit customer details"
            title="Edit customer details"
            className={
              compactOnMobile
                ? 'h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3'
                : undefined
            }
            onClick={onEditDetails}
          >
            <Pencil
              aria-hidden="true"
              className={
                compactOnMobile ? 'h-4 w-4 sm:h-3.5 sm:w-3.5' : 'h-3.5 w-3.5'
              }
            />
            <span
              className={compactOnMobile ? 'sr-only sm:not-sr-only' : undefined}
            >
              Edit
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Change customer"
            title="Change customer"
            className={
              compactOnMobile
                ? 'h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3'
                : undefined
            }
            onClick={onChangeCustomer}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                compactOnMobile ? 'h-4 w-4 sm:h-3.5 sm:w-3.5' : 'h-3.5 w-3.5'
              }
            />
            <span
              className={compactOnMobile ? 'sr-only sm:not-sr-only' : undefined}
            >
              Change
            </span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid flex-1 content-start gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2',
          compactOnMobile &&
            'gap-x-3 gap-y-1 px-3 py-2 sm:gap-x-6 sm:gap-y-2 sm:px-4 sm:py-3',
        )}
      >
        {customer.phone && <QuickFact icon={Phone}>{customer.phone}</QuickFact>}
        {customer.email && (
          <span
            className={compactOnMobile ? 'hidden min-w-0 sm:flex' : 'min-w-0'}
          >
            <QuickFact icon={Mail}>{customer.email}</QuickFact>
          </span>
        )}
        {customer.id_number && (
          <span
            className={compactOnMobile ? 'hidden min-w-0 sm:flex' : 'min-w-0'}
          >
            <QuickFact icon={CreditCard}>
              {idTypeLabel ? `${idTypeLabel}: ` : ''}
              {customer.id_number}
            </QuickFact>
          </span>
        )}
        {location && <QuickFact icon={MapPin}>{location}</QuickFact>}
      </div>

      {missing.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Missing for TIRA: {missing.join(', ')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditDetails}
          >
            Complete details
          </Button>
        </div>
      )}

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
          {compactOnMobile && (
            <div className="sm:hidden">
              <DetailGroup
                title="Customer"
                items={[
                  ['Email', customer.email],
                  ['ID type', idTypeLabel],
                  ['ID number', customer.id_number],
                ]}
              />
            </div>
          )}
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
  hideSectionTitle = false,
  hideNewCustomerButton = false,
  compactOnMobile = false,
}: Props) {
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  // 'create' adds a customer; 'edit' adjusts a selected customer's details
  // for this quotation only (the customer record itself is not changed).
  const [dialogPurpose, setDialogPurpose] = useState<'create' | 'edit'>(
    'create',
  );
  const previousCustomerIdRef = useRef('');
  const currentUser = useAuthStore((state) => state.user);
  const canCreateCustomer = hasPermission(
    currentUser,
    CREATE_CUSTOMER_PERMISSION,
  );
  const createCustomer = useCreateCustomer();
  const mode = form.watch('policyholder_mode');
  const customerId = form.watch('customer_id');
  const policyholderValues = useWatch({
    control: form.control,
    name: 'policyholder',
  });
  const hasPolicyholderErrors = Boolean(form.formState.errors.policyholder);
  const listedCustomer = customerOptions.find((c) => c.id === customerId);
  const customerQuery = useCustomer(
    mode === 'existing' && customerId && !listedCustomer
      ? customerId
      : undefined,
  );
  const selectedCustomer =
    listedCustomer ??
    (customerQuery.data?.id === customerId ? customerQuery.data : undefined);
  // With customers:create a new customer is saved and selected straight
  // away; otherwise its details stay on the quotation and the customer is
  // created when the quotation is completed (the previous behaviour).
  const savesCustomerImmediately =
    dialogPurpose === 'create' && canCreateCustomer;
  const detailsInDialog = newCustomerInDialog || savesCustomerImmediately;
  const today = new Date().toISOString().slice(0, 10);

  const customerType = form.watch('policyholder.customer_type');
  const currentIdType = form.watch('policyholder.id_type');
  const policyholderCountry = form.watch('policyholder.country');
  const policyholderCountryCode = form.watch('policyholder.country_code');
  const policyholderRegion = form.watch('policyholder.region');
  const policyholderDistrict = form.watch('policyholder.district');
  useEffect(() => {
    if (mode === 'new' && hasPolicyholderErrors) {
      void form.trigger('policyholder');
    }
  }, [form, hasPolicyholderErrors, mode, policyholderValues]);
  const idFieldOptions = CUSTOMER_ID_TYPE_OPTIONS.filter(
    (option) =>
      option.appliesTo === 'BOTH' || option.appliesTo === customerType,
  );
  function openNewCustomerDialog(search = '') {
    if (mode !== 'new' || dialogPurpose === 'edit') {
      form.setValue(
        'policyholder',
        prefillPolicyholderFromSearch(getCustomerDefaultValues(), search),
      );
    }
    previousCustomerIdRef.current =
      mode === 'existing' ? form.getValues('customer_id') : '';
    setDialogPurpose('create');
    form.setValue('customer_id', '');
    form.setValue('policyholder_mode', 'new');
    setIsNewCustomerDialogOpen(true);
  }

  function switchToExistingCustomer() {
    setIsNewCustomerDialogOpen(false);
    form.setValue('policyholder_mode', 'existing');
    if (dialogPurpose === 'create' && previousCustomerIdRef.current) {
      form.setValue('customer_id', previousCustomerIdRef.current);
    }
  }

  async function confirmNewCustomerDetails() {
    const valid = await form.trigger('policyholder', { shouldFocus: true });
    if (!valid) return;
    if (!savesCustomerImmediately) {
      setIsNewCustomerDialogOpen(false);
      return;
    }
    try {
      const created = await createCustomer.mutateAsync(
        form.getValues('policyholder'),
      );
      form.setValue('customer_id', created.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('policyholder_mode', 'existing', { shouldDirty: true });
      form.setValue('policyholder', getCustomerDefaultValues());
      setIsNewCustomerDialogOpen(false);
    } catch {
      // The mutation already reported the error (e.g. a possible duplicate);
      // keep the details open so they can be corrected.
    }
  }

  function handleCustomerTypeChange(nextType: 'INDIVIDUAL' | 'CORPORATE') {
    form.setValue('policyholder.customer_type', nextType);

    const idTypeStillValid = CUSTOMER_ID_TYPE_OPTIONS.some(
      (option) =>
        option.value === currentIdType &&
        (option.appliesTo === 'BOTH' || option.appliesTo === nextType),
    );

    if (!idTypeStillValid) {
      form.setValue('policyholder.id_type', nextType === 'CORPORATE' ? 7 : 1);
    }

    if (nextType === 'CORPORATE') {
      form.setValue('policyholder.gender', '');
    }
  }

  return (
    <>
      <StepSection
        title={hideSectionTitle ? undefined : 'Policyholder'}
        first
        className="flex h-full min-w-0 flex-col"
        contentClassName="flex flex-1 flex-col"
      >
        {mode === 'existing' ? (
          <FormField
            control={form.control}
            name="customer_id"
            render={({ field, fieldState }) => (
              <WizardFormItem className={selectedCustomer ? 'hidden' : undefined}>
                <FormLabel required>Customer</FormLabel>
                <div
                  className={
                    hideNewCustomerButton
                      ? 'w-full'
                      : 'flex flex-col gap-2 sm:flex-row'
                  }
                >
                  <div className="min-w-0 flex-1">
                    <FormControl>
                      <CustomerSearchField
                        value={field.value}
                        selectedLabel={
                          selectedCustomer
                            ? getCustomerDisplayName(selectedCustomer)
                            : undefined
                        }
                        onSelect={(value) => {
                          field.onChange(value);
                          if (fieldState.error)
                            void form.trigger('customer_id');
                        }}
                        onCreateNew={openNewCustomerDialog}
                        invalid={Boolean(fieldState.error)}
                        triggerRef={field.ref}
                      />
                    </FormControl>
                  </div>
                  {!hideNewCustomerButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openNewCustomerDialog()}
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      New customer
                    </Button>
                  )}
                </div>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        ) : (
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3',
              compactOnMobile && 'flex-nowrap gap-2 sm:flex-wrap sm:gap-3',
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {form.watch('policyholder.full_name') || 'New policyholder'}
              </p>
              <p className="text-xs text-slate-500">
                {detailsInDialog
                  ? form.watch('policyholder.phone') ||
                    'Add the policyholder details to continue.'
                  : 'Fill in the policyholder details below. A new customer record will be created when you save this quotation.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Use an existing customer"
                title="Use an existing customer"
                className={
                  compactOnMobile
                    ? 'h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3'
                    : undefined
                }
                onClick={switchToExistingCustomer}
              >
                {compactOnMobile && (
                  <RefreshCw aria-hidden="true" className="h-4 w-4 sm:hidden" />
                )}
                <span
                  className={
                    compactOnMobile ? 'sr-only sm:not-sr-only' : undefined
                  }
                >
                  Use an existing customer
                </span>
              </Button>
              {detailsInDialog && (
                <Button
                  type="button"
                  variant="outline"
                  aria-label={
                    form.watch('policyholder.full_name')
                      ? 'Edit customer details'
                      : 'Enter customer details'
                  }
                  title={
                    form.watch('policyholder.full_name')
                      ? 'Edit customer details'
                      : 'Enter customer details'
                  }
                  className={
                    compactOnMobile
                      ? 'h-11 w-11 px-0 sm:h-[38px] sm:w-auto sm:px-4'
                      : undefined
                  }
                  onClick={() => setIsNewCustomerDialogOpen(true)}
                >
                  {compactOnMobile && (
                    <Pencil aria-hidden="true" className="h-4 w-4 sm:hidden" />
                  )}
                  <span
                    className={
                      compactOnMobile ? 'sr-only sm:not-sr-only' : undefined
                    }
                  >
                    {form.watch('policyholder.full_name')
                      ? 'Edit details'
                      : 'Enter details'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === 'existing' &&
          customerId &&
          !selectedCustomer &&
          (customerQuery.isError ? (
            <p role="alert" className="text-sm text-red-600">
              This customer could not be loaded.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => void customerQuery.refetch()}
              >
                Retry
              </button>
            </p>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading customer…
            </p>
          ))}

        {mode === 'existing' && selectedCustomer && (
          <ExistingCustomerCard
            customer={selectedCustomer}
            compactOnMobile
            onChangeCustomer={() => form.setValue('customer_id', '')}
            onEditDetails={() => {
              setDialogPurpose('edit');
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
          enabled={detailsInDialog}
          open={isNewCustomerDialogOpen}
          confirmLabel={
            savesCustomerImmediately ? 'Save customer' : 'Use these details'
          }
          confirming={createCustomer.isPending}
          onOpenChange={(open) => {
            if (open) setIsNewCustomerDialogOpen(true);
            else switchToExistingCustomer();
          }}
          onConfirm={() => void confirmNewCustomerDetails()}
          onCancel={switchToExistingCustomer}
        >
          <StepSection
            title={
              dialogPurpose === 'edit'
                ? 'Policyholder details for this quotation'
                : 'New customer'
            }
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
