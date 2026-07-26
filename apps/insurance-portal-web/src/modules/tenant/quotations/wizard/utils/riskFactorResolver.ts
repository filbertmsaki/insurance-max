import type { RiskRequiredFactor } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

type FactorValue = string | number | boolean;
type MotorDetails = QuotationFormSchemaValues['motor'];

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

/** The `motor.*` field a given rating factor code reads from, if any. */
export function motorFieldNameForFactorCode(
  factorCode: string,
): keyof MotorDetails | undefined {
  return MOTOR_FACTOR_FIELD_MAP[factorCode];
}

function coerceFactorValue(
  raw: string,
  dataType: RiskRequiredFactor['factor']['data_type'],
): FactorValue {
  if (dataType === 'NUMBER') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (dataType === 'BOOLEAN') {
    return raw === 'true' || raw === '1';
  }
  return raw;
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
): Record<string, FactorValue> {
  const isMotorFlow = formValues.quotation_type === 'MOTOR';
  const values: Record<string, FactorValue> = {};

  requiredFactors.forEach((requiredFactor) => {
    const code = requiredFactor.factor.code;
    const raw = isMotorFlow
      ? resolveMotorFactorRawValue(code, formValues.motor)
      : undefined;

    if (raw === undefined || raw === '') return;
    values[code] = coerceFactorValue(raw, requiredFactor.factor.data_type);
  });

  values.sum_insured = Number(formValues.risks[riskIndex]?.sum_insured) || 0;

  return values;
}
