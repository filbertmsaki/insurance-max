import type { FleetVehicleMotorInput } from '../api';

export const FLEET_ADD_VEHICLE_CODE = 'FLEET_ADD_VEHICLE';
export const FLEET_REMOVE_VEHICLE_CODE = 'FLEET_REMOVE_VEHICLE';

export type FleetVehicleStatus = 'ACTIVE' | 'ADDED' | 'REMOVED' | 'CANCELLED';

export interface FleetSnapshotVehicle {
  fleetEntry: number;
  registrationNumber: string | null;
  chassisNumber: string | null;
  description: string;
  sumInsured: number;
  status: FleetVehicleStatus;
  removedOn: string | null;
}

type SnapshotRecord = Record<string, unknown>;

const asRecord = (value: unknown): SnapshotRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as SnapshotRecord)
    : null;

const asRecords = (value: unknown): SnapshotRecord[] =>
  Array.isArray(value)
    ? value.map(asRecord).filter((item): item is SnapshotRecord => !!item)
    : [];

const text = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

/** Vehicles of the endorsement's proposed fleet, as the backend numbers them. */
export function vehiclesFromSnapshot(
  snapshot: SnapshotRecord | null | undefined,
): FleetSnapshotVehicle[] {
  return asRecords(snapshot?.['entries']).map((entry, index) => {
    const motor = asRecord(entry['motor']) ?? {};
    const fleetEntry = Number(entry['fleetEntry'] ?? entry['entryNumber']);
    const raw = String(entry['status'] ?? '');
    const status: FleetVehicleStatus = (
      ['ADDED', 'REMOVED', 'CANCELLED'] as const
    ).includes(raw as never)
      ? (raw as FleetVehicleStatus)
      : 'ACTIVE';
    return {
      fleetEntry:
        Number.isInteger(fleetEntry) && fleetEntry > 0 ? fleetEntry : index + 1,
      registrationNumber: text(motor['registrationNumber']),
      chassisNumber: text(motor['chassisNumber']),
      description:
        [motor['make'], motor['model'], motor['yearOfManufacture']]
          .filter(Boolean)
          .join(' · ') || '',
      sumInsured: asRecords(entry['risks']).reduce(
        (total, risk) => total + Number(risk['sumInsured'] ?? 0),
        0,
      ),
      status,
      removedOn: text(entry['removedEffectiveDate']),
    };
  });
}

/** Form state for a vehicle being added (strings, as typed). */
export type FleetVehicleForm = Record<keyof FleetVehicleMotorInput, string>;

export const FLEET_VEHICLE_FIELDS: Array<{
  key: keyof FleetVehicleMotorInput;
  label: string;
  required: boolean;
  numeric?: boolean;
  options?: Array<{ value: string; label: string }>;
}> = [
  {
    key: 'motorCategory',
    label: 'Motor category',
    required: true,
    options: [
      { value: '1', label: 'Motor vehicle' },
      { value: '2', label: 'Motor cycle' },
    ],
  },
  {
    key: 'motorType',
    label: 'Motor type',
    required: true,
    options: [
      { value: '1', label: 'Registered' },
      { value: '2', label: 'In transit' },
    ],
  },
  { key: 'registrationNumber', label: 'Registration number', required: false },
  { key: 'chassisNumber', label: 'Chassis number', required: true },
  { key: 'engineNumber', label: 'Engine number', required: true },
  { key: 'make', label: 'Make', required: true },
  { key: 'model', label: 'Model', required: true },
  { key: 'modelNumber', label: 'Model number', required: true },
  { key: 'bodyType', label: 'Body type', required: true },
  { key: 'color', label: 'Colour', required: true },
  { key: 'engineCapacity', label: 'Engine capacity', required: true },
  { key: 'fuelUsed', label: 'Fuel used', required: true },
  {
    key: 'yearOfManufacture',
    label: 'Year of manufacture',
    required: true,
    numeric: true,
  },
  { key: 'tareWeight', label: 'Tare weight', required: true, numeric: true },
  { key: 'grossWeight', label: 'Gross weight', required: true, numeric: true },
  {
    key: 'sittingCapacity',
    label: 'Sitting capacity',
    required: false,
    numeric: true,
  },
  {
    key: 'numberOfAxles',
    label: 'Number of axles',
    required: false,
    numeric: true,
  },
  {
    key: 'axleDistance',
    label: 'Axle distance',
    required: false,
    numeric: true,
  },
  {
    key: 'motorUsage',
    label: 'Motor usage',
    required: false,
    options: [
      { value: '1', label: 'Private' },
      { value: '2', label: 'Commercial' },
    ],
  },
  { key: 'ownerName', label: 'Owner name', required: true },
  {
    key: 'ownerCategory',
    label: 'Owner category',
    required: true,
    options: [
      { value: '1', label: 'Sole proprietor' },
      { value: '2', label: 'Corporate' },
    ],
  },
  { key: 'ownerAddress', label: 'Owner address', required: false },
];

export function emptyFleetVehicleForm(): FleetVehicleForm {
  return Object.fromEntries(
    FLEET_VEHICLE_FIELDS.map((field) => [
      field.key,
      field.key === 'motorCategory' || field.key === 'motorType' ? '1' : '',
    ]),
  ) as FleetVehicleForm;
}

const NUMERIC_KEYS = new Set<string>([
  'motorCategory',
  'motorType',
  'motorUsage',
  'ownerCategory',
  ...FLEET_VEHICLE_FIELDS.filter((field) => field.numeric).map(
    (field) => field.key,
  ),
]);

/**
 * TIRAMIS MotorDtl from the form, or the labels of missing mandatory fields
 * (a registered vehicle, MotorType 1, also needs its registration number).
 */
export function toMotorInput(form: FleetVehicleForm): {
  motor: FleetVehicleMotorInput;
  missing: string[];
} {
  const missing = FLEET_VEHICLE_FIELDS.filter(
    (field) =>
      (field.required ||
        (field.key === 'registrationNumber' && form.motorType === '1')) &&
      !form[field.key]?.trim(),
  ).map((field) => field.label);

  const motor = Object.fromEntries(
    Object.entries(form)
      .filter(([, value]) => value.trim() !== '')
      .map(([key, value]) => [
        key,
        NUMERIC_KEYS.has(key) ? Number(value) : value.trim(),
      ]),
  ) as unknown as FleetVehicleMotorInput;

  return { motor, missing };
}

/** What a TIRA rejection means for a fleet vehicle change (API v1.3 §19). */
const TIRA_FLEET_MESSAGES: Record<string, string> = {
  TIRA082:
    "TIRA did not recognise the vehicle's previous cover note reference. Check the policy's cover notes are issued before endorsing.",
  TIRA090:
    'This vehicle already has an active cover note with this product at TIRA.',
  TIRA220: 'This vehicle already has an active cover note at TIRA.',
  TIRA105: 'TIRA rejected the fleet ID (invalid or duplicate).',
  TIRA106: 'TIRA rejected the fleet size.',
  TIRA108: 'TIRA rejected a fleet entry number.',
  TIRA137: 'TIRA rejected the motor registration number.',
  TIRA138: 'TIRA rejected the chassis number.',
  TIRA212: 'TIRA rejected the endorsement type.',
  TIRA221: 'TIRA rejected the fleet type.',
};

export function describeTiraCode(
  code: string | null | undefined,
): string | null {
  return code ? (TIRA_FLEET_MESSAGES[code.trim().toUpperCase()] ?? null) : null;
}
