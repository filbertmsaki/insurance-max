import type { VerificationResult } from '@/modules/tenant/verifications/api';
import type { QuotationFormSchemaValues } from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import {
  getMotorUsageLabelFromCode,
  getVehicleCategoryLabelFromCode,
} from './motorOptions';

type MotorDetails = QuotationFormSchemaValues['motor'];
type FleetMotorDetails =
  QuotationFormSchemaValues['fleet']['items'][number]['motor_dtl'];

const fields = {
  RegistrationNumber: 'registration_no',
  MotorRegistrationNumber: 'registration_no',
  ChassisNumber: 'chassis_no',
  MotorChassisNumber: 'chassis_no',
  EngineNumber: 'engine_no',
  Make: 'make',
  Model: 'model',
  ModelNumber: 'model_no',
  BodyType: 'body_type',
  Color: 'color',
  YearOfManufacture: 'manufacture_year',
  SittingCapacity: 'seating_capacity',
  EngineCapacity: 'cubic_capacity',
  FuelUsed: 'fuel_type',
  NumberOfAxles: 'number_of_axles',
  AxleDistance: 'axle_distance',
  TareWeight: 'tare_weight',
  GrossWeight: 'gross_weight',
  OwnerName: 'owner_name',
  OwnerAddress: 'owner_address',
} as const;

const uppercaseFields = new Set<keyof MotorDetails>([
  'registration_no',
  'chassis_no',
  'engine_no',
  'make',
  'model',
  'model_no',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const result = String(value).trim();
  return result && !['N/A', 'NULL'].includes(result.toUpperCase())
    ? result
    : undefined;
}

function code(value: unknown): '1' | '2' | undefined {
  const result = text(value);
  return result === '1' || result === '2' ? result : undefined;
}

/** Read the normalized verification response, with a fallback for XML-only responses. */
export function readVerifiedMotorDetails(
  result: VerificationResult,
  category: '1' | '2',
): Partial<MotorDetails> | null {
  if (
    !result.success ||
    (result.responseCode && result.responseCode !== 'TIRA001')
  ) {
    return null;
  }

  const verified = asRecord(result.verifiedRecordDetails);
  let details = asRecord(verified?.responseDetails) ?? verified;
  if (result.xml) {
    const document = new DOMParser().parseFromString(
      result.xml,
      'application/xml',
    );
    if (!document.querySelector('parsererror')) {
      const element = document.querySelector('VerificationDtl');
      if (element) {
        details = {
          ...Object.fromEntries(
            Array.from(element.children).map((child) => [
              child.tagName,
              child.textContent,
            ]),
          ),
          ...details,
        };
      }
    }
  }
  if (!details) return null;

  const motor: Partial<MotorDetails> = {};
  for (const [source, target] of Object.entries(fields)) {
    const value = text(details[source]);
    if (value !== undefined) {
      motor[target] = uppercaseFields.has(target)
        ? normalizeMotorTextInput(value)
        : value;
    }
  }
  // An acknowledgement or response header alone is not a vehicle record.
  if (Object.keys(motor).length === 0) return null;

  motor.motor_category_code = code(details.MotorCategory) ?? category;
  motor.vehicle_category = getVehicleCategoryLabelFromCode(
    motor.motor_category_code,
  );
  const motorType = code(details.MotorType);
  if (motorType) motor.motor_type_code = motorType;
  const usage = code(details.MotorUsage);
  if (usage) {
    motor.motor_usage_code = usage;
    motor.usage_type = getMotorUsageLabelFromCode(usage);
  }
  const ownerCategory = code(details.OwnerCategory);
  if (ownerCategory) motor.owner_category = ownerCategory;
  return motor;
}

const fleetFields = {
  motor_category_code: 'motor_category',
  motor_type_code: 'motor_type',
  registration_no: 'registration_number',
  chassis_no: 'chassis_number',
  engine_no: 'engine_number',
  make: 'make',
  model: 'model',
  model_no: 'model_number',
  body_type: 'body_type',
  color: 'color',
  manufacture_year: 'year_of_manufacture',
  seating_capacity: 'sitting_capacity',
  cubic_capacity: 'engine_capacity',
  fuel_type: 'fuel_used',
  number_of_axles: 'number_of_axles',
  axle_distance: 'axle_distance',
  tare_weight: 'tare_weight',
  gross_weight: 'gross_weight',
  motor_usage_code: 'motor_usage',
  owner_name: 'owner_name',
  owner_category: 'owner_category',
  owner_address: 'owner_address',
} as const;

export function toFleetMotorDetails(
  motor: Partial<MotorDetails>,
): Partial<FleetMotorDetails> {
  const fleet: Partial<FleetMotorDetails> = {};
  for (const source of Object.keys(fleetFields) as Array<
    keyof typeof fleetFields
  >) {
    const value = motor[source];
    if (value !== undefined) fleet[fleetFields[source]] = value;
  }
  return fleet;
}
