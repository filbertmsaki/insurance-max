import type { RiskRequiredFactor } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

type FactorValue = string | number | boolean;
type MotorDetails = QuotationFormSchemaValues['motor'];

const MOTOR_USAGE_CODE_TO_FACTOR_VALUE: Record<string, string> = {
  '1': 'PRIVATE',
  '2': 'COMMERCIAL',
};

/**
 * Wizard motor field -> backend rating factor code. Keeps the motor step's
 * dedicated form fields decoupled from the generic factor-driven calculation API.
 */
function resolveMotorFactorRawValue(
  factorCode: string,
  motor: MotorDetails,
): string | undefined {
  switch (factorCode) {
    case 'year_of_manufacture':
      return motor.manufacture_year;
    case 'seat_capacity':
      return motor.seating_capacity;
    case 'vehicle_weight_kg':
      return motor.gross_weight;
    case 'cargo_weight_ton':
      return motor.tonnage;
    case 'motor_usage':
      return MOTOR_USAGE_CODE_TO_FACTOR_VALUE[motor.motor_usage_code];
    case 'motor_category':
      return motor.motor_category_code;
    case 'motor_type':
      return motor.motor_type_code;
    case 'registration_number':
      return motor.registration_no;
    case 'chassis_number':
      return motor.chassis_no;
    case 'make':
      return motor.make;
    case 'model':
      return motor.model;
    case 'body_type':
      return motor.body_type;
    case 'engine_number':
      return motor.engine_no;
    case 'engine_capacity':
      return motor.cubic_capacity;
    case 'fuel_used':
      return motor.fuel_type;
    case 'owner_name':
      return motor.owner_name;
    case 'owner_category':
      return motor.owner_category;
    default:
      return undefined;
  }
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
