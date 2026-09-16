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

export function getMotorTypeLabelFromCode(
  code: string | number | null | undefined,
) {
  switch (String(code ?? '')) {
    case '1':
      return 'Registered';
    case '2':
      return 'In Transit';
    default:
      return '';
  }
}

export function getMotorUsageLabelFromCode(
  code: string | number | null | undefined,
) {
  switch (String(code ?? '')) {
    case '1':
      return 'Private';
    case '2':
      return 'Commercial';
    default:
      return '';
  }
}

export function getOwnerCategoryLabelFromCode(
  code: string | number | null | undefined,
) {
  switch (String(code ?? '')) {
    case '1':
      return 'Individual';
    case '2':
      return 'Corporate';
    default:
      return '';
  }
}

/**
 * TIRA's MotorVerificationRes returns MotorUsage as free text (e.g.
 * "Private", "Private or Normal", "Commercial") rather than the "1"/"2"
 * code used elsewhere in this app, so verified values must be translated
 * back to our code.
 */
export function getMotorUsageCodeFromLabel(
  value: string | number | null | undefined,
): '1' | '2' | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === '1') return '1';
  if (normalized === '2') return '2';
  if (normalized.includes('private') || normalized.includes('normal'))
    return '1';
  if (normalized.includes('commercial')) return '2';
  return undefined;
}

/**
 * TIRA's MotorVerificationRes returns OwnerCategory as a free-text
 * description (e.g. "Sole Proprietor", "Company Ltd") rather than the
 * "1"/"2" code this app models. Map the common TIRA descriptions to our
 * Individual/Corporate codes; anything unrecognized is left unmapped
 * rather than guessed.
 */
export function getOwnerCategoryCodeFromLabel(
  value: string | number | null | undefined,
): '1' | '2' | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === '1' || normalized === '2') return normalized;
  const individualKeywords = [
    'individual',
    'citizen',
    'sole proprietor',
    'natural person',
    'person',
  ];
  if (individualKeywords.some((keyword) => normalized.includes(keyword)))
    return '1';
  const corporateKeywords = [
    'corporate',
    'company',
    'government',
    'parastatal',
    'organisation',
    'organization',
    'institution',
    'partnership',
    'trust',
    'ltd',
    'limited',
  ];
  if (corporateKeywords.some((keyword) => normalized.includes(keyword)))
    return '2';
  return undefined;
}
