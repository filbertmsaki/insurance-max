export const MOTOR_CATEGORY_OPTIONS = [
  { value: '1', label: '1 - Motor vehicle' },
  { value: '2', label: '2 - Motor cycle' },
] as const;

export const MOTOR_TYPE_OPTIONS = [
  { value: '1', label: '1 - Registered' },
  { value: '2', label: '2 - In transit' },
] as const;

export function getVehicleCategoryLabelFromCode(
  code: string | null | undefined,
) {
  switch (code) {
    case '1':
      return 'Motor Vehicle';
    case '2':
      return 'Motor Cycle';
    default:
      return '';
  }
}

export function getMotorCategoryCodeFromVehicleCategory(
  vehicleCategory: string | number | null | undefined,
) {
  const normalized = String(vehicleCategory ?? '')
    .trim()
    .toLowerCase();
  if (normalized === '1' || normalized === 'motor vehicle') return '1';
  if (
    normalized === '2' ||
    normalized === 'motor cycle' ||
    normalized === 'motorcycle'
  )
    return '2';
  return '';
}
