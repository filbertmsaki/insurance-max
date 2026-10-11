import type { QuotationFormValues } from '../../types';

type Motor = QuotationFormValues['motor'];

const FIRST_MANUFACTURE_YEAR = 1900;
const currentYear = new Date().getUTCFullYear();
/** Newest first, so recent vehicles are near the top of the list. */
const MANUFACTURE_YEAR_OPTIONS = Array.from(
  { length: currentYear - FIRST_MANUFACTURE_YEAR + 1 },
  (_, index) => {
    const year = String(currentYear - index);
    return { value: year, label: year };
  },
);

export const motorFields: ReadonlyArray<{
  key: keyof Motor;
  fleetKey: string;
  label: string;
  optional?: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Long option lists get a type-to-search picker instead of a plain select. */
  searchable?: boolean;
}> = [
  {
    key: 'motor_category_code',
    fleetKey: 'motor_category',
    label: 'Vehicle category',
    options: [
      { value: '1', label: 'Motor vehicle' },
      { value: '2', label: 'Motorcycle' },
    ],
  },
  {
    key: 'motor_type_code',
    fleetKey: 'motor_type',
    label: 'Vehicle type',
    options: [
      { value: '1', label: 'Registered' },
      { value: '2', label: 'In transit' },
    ],
  },
  {
    key: 'motor_usage_code',
    fleetKey: 'motor_usage',
    label: 'Vehicle usage',
    optional: true,
    options: [
      { value: '1', label: 'Private' },
      { value: '2', label: 'Commercial' },
    ],
  },
  {
    key: 'registration_no',
    fleetKey: 'registration_number',
    label: 'Registration number',
  },
  { key: 'chassis_no', fleetKey: 'chassis_number', label: 'Chassis number' },
  { key: 'engine_no', fleetKey: 'engine_number', label: 'Engine number' },
  { key: 'make', fleetKey: 'make', label: 'Make' },
  { key: 'model', fleetKey: 'model', label: 'Model' },
  {
    key: 'model_no',
    fleetKey: 'model_number',
    label: 'Model number',
    optional: true,
  },
  { key: 'body_type', fleetKey: 'body_type', label: 'Body type' },
  { key: 'color', fleetKey: 'color', label: 'Colour' },
  {
    key: 'manufacture_year',
    fleetKey: 'year_of_manufacture',
    label: 'Year of manufacture',
    options: MANUFACTURE_YEAR_OPTIONS,
    searchable: true,
  },
  {
    key: 'seating_capacity',
    fleetKey: 'sitting_capacity',
    label: 'Seats',
    optional: true,
  },
  {
    key: 'cubic_capacity',
    fleetKey: 'engine_capacity',
    label: 'Engine capacity (cc)',
  },
  { key: 'fuel_type', fleetKey: 'fuel_used', label: 'Fuel' },
  {
    key: 'number_of_axles',
    fleetKey: 'number_of_axles',
    label: 'Axles',
    optional: true,
  },
  {
    key: 'axle_distance',
    fleetKey: 'axle_distance',
    label: 'Axle distance',
    optional: true,
  },
  { key: 'tare_weight', fleetKey: 'tare_weight', label: 'Tare weight (kg)' },
  { key: 'gross_weight', fleetKey: 'gross_weight', label: 'Gross weight (kg)' },
  { key: 'owner_name', fleetKey: 'owner_name', label: 'Owner name' },
  {
    key: 'owner_category',
    fleetKey: 'owner_category',
    label: 'Owner type',
    options: [
      { value: '1', label: 'Individual' },
      { value: '2', label: 'Corporate' },
    ],
  },
  {
    key: 'owner_address',
    fleetKey: 'owner_address',
    label: 'Owner address',
    optional: true,
  },
];

export function motorFieldError(
  key: keyof Motor,
  value: string | undefined,
  motor: Partial<Motor>,
): string | null {
  const definition = motorFields.find((field) => field.key === key);
  const isRegistrationOptional =
    key === 'registration_no' && motor.motor_type_code === '2';
  if (!value?.trim())
    return definition?.optional || isRegistrationOptional
      ? null
      : `Enter ${definition?.label.toLowerCase() ?? key}.`;
  if (
    definition?.options &&
    !definition.options.some((option) => option.value === value)
  )
    return `Select ${definition.label.toLowerCase()}.`;
  const patterns: Partial<Record<keyof Motor, RegExp>> = {
    registration_no: /^[A-Z0-9-]{3,50}$/i,
    chassis_no: /^[A-Z0-9-]{6,100}$/i,
    engine_no: /^[A-Z0-9-]{3,100}$/i,
  };
  if (patterns[key] && !patterns[key].test(value.trim()))
    return `Check the ${definition?.label.toLowerCase()}. Use letters, digits or hyphens without spaces.`;
  const positive = [
    'manufacture_year',
    'seating_capacity',
    'cubic_capacity',
    'number_of_axles',
    'axle_distance',
    'tare_weight',
    'gross_weight',
  ];
  if (
    positive.includes(key) &&
    (!Number.isFinite(Number(value)) || Number(value) <= 0)
  )
    return `${definition?.label} must be greater than zero.`;
  if (
    ['manufacture_year', 'seating_capacity', 'number_of_axles'].includes(key) &&
    !Number.isInteger(Number(value))
  )
    return `${definition?.label} must be a whole number.`;
  if (key === 'gross_weight' && Number(value) < Number(motor.tare_weight))
    return 'Gross weight must be at least the tare weight.';
  return null;
}

/** A different lookup result must not inherit missing facts from the previous vehicle. */
export function mergeVerifiedMotor(
  current: Motor,
  incoming: Partial<Motor>,
  empty: Motor,
): Motor {
  const normalize = (value?: string) => value?.trim().toUpperCase();
  const same =
    incoming.chassis_no && current.chassis_no
      ? normalize(incoming.chassis_no) === normalize(current.chassis_no)
      : Boolean(
          incoming.registration_no &&
          normalize(incoming.registration_no) ===
            normalize(current.registration_no),
        );
  return { ...(same ? current : empty), ...incoming, vehicle_id: '' };
}
