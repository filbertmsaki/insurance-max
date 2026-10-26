import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type {
  MotorVerificationRequest,
  VerificationResult,
} from '@/modules/tenant/verifications/api';
import type { QuotationFormSchemaValues } from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import { motorFieldError, motorFields } from './motorFields';
import {
  getMotorCategoryCodeFromVehicleCategory,
  getMotorUsageCodeFromLabel,
} from './motorOptions';
import { readVerifiedMotorDetails } from './vehicleVerification';

type Motor = QuotationFormSchemaValues['motor'];

/** Identifiers are validated without spaces ("T 123 ABC" → "T123ABC"). */
function identifier(value?: string | null): string {
  return normalizeMotorTextInput(value).replace(/\s+/g, '');
}

function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Form values for a vehicle picked from the company register. */
export function vehicleRecordToMotorDetails(
  vehicle: MotorVehicleRecord,
): Partial<Motor> {
  const metadata = vehicle.metadata ?? {};
  const metadataCategory = metadata.motor_category_code;
  const metadataType = metadata.motor_type_code;
  return {
    vehicle_id: vehicle.id,
    motor_category_code: (metadataCategory !== null &&
    metadataCategory !== undefined &&
    metadataCategory !== ''
      ? String(metadataCategory)
      : getMotorCategoryCodeFromVehicleCategory(
          vehicle.motor_category ?? vehicle.vehicle_category,
        )) as Motor['motor_category_code'],
    motor_type_code: String(
      metadataType ?? vehicle.motor_type ?? '1',
    ) as Motor['motor_type_code'],
    registration_no: identifier(vehicle.registration_no),
    chassis_no: identifier(vehicle.chassis_no),
    engine_no: identifier(vehicle.engine_no),
    make: normalizeMotorTextInput(vehicle.make),
    model: normalizeMotorTextInput(vehicle.model),
    model_no: normalizeMotorTextInput(vehicle.model_no),
    body_type: normalizeMotorTextInput(vehicle.body_type),
    color: normalizeMotorTextInput(vehicle.color),
    manufacture_year: text(vehicle.manufacture_year),
    usage_type: vehicle.usage_type ?? '',
    motor_usage_code: (vehicle.motor_usage !== null &&
    vehicle.motor_usage !== undefined
      ? String(vehicle.motor_usage)
      : (getMotorUsageCodeFromLabel(vehicle.usage_type) ??
        '')) as Motor['motor_usage_code'],
    vehicle_category: vehicle.vehicle_category ?? '',
    seating_capacity: text(vehicle.seating_capacity),
    tonnage: vehicle.tonnage ?? '',
    cubic_capacity: text(vehicle.cubic_capacity),
    fuel_type: normalizeMotorTextInput(vehicle.fuel_type),
    number_of_axles: text(vehicle.number_of_axles),
    axle_distance: vehicle.axle_distance ?? '',
    tare_weight: vehicle.tare_weight ?? '',
    gross_weight: vehicle.gross_weight ?? '',
    owner_name: vehicle.owner_name ?? '',
    owner_category: text(vehicle.owner_category) as Motor['owner_category'],
    owner_address: vehicle.owner_address ?? '',
    vehicle_value: vehicle.vehicle_value ?? '',
  };
}

/** Vehicle fields that still fail validation and must be shown. */
export function missingMotorFieldKeys(motor: Motor): Array<keyof Motor> {
  return motorFields
    .filter((field) => motorFieldError(field.key, motor[field.key], motor))
    .map((field) => field.key);
}

export type VehicleOwnerDefaults = Pick<
  Motor,
  'owner_name' | 'owner_category' | 'owner_address'
>;

/**
 * Owner details assume the policyholder owns the vehicle, the usual case.
 * Values come from the selected customer, or the new policyholder's details.
 */
export function ownerDefaultsFromPolicyholder(
  values: Pick<QuotationFormSchemaValues, 'policyholder_mode' | 'policyholder'>,
  customer?: CustomerRecord | null,
): VehicleOwnerDefaults | null {
  const source =
    values.policyholder_mode === 'existing'
      ? customer
        ? {
            name: getCustomerDisplayName(customer),
            corporate: customer.customer_type === 'CORPORATE',
            postal: customer.postal_address,
            street: customer.street,
            district: customer.district,
            region: customer.region,
          }
        : null
      : {
          name: values.policyholder.policy_holder_name || '',
          corporate: values.policyholder.policy_holder_type === 2,
          postal: values.policyholder.postal_address,
          street: values.policyholder.street,
          district: values.policyholder.district,
          region: values.policyholder.region,
        };
  if (!source?.name) return null;
  return {
    owner_name: source.name,
    owner_category: source.corporate ? '2' : '1',
    owner_address:
      source.postal?.trim() ||
      [source.street, source.district, source.region]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', '),
  };
}

/**
 * Fills owner fields that are empty, or that still hold the defaults applied
 * for a previous policyholder (`previous`), so a typed owner is never lost.
 */
export function applyOwnerDefaults(
  motor: Motor,
  defaults: VehicleOwnerDefaults,
  previous?: VehicleOwnerDefaults | null,
): Partial<VehicleOwnerDefaults> {
  const updates: Partial<VehicleOwnerDefaults> = {};
  (Object.keys(defaults) as Array<keyof VehicleOwnerDefaults>).forEach(
    (key) => {
      const current = motor[key] ?? '';
      const replaceable = !current || (previous && current === previous[key]);
      if (replaceable && current !== defaults[key]) {
        (updates as Record<string, string>)[key] = defaults[key];
      }
    },
  );
  return updates;
}

/** Registration plates are short; longer identifiers are chassis numbers. */
const MAX_REGISTRATION_LENGTH = 10;

/** Tanzanian motorcycle plates start with "MC". */
export function inferMotorCategory(value: string): 1 | 2 {
  return identifier(value).startsWith('MC') ? 2 : 1;
}

export type TiraVehicleLookupResult =
  | { status: 'found'; details: Partial<Motor> }
  | { status: 'not-found' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

/**
 * TIRA lookup from one identifier, without asking which kind it is: short
 * values are tried as a registration and then as a chassis number (the same
 * fallback the fleet bulk lookup uses); long values as a chassis number.
 */
export async function lookupVehicleWithTira(
  raw: string,
  verifyMotor: (data: MotorVerificationRequest) => Promise<VerificationResult>,
  category: 1 | 2 = inferMotorCategory(raw),
): Promise<TiraVehicleLookupResult> {
  const value = identifier(raw);
  if (!value) return { status: 'not-found' };

  const attempts: Array<'registration' | 'chassis'> =
    value.length > MAX_REGISTRATION_LENGTH
      ? ['chassis']
      : ['registration', 'chassis'];

  for (const kind of attempts) {
    const result = await verifyMotor({
      motorCategory: category,
      ...(kind === 'registration'
        ? { motorRegistrationNumber: value }
        : { motorChassisNumber: value }),
    });
    if (result.status === 'PENDING') return { status: 'pending' };
    if (result.responseCode === 'TIRA007') continue;
    if (!result.success) {
      return {
        status: 'error',
        message:
          result.responseMessage ||
          'Unable to fetch vehicle details. Please try again.',
      };
    }
    const details = readVerifiedMotorDetails(
      result,
      String(category) as '1' | '2',
    );
    if (details) return { status: 'found', details };
  }
  return { status: 'not-found' };
}
