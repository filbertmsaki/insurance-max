import type { RiskRequiredFactor } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

type FactorValue = string | number | boolean;
type MotorDetails = QuotationFormSchemaValues['motor'];
type FleetMotorDetails = QuotationFormSchemaValues['fleet']['items'][number]['motor_dtl'];

export interface QuotationFactorContext {
  salePointCode?: string;
  policyHolderType?: number;
}

const NON_MOTOR_BASE_FACTOR_CODES = [
  'annual_turnover',
  'payroll',
  'declared_value',
  'limit_of_liability',
  'sum_insured_amount',
  'floor_area',
  'number_of_units',
  'number_of_locations',
  'number_of_employees',
] as const;

const MOTOR_USAGE_CODE_TO_FACTOR_VALUE: Record<string, string> = {
  '1': 'PRIVATE',
  '2': 'COMMERCIAL',
};

/**
 * Backend rating factor code -> wizard motor field. Keeps the motor step's
 * dedicated form fields decoupled from the generic factor-driven calculation
 * API, and doubles as the lookup used to know which motor field to clear when
 * a risk row switches to a risk that no longer declares a given factor.
 *
 * `motor_usage` is intentionally absent here — its factor value is derived
 * from `motor_usage_code` via a value map, not a 1:1 field passthrough (see
 * `resolveMotorFactorRawValue`), but the code->field association still holds
 * for clearing purposes.
 */
const MOTOR_FACTOR_FIELD_MAP: Partial<Record<string, keyof MotorDetails>> = {
  year_of_manufacture: 'manufacture_year',
  seat_capacity: 'seating_capacity',
  vehicle_weight_kg: 'gross_weight',
  cargo_weight_ton: 'tonnage',
  motor_usage: 'motor_usage_code',
  motor_category: 'motor_category_code',
  motor_type: 'motor_type_code',
  registration_number: 'registration_no',
  chassis_number: 'chassis_no',
  make: 'make',
  model: 'model',
  body_type: 'body_type',
  engine_number: 'engine_no',
  engine_capacity: 'cubic_capacity',
  fuel_used: 'fuel_type',
  owner_name: 'owner_name',
  owner_category: 'owner_category',
};

const FLEET_MOTOR_FACTOR_FIELD_MAP: Partial<
  Record<string, keyof FleetMotorDetails>
> = {
  year_of_manufacture: 'year_of_manufacture',
  seat_capacity: 'sitting_capacity',
  vehicle_weight_kg: 'gross_weight',
  cargo_weight_ton: 'gross_weight',
  motor_usage: 'motor_usage',
  motor_category: 'motor_category',
  motor_type: 'motor_type',
  registration_number: 'registration_number',
  chassis_number: 'chassis_number',
  make: 'make',
  model: 'model',
  body_type: 'body_type',
  engine_number: 'engine_number',
  engine_capacity: 'engine_capacity',
  fuel_used: 'fuel_used',
  owner_name: 'owner_name',
  owner_category: 'owner_category',
};

function resolveMotorFactorRawValue(
  factorCode: string,
  motor: MotorDetails,
): string | undefined {
  if (factorCode === 'motor_usage') {
    return MOTOR_USAGE_CODE_TO_FACTOR_VALUE[motor.motor_usage_code];
  }
  const field = MOTOR_FACTOR_FIELD_MAP[factorCode];
  return field ? motor[field] : undefined;
}

function resolveFleetMotorFactorRawValue(
  factorCode: string,
  motor: FleetMotorDetails,
): string | undefined {
  const field = FLEET_MOTOR_FACTOR_FIELD_MAP[factorCode];
  return field ? motor[field] : undefined;
}

/** The `motor.*` field a given rating factor code reads from, if any. */
export function motorFieldNameForFactorCode(
  factorCode: string,
): keyof MotorDetails | undefined {
  return MOTOR_FACTOR_FIELD_MAP[factorCode];
}

function coerceFactorValue(
  raw: string | number | boolean,
  dataType: RiskRequiredFactor['factor']['data_type'],
): FactorValue {
  const stringValue = String(raw);

  if (dataType === 'NUMBER') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (dataType === 'BOOLEAN') {
    if (typeof raw === 'boolean') return raw;
    return stringValue === 'true' || stringValue === '1';
  }
  return typeof raw === 'string' ? raw : stringValue;
}

function resolveQuotationFactorRawValue(
  factorCode: string,
  formValues: QuotationFormSchemaValues,
  context?: QuotationFactorContext,
): string | number | undefined {
  switch (factorCode) {
    case 'payment_mode':
      return {
        '1': 'Cash',
        '2': 'Cheque',
        '3': 'EFT',
      }[formValues.payment_mode_tira];
    case 'currency_code':
      return formValues.currency.trim().toUpperCase();
    case 'exchange_rate':
      return formValues.currency.trim().toUpperCase() === 'TZS'
        ? 1
        : formValues.exchange_rate;
    case 'sale_point_code':
      return context?.salePointCode;
    case 'officer_name':
      return formValues.officer_name;
    case 'officer_title':
      return formValues.officer_title;
    case 'policy_holder_type':
      return context?.policyHolderType === 2 ? 'Corporate' : 'Individual';
    default:
      return undefined;
  }
}

/**
 * Resolves the factor payload the calculation API expects for a given risk row,
 * generically across Motor/Marine/Fire/Engineering/GIT/Misc — the mapping table
 * only fills in values where the wizard already has a dedicated input (currently
 * the Motor step). Unmapped/missing codes are omitted; the API's own
 * `validation_errors` surface anything still required.
 */
export function resolveFactorValues(
  requiredFactors: RiskRequiredFactor[],
  formValues: QuotationFormSchemaValues,
  riskIndex: number,
  context?: QuotationFactorContext,
): Record<string, FactorValue> {
  const isMotorFlow = formValues.quotation_type === 'MOTOR';
  const rowFactorValues = formValues.risks[riskIndex]?.factor_values ?? {};
  const values: Record<string, FactorValue> = {};

  requiredFactors.forEach((requiredFactor) => {
    const code = requiredFactor.factor.code;
    const raw =
      resolveQuotationFactorRawValue(code, formValues, context) ??
      (isMotorFlow
        ? resolveMotorFactorRawValue(code, formValues.motor)
        : rowFactorValues[code]);

    if (raw === undefined || raw === '') return;
    values[code] = coerceFactorValue(raw, requiredFactor.factor.data_type);
  });

  values.sum_insured = resolveEffectiveSumInsured(
    formValues.risks[riskIndex]?.sum_insured,
    rowFactorValues,
  );

  return values;
}

function resolveEffectiveSumInsured(
  explicitSumInsured: string | number | null | undefined,
  factorValues: Record<string, FactorValue>,
) {
  const explicitNumber =
    explicitSumInsured === '' || explicitSumInsured == null
      ? NaN
      : Number(explicitSumInsured);
  if (Number.isFinite(explicitNumber) && explicitNumber > 0) {
    return explicitNumber;
  }

  const factorSumInsured = Number(factorValues.sum_insured);
  if (Number.isFinite(factorSumInsured) && factorSumInsured > 0) {
    return factorSumInsured;
  }

  for (const code of NON_MOTOR_BASE_FACTOR_CODES) {
    const candidate = Number(factorValues[code]);
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 0;
}

export function resolveFleetFactorValues(
  requiredFactors: RiskRequiredFactor[],
  item: QuotationFormSchemaValues['fleet']['items'][number],
  riskIndex: number,
  formValues: QuotationFormSchemaValues,
  context?: QuotationFactorContext,
): Record<string, FactorValue> {
  const values: Record<string, FactorValue> = {};

  requiredFactors.forEach((requiredFactor) => {
    const code = requiredFactor.factor.code;
    const raw =
      resolveQuotationFactorRawValue(code, formValues, context) ??
      resolveFleetMotorFactorRawValue(code, item.motor_dtl);

    if (raw === undefined || raw === '') return;
    values[code] = coerceFactorValue(raw, requiredFactor.factor.data_type);
  });

  values.sum_insured = Number(item.risks_covered[riskIndex]?.sum_insured) || 0;

  return values;
}
