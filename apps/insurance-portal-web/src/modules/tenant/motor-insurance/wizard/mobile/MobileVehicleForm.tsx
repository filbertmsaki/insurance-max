import { useEffect, useState } from 'react';
import {
  useFormState,
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import { VehicleDetailsFields } from '@/modules/tenant/quotations/wizard/components/VehicleDetailsFields';
import {
  motorFieldError,
  motorFields,
} from '@/modules/tenant/quotations/wizard/utils/motorFields';
import { ownerDefaultsFromPolicyholder } from '@/modules/tenant/quotations/wizard/utils/motorVehicleSelection';
import {
  CollapsibleCard,
  MobileCard,
  MobileSegmented,
  MobileSwitch,
} from './MobileUi';

type Form = UseFormReturn<QuotationFormSchemaValues>;
type Motor = QuotationFormSchemaValues['motor'];
type MotorKey = keyof Motor;
type FleetMotor =
  QuotationFormSchemaValues['fleet']['items'][number]['motor_dtl'];

const MAKE_MODEL_SHORT: MotorKey[] = [
  'make',
  'model',
  'manufacture_year',
  'body_type',
  'color',
  'motor_usage_code',
  'motor_category_code',
];
const ENGINE_FULL: MotorKey[] = ['engine_no'];
const ENGINE_SHORT: MotorKey[] = ['cubic_capacity', 'seating_capacity'];
const FUEL_FULL: MotorKey[] = ['fuel_type'];
const WEIGHT_SHORT: MotorKey[] = [
  'tare_weight',
  'gross_weight',
  'number_of_axles',
  'axle_distance',
];
const OWNER_SHORT: MotorKey[] = ['owner_name', 'owner_category'];
const OWNER_FULL: MotorKey[] = ['owner_address'];

const GROUPS = {
  identity: ['motor_type_code', 'registration_no', 'chassis_no'],
  makeModel: MAKE_MODEL_SHORT,
  engine: [...ENGINE_FULL, ...ENGINE_SHORT, ...FUEL_FULL, ...WEIGHT_SHORT],
  owner: [...OWNER_SHORT, ...OWNER_FULL],
} satisfies Record<string, MotorKey[]>;

const FLEET_KEY = Object.fromEntries(
  motorFields.map((field) => [field.key, field.fleetKey]),
) as Record<MotorKey, keyof FleetMotor>;

/** Fleet `motor_dtl` in the single-vehicle shape the field rules use. */
// eslint-disable-next-line react-refresh/only-export-components
export function fleetMotorAsMotor(motor: FleetMotor | undefined): Motor {
  return Object.fromEntries(
    motorFields.map((field) => [
      field.key,
      String(motor?.[field.fleetKey as keyof FleetMotor] ?? ''),
    ]),
  ) as unknown as Motor;
}

// eslint-disable-next-line react-refresh/only-export-components
export function missingKeys(motor: Motor, keys: MotorKey[]) {
  return keys.filter((key) => motorFieldError(key, motor[key], motor));
}

/** True when every required vehicle field passes the existing rules. */
// eslint-disable-next-line react-refresh/only-export-components
export function isMotorComplete(motor: Motor) {
  return (Object.values(GROUPS).flat() as MotorKey[]).every(
    (key) => !motorFieldError(key, motor[key], motor),
  );
}

function Fields({
  form,
  fleetIndex,
  keys,
  full = false,
}: {
  form: Form;
  fleetIndex?: number;
  keys: MotorKey[];
  full?: boolean;
}) {
  return (
    <div className={full ? 'mq-grid-full' : 'mq-grid'}>
      <VehicleDetailsFields
        form={form}
        fleetIndex={fleetIndex}
        onlyKeys={keys}
        title={null}
      />
    </div>
  );
}

/**
 * Vehicle form shared by the single-vehicle step and each fleet vehicle:
 * registration status and identifiers, then collapsible detail groups.
 */
export function MobileVehicleForm({
  form,
  fleetIndex,
  customer,
}: {
  form: Form;
  /** Set for a fleet vehicle; omitted for the single `motor` vehicle. */
  fleetIndex?: number;
  /** The selected existing customer, used for owner details. */
  customer?: CustomerRecord | null;
}) {
  const isFleet = fleetIndex != null;
  const base = isFleet ? `fleet.items.${fleetIndex}.motor_dtl` : 'motor';
  const path = (key: MotorKey) =>
    `${base}.${isFleet ? FLEET_KEY[key] : key}` as FieldPath<QuotationFormSchemaValues>;

  const single = useWatch({ control: form.control, name: 'motor' });
  const fleetMotor = useWatch({
    control: form.control,
    name: `fleet.items.${fleetIndex ?? 0}.motor_dtl`,
  });
  const motor = isFleet ? fleetMotorAsMotor(fleetMotor) : single;
  const [policyholderMode, policyholder] = useWatch({
    control: form.control,
    name: ['policyholder_mode', 'policyholder'],
  });
  const { errors, isSubmitted } = useFormState({
    control: form.control,
    name: base as FieldPath<QuotationFormSchemaValues>,
  });
  const fieldErrors = (
    isFleet ? errors.fleet?.items?.[fleetIndex]?.motor_dtl : errors.motor
  ) as Record<string, unknown> | undefined;
  const hasError = (keys: MotorKey[]) =>
    Boolean(
      fieldErrors &&
      keys.some((key) => fieldErrors[isFleet ? FLEET_KEY[key] : key]),
    );

  const ownerDefaults = ownerDefaultsFromPolicyholder(
    { policyholder_mode: policyholderMode, policyholder },
    customer,
  );
  const ownerMatches =
    !ownerDefaults ||
    (['owner_name', 'owner_category', 'owner_address'] as const).every(
      (key) => !motor[key] || motor[key] === ownerDefaults[key],
    );
  const [ownerIsPolicyholder, setOwnerIsPolicyholder] = useState(ownerMatches);

  function setOwnerToPolicyholder(on: boolean) {
    setOwnerIsPolicyholder(on);
    if (!on || !ownerDefaults) return;
    (['owner_name', 'owner_category', 'owner_address'] as const).forEach(
      (key) =>
        form.setValue(path(key), ownerDefaults[key], {
          shouldDirty: true,
          shouldValidate: isSubmitted,
        }),
    );
  }

  // While the switch is on, empty owner fields follow the policyholder.
  const defaultsKey = JSON.stringify(ownerDefaults);
  useEffect(() => {
    if (!ownerIsPolicyholder || !ownerDefaults) return;
    (['owner_name', 'owner_category', 'owner_address'] as const).forEach(
      (key) => {
        if (!form.getValues(path(key)))
          form.setValue(path(key), ownerDefaults[key], { shouldDirty: false });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerIsPolicyholder, defaultsKey]);

  const registered = motor.motor_type_code !== '2';
  const summary = {
    makeModel: [motor.make, motor.model, motor.manufacture_year, motor.color]
      .filter(Boolean)
      .join(' · '),
    engine: [
      motor.cubic_capacity && `${motor.cubic_capacity} cc`,
      motor.fuel_type,
      motor.seating_capacity && `${motor.seating_capacity} seats`,
    ]
      .filter(Boolean)
      .join(' · '),
    owner: ownerIsPolicyholder
      ? `Policyholder${motor.owner_name ? ` · ${motor.owner_name}` : ''}`
      : motor.owner_name,
  };
  const ownerMissing = missingKeys(motor, GROUPS.owner);

  return (
    <div className="space-y-3">
      <MobileCard title="Vehicle">
        <div className="space-y-3">
          <MobileSegmented
            label="Motor type"
            value={registered ? '1' : '2'}
            onChange={(value) =>
              form.setValue(path('motor_type_code'), value, {
                shouldDirty: true,
                shouldValidate: isSubmitted,
              })
            }
            options={[
              { value: '1', label: 'Registered' },
              { value: '2', label: 'Unregistered' },
            ]}
          />
          {registered && (
            <Fields
              form={form}
              fleetIndex={fleetIndex}
              keys={['registration_no']}
              full
            />
          )}
          <Fields
            form={form}
            fleetIndex={fleetIndex}
            keys={['chassis_no']}
            full
          />
        </div>
      </MobileCard>

      <CollapsibleCard
        title="Make & model"
        summary={summary.makeModel}
        complete={missingKeys(motor, GROUPS.makeModel).length === 0}
        defaultOpen={missingKeys(motor, GROUPS.makeModel).length > 0}
        forceOpen={hasError(GROUPS.makeModel)}
      >
        <Fields form={form} fleetIndex={fleetIndex} keys={MAKE_MODEL_SHORT} />
      </CollapsibleCard>

      <CollapsibleCard
        title="Engine & capacity"
        summary={summary.engine}
        complete={missingKeys(motor, GROUPS.engine).length === 0}
        forceOpen={hasError(GROUPS.engine)}
      >
        <div className="space-y-3">
          <Fields form={form} fleetIndex={fleetIndex} keys={ENGINE_FULL} full />
          <Fields form={form} fleetIndex={fleetIndex} keys={ENGINE_SHORT} />
          <Fields form={form} fleetIndex={fleetIndex} keys={FUEL_FULL} full />
          <Fields form={form} fleetIndex={fleetIndex} keys={WEIGHT_SHORT} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Owner"
        summary={summary.owner}
        complete={ownerMissing.length === 0}
        defaultOpen={!ownerMatches}
        forceOpen={hasError(GROUPS.owner)}
      >
        <div className="space-y-3">
          <MobileSwitch
            label="Owner is the policyholder"
            checked={ownerIsPolicyholder}
            onChange={setOwnerToPolicyholder}
          />
          {(!ownerIsPolicyholder || ownerMissing.length > 0) && (
            <>
              <Fields form={form} fleetIndex={fleetIndex} keys={OWNER_SHORT} />
              <Fields
                form={form}
                fleetIndex={fleetIndex}
                keys={OWNER_FULL}
                full
              />
            </>
          )}
        </div>
      </CollapsibleCard>
    </div>
  );
}
