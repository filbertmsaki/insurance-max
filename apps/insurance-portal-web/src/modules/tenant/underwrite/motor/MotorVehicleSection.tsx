import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFormState, useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeftRight,
  Car,
  CheckCircle2,
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

/**
 * Vehicle for a single-vehicle Motor quotation: one search over the company
 * register (registration or chassis), TIRA lookup or manual entry, then a
 * compact card that only asks for the details still missing.
 */
export function MotorVehicleSection({
  form,
  customer,
  verifyMotor = verificationsApi.motor,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  /** The selected existing customer, used for owner defaults. */
  customer?: CustomerRecord | null;
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
        shouldValidate: true,
      }),
    );
  }, [form, hasVehicle, ownerDefaultsKey, revision, source]);

  function fill(next: Motor, nextSource: VehicleSource) {
    const withOwner = ownerDefaults
      ? { ...next, ...applyOwnerDefaults(next, ownerDefaults, null) }
      : next;
    appliedOwnerDefaults.current = ownerDefaults;
    form.setValue('motor', withOwner, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('motor_mode', nextSource === 'register' ? 'existing' : 'new');
    setSource(nextSource);
    const missingFields = missingMotorFieldKeys(withOwner);
    setDetailsDialogOpen(
      nextSource === 'manual' || missingFields.length > 0,
    );
    setRevealed(
      nextSource === 'manual' ? [] : missingFields,
    );
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
    motor.registration_no && motor.chassis_no
      ? `Chassis ${motor.chassis_no}`
      : null,
    motor.manufacture_year,
    getMotorTypeLabelFromCode(motor.motor_type_code) || null,
    getVehicleCategoryLabelFromCode(motor.motor_category_code) || null,
  ].filter(Boolean);

  return (
    <StepSection first>
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
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <Car className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[...facts, source ? SOURCE_LABELS[source] : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-haspopup="dialog"
                aria-expanded={detailsDialogOpen}
                onClick={() => setDetailsDialogOpen(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit details
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={changeVehicle}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Change
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

          <div className="border-t border-slate-100 p-4">
            {visibleKeys.length > 0 ? (
              <>
                <p className="mb-3 text-sm font-medium text-amber-700">
                  Some vehicle details are missing. Select Edit details to
                  complete them.
                </p>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                All vehicle details are complete.
              </p>
            )}
          </div>
        </div>
      )}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {source === 'manual' ? 'Enter vehicle details' : 'Edit vehicle details'}
            </DialogTitle>
            <DialogDescription>
              Review and complete the vehicle information for this quotation.
            </DialogDescription>
          </DialogHeader>
          <VehicleDetailsFields
            key={revision}
            form={form}
            title={null}
          />
          <DialogFooter>
            <Button type="button" onClick={() => setDetailsDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StepSection>
  );
}
