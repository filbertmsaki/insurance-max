import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFormState, useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeftRight,
  CalendarDays,
  Car,
  ChevronDown,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import { motorApi } from '@/modules/tenant/motor/api';
import {
  verificationsApi,
  type MotorVerificationRequest,
  type VerificationResult,
} from '@/modules/tenant/verifications/api';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { VehicleDetailsFields } from '@/modules/tenant/quotations/wizard/components/VehicleDetailsFields';
import { VehicleSearchField } from '@/modules/tenant/quotations/wizard/components/VehicleSearchField';
import { mergeVerifiedMotor } from '@/modules/tenant/quotations/wizard/utils/motorFields';
import {
  getMotorTypeLabelFromCode,
  getMotorUsageLabelFromCode,
  getOwnerCategoryLabelFromCode,
  getVehicleCategoryLabelFromCode,
} from '@/modules/tenant/quotations/wizard/utils/motorOptions';
import {
  applyOwnerDefaults,
  lookupVehicleWithTira,
  missingMotorFieldKeys,
  ownerDefaultsFromPolicyholder,
  vehicleRecordToMotorDetails,
  type VehicleOwnerDefaults,
} from '@/modules/tenant/quotations/wizard/utils/motorVehicleSelection';

type Motor = QuotationFormSchemaValues['motor'];
type VehicleSource = 'register' | 'tira' | 'manual' | 'saved';

const SOURCE_LABELS: Record<VehicleSource, string> = {
  register: 'From the vehicle register',
  tira: 'Verified with TIRA',
  manual: 'Entered manually',
  saved: 'Saved on this quotation',
};

/** Registration plates are short; longer identifiers are chassis numbers. */
const MAX_REGISTRATION_LENGTH = 10;
const VEHICLE_SEARCH_ID = 'motor-vehicle-search';

function VehicleQuickFact({
  icon: Icon,
  children,
}: {
  icon: typeof Car;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{children}</span>
    </span>
  );
}

type VehicleDetail = [label: string, value?: string | number | null];

function VehicleDetailGroup({
  title,
  items,
}: {
  title: string;
  items: VehicleDetail[];
}) {
  const visible = items.filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
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

/**
 * Vehicle for a single-vehicle Motor quotation: one search over the company
 * register (registration or chassis), TIRA lookup or manual entry, then a
 * compact card that only asks for the details still missing.
 */
export function MotorVehicleSection({
  form,
  customer,
  compactOnMobile = false,
  verifyMotor = verificationsApi.motor,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  /** The selected existing customer, used for owner defaults. */
  customer?: CustomerRecord | null;
  compactOnMobile?: boolean;
  verifyMotor?: (data: MotorVerificationRequest) => Promise<VerificationResult>;
}) {
  const queryClient = useQueryClient();
  const motor = useWatch({ control: form.control, name: 'motor' });
  const customerId = useWatch({ control: form.control, name: 'customer_id' });
  const policyholderMode = useWatch({
    control: form.control,
    name: 'policyholder_mode',
  });
  const policyholder = useWatch({
    control: form.control,
    name: 'policyholder',
  });
  const { errors } = useFormState({ control: form.control, name: 'motor' });
  const hasMotorErrors = Boolean(errors.motor);

  useEffect(() => {
    if (hasMotorErrors) void form.trigger('motor');
  }, [form, hasMotorErrors, motor]);

  const hasVehicle = Boolean(motor.registration_no || motor.chassis_no);
  const [source, setSource] = useState<VehicleSource | null>(
    hasVehicle ? (motor.vehicle_id ? 'register' : 'saved') : null,
  );
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [vehicleDetailsSubmitted, setVehicleDetailsSubmitted] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [revealed, setRevealed] = useState<Array<keyof Motor>>(() =>
    hasVehicle ? missingMotorFieldKeys(motor) : [],
  );
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<'register' | 'tira' | null>(null);
  const [lookupMessage, setLookupMessage] = useState<{
    text: string;
    search: string;
  } | null>(null);
  const [registerOwner, setRegisterOwner] = useState<{
    customerId: string;
    name: string;
  } | null>(null);

  const ownerDefaults = ownerDefaultsFromPolicyholder(
    { policyholder_mode: policyholderMode, policyholder },
    customer,
  );
  const ownerDefaultsKey = JSON.stringify(ownerDefaults);
  const appliedOwnerDefaults = useRef<VehicleOwnerDefaults | null>(null);

  // Keep owner details in step with the policyholder without overwriting
  // anything the user (or TIRA) entered.
  useEffect(() => {
    if (!hasVehicle && source !== 'manual') return;
    const defaults = JSON.parse(
      ownerDefaultsKey,
    ) as VehicleOwnerDefaults | null;
    if (!defaults) return;
    const updates = applyOwnerDefaults(
      form.getValues('motor'),
      defaults,
      appliedOwnerDefaults.current,
    );
    appliedOwnerDefaults.current = defaults;
    (Object.keys(updates) as Array<keyof VehicleOwnerDefaults>).forEach((key) =>
      form.setValue(`motor.${key}`, updates[key] as Motor[typeof key], {
        shouldDirty: true,
        shouldValidate: source !== 'manual',
      }),
    );
  }, [form, hasVehicle, ownerDefaultsKey, revision, source]);

  function fill(next: Motor, nextSource: VehicleSource) {
    const withOwner = ownerDefaults
      ? {
          ...next,
          ...applyOwnerDefaults(next, ownerDefaults, null),
          ...(nextSource === 'manual' ? ownerDefaults : {}),
        }
      : next;
    appliedOwnerDefaults.current = ownerDefaults;
    form.setValue('motor', withOwner, {
      shouldDirty: true,
      // Manual entry starts with intentionally blank fields. Validate after
      // the user clicks Done, not while opening the editor.
      shouldValidate: nextSource !== 'manual',
    });
    if (nextSource === 'manual') {
      form.clearErrors('motor');
      setVehicleDetailsSubmitted(false);
    }
    form.setValue('motor_mode', nextSource === 'register' ? 'existing' : 'new');
    setSource(nextSource);
    const missingFields = missingMotorFieldKeys(withOwner);
    setDetailsDialogOpen(nextSource === 'manual' || missingFields.length > 0);
    setRevealed(nextSource === 'manual' ? [] : missingFields);
    setLookupMessage(null);
    setRevision((value) => value + 1);
  }

  async function selectRegisterVehicle(vehicleId: string) {
    setBusy('register');
    setLookupMessage(null);
    try {
      const vehicle = await queryClient.fetchQuery({
        queryKey: ['motor', 'vehicles', 'detail', vehicleId],
        queryFn: () => motorApi.getVehicle(vehicleId),
        staleTime: 30_000,
      });
      fill(
        {
          ...createEmptyMotorDetails(),
          ...vehicleRecordToMotorDetails(vehicle),
        },
        'register',
      );
      setRegisterOwner(
        vehicle.customer_id
          ? {
              customerId: vehicle.customer_id,
              name: vehicle.customer
                ? getCustomerDisplayName(vehicle.customer)
                : 'another customer',
            }
          : null,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function lookUpWithTira(search: string) {
    setBusy('tira');
    setLookupMessage(null);
    try {
      const result = await lookupVehicleWithTira(search, verifyMotor);
      if (result.status === 'found') {
        fill(
          mergeVerifiedMotor(
            form.getValues('motor'),
            result.details,
            createEmptyMotorDetails(),
          ),
          'tira',
        );
        setRegisterOwner(null);
      } else {
        setLookupMessage({
          search,
          text:
            result.status === 'pending'
              ? 'TIRA is still processing this lookup. Try again shortly.'
              : result.status === 'not-found'
                ? `TIRA has no vehicle with "${search}".`
                : result.message,
        });
      }
    } catch (error) {
      setLookupMessage({ search, text: getApiErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  function enterManually(search: string) {
    const value = search.replace(/\s+/g, '').toUpperCase();
    fill(
      {
        ...createEmptyMotorDetails(),
        ...(value
          ? value.length > MAX_REGISTRATION_LENGTH
            ? { chassis_no: value }
            : { registration_no: value }
          : {}),
      },
      'manual',
    );
    setRegisterOwner(null);
  }

  async function finishVehicleDetails() {
    setVehicleDetailsSubmitted(true);
    const valid = await form.trigger('motor', { shouldFocus: true });
    if (valid) setDetailsDialogOpen(false);
  }

  function changeVehicle() {
    form.setValue('motor', createEmptyMotorDetails(), { shouldDirty: true });
    form.setValue('motor_mode', 'new');
    appliedOwnerDefaults.current = null;
    setSource(null);
    setDetailsDialogOpen(false);
    setRevealed([]);
    setRegisterOwner(null);
    setLookupMessage(null);
    setRevision((value) => value + 1);
  }

  const missingNow =
    hasVehicle || source === 'manual' ? missingMotorFieldKeys(motor) : [];
  const visibleKeys = [...new Set([...revealed, ...missingNow])];
  const transferFrom =
    registerOwner && registerOwner.customerId !== customerId
      ? registerOwner
      : null;
  const showSearch = !hasVehicle && source !== 'manual';
  const title = [
    motor.registration_no || motor.chassis_no || 'New vehicle',
    [motor.make, motor.model].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' — ');
  const facts = [
    motor.registration_no ? `Registration ${motor.registration_no}` : null,
    motor.chassis_no ? `Chassis ${motor.chassis_no}` : null,
    [motor.make, motor.model].filter(Boolean).join(' '),
  ].filter((value): value is string => Boolean(value));

  return (
    <StepSection
      first
      className="flex h-full min-w-0 flex-col"
      contentClassName="flex flex-1 flex-col"
    >
      {showSearch ? (
        <div className="space-y-2">
          <Label htmlFor={VEHICLE_SEARCH_ID} required>
            Vehicle
          </Label>
          <VehicleSearchField
            id={VEHICLE_SEARCH_ID}
            customerId={customerId || undefined}
            onSelect={(vehicleId) => void selectRegisterVehicle(vehicleId)}
            onTiraLookup={(search) => void lookUpWithTira(search)}
            onEnterManually={enterManually}
            invalid={Boolean(errors.motor)}
          />
          <p className="text-xs text-slate-500">
            Not in your register? Search TIRA by registration or chassis number,
            or enter the details manually.
          </p>
          {busy && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy === 'tira'
                ? 'Looking up the vehicle with TIRA…'
                : 'Loading vehicle…'}
            </p>
          )}
          {lookupMessage && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {lookupMessage.text}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => enterManually(lookupMessage.search)}
              >
                Enter details manually
              </Button>
            </div>
          )}
          {errors.motor && !busy && !lookupMessage && (
            <p className="text-sm text-red-600">
              Find the vehicle or enter its details.
            </p>
          )}
        </div>
      ) : (
        <div
          role="group"
          aria-label="Selected vehicle"
          className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            className={[
              'flex items-start gap-3 p-4',
              compactOnMobile && 'gap-2 p-3 sm:gap-3 sm:p-4',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div
              className={[
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700',
                compactOnMobile && 'h-9 w-9 sm:h-11 sm:w-11',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Car className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={[
                  'break-words font-semibold text-slate-900',
                  compactOnMobile ? 'text-sm sm:text-base' : 'text-base',
                ].join(' ')}
              >
                {compactOnMobile && (
                  <span className="sm:hidden">
                    {motor.registration_no || motor.chassis_no || 'New vehicle'}
                  </span>
                )}
                <span
                  className={compactOnMobile ? 'hidden sm:inline' : undefined}
                >
                  {title}
                </span>
              </p>
              {compactOnMobile && (
                <p className="mt-0.5 break-words text-xs text-slate-500 sm:hidden">
                  {[motor.make, motor.model].filter(Boolean).join(' ')}
                </p>
              )}
              <p
                className={[
                  'mt-0.5 break-words text-xs text-slate-500',
                  compactOnMobile ? 'hidden sm:block' : '',
                ].join(' ')}
              >
                {[...facts, source ? SOURCE_LABELS[source] : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Edit vehicle details"
                title="Edit vehicle details"
                className={
                  compactOnMobile
                    ? 'h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3'
                    : undefined
                }
                aria-haspopup="dialog"
                aria-expanded={detailsDialogOpen}
                onClick={() => setDetailsDialogOpen(true)}
              >
                <Pencil
                  aria-hidden="true"
                  className="h-4 w-4 sm:h-3.5 sm:w-3.5"
                />
                <span
                  className={
                    compactOnMobile ? 'sr-only sm:not-sr-only' : undefined
                  }
                >
                  Edit details
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Change vehicle"
                title="Change vehicle"
                className={
                  compactOnMobile
                    ? 'h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-3'
                    : undefined
                }
                onClick={changeVehicle}
              >
                <RefreshCw
                  aria-hidden="true"
                  className="h-4 w-4 sm:h-3.5 sm:w-3.5"
                />
                <span
                  className={
                    compactOnMobile ? 'sr-only sm:not-sr-only' : undefined
                  }
                >
                  Change
                </span>
              </Button>
            </div>
          </div>

          {transferFrom && (
            <div
              role="status"
              className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800"
            >
              <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Registered under {transferFrom.name}. Completing this quotation
                moves the vehicle to this policyholder; the ownership history is
                kept.
              </span>
            </div>
          )}

          <div
            className={[
              'grid flex-1 content-start gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2',
              compactOnMobile &&
                'gap-x-3 gap-y-1 px-3 py-2 sm:gap-x-6 sm:gap-y-2 sm:px-4 sm:py-3',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {motor.manufacture_year && (
              <VehicleQuickFact icon={CalendarDays}>
                {motor.manufacture_year}
              </VehicleQuickFact>
            )}
            {getMotorTypeLabelFromCode(motor.motor_type_code) && (
              <VehicleQuickFact icon={Car}>
                {getMotorTypeLabelFromCode(motor.motor_type_code)}
              </VehicleQuickFact>
            )}
            {getVehicleCategoryLabelFromCode(motor.motor_category_code) && (
              <VehicleQuickFact icon={Car}>
                {getVehicleCategoryLabelFromCode(motor.motor_category_code)}
              </VehicleQuickFact>
            )}
          </div>

          {visibleKeys.length > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800"
            >
              <span>Some vehicle details are missing.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDetailsDialogOpen(true)}
              >
                Complete details
              </Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-4 py-2">
            <button
              type="button"
              onClick={() => setShowVehicleDetails((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              aria-expanded={showVehicleDetails}
            >
              {showVehicleDetails ? 'Hide details' : 'Show details'}
              <ChevronDown
                className={[
                  'h-3.5 w-3.5 transition-transform',
                  showVehicleDetails ? 'rotate-180' : '',
                ].join(' ')}
              />
            </button>
          </div>

          {showVehicleDetails && (
            <div className="grid gap-5 border-t border-slate-100 p-4 sm:grid-cols-2">
              <VehicleDetailGroup
                title="Vehicle"
                items={[
                  ['Registration number', motor.registration_no],
                  ['Source', source ? SOURCE_LABELS[source] : null],
                  ['Chassis number', motor.chassis_no],
                  ['Engine number', motor.engine_no],
                  ['Make', motor.make],
                  ['Model', motor.model],
                  ['Model number', motor.model_no],
                  [
                    'Category',
                    getVehicleCategoryLabelFromCode(motor.motor_category_code),
                  ],
                  [
                    'Motor type',
                    getMotorTypeLabelFromCode(motor.motor_type_code),
                  ],
                  ['Body type', motor.body_type],
                  ['Color', motor.color],
                  ['Manufacture year', motor.manufacture_year],
                  ['Fuel type', motor.fuel_type],
                ]}
              />
              <VehicleDetailGroup
                title="Specifications and owner"
                items={[
                  [
                    'Usage',
                    getMotorUsageLabelFromCode(motor.motor_usage_code) ||
                      motor.usage_type,
                  ],
                  ['Sitting capacity', motor.seating_capacity],
                  ['Number of axles', motor.number_of_axles],
                  ['Axle distance', motor.axle_distance],
                  ['Tonnage', motor.tonnage],
                  ['Cubic capacity', motor.cubic_capacity],
                  ['Tare weight', motor.tare_weight],
                  ['Gross weight', motor.gross_weight],
                  ['Owner name', motor.owner_name],
                  [
                    'Owner category',
                    getOwnerCategoryLabelFromCode(motor.owner_category),
                  ],
                  ['Owner address', motor.owner_address],
                  ['Vehicle value', motor.vehicle_value],
                ]}
              />
            </div>
          )}
        </div>
      )}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {source === 'manual'
                ? 'Enter vehicle details'
                : 'Edit vehicle details'}
            </DialogTitle>
            <DialogDescription>
              Registration, chassis and specifications of the insured vehicle.
            </DialogDescription>
          </DialogHeader>
          <VehicleDetailsFields
            key={revision}
            form={form}
            title={null}
            showErrorMessages={source !== 'manual' || vehicleDetailsSubmitted}
          />
          <DialogFooter>
            <Button type="button" onClick={() => void finishVehicleDetails()}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StepSection>
  );
}
