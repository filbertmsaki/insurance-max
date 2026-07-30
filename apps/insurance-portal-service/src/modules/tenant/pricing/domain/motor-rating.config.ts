import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { FactorUnit } from '@insurance-max/portal-shared/enums/factor-unit.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export const MOTOR_PRODUCT_CODES = [
  'SP014001000000',
  'SP014002000000',
  'SP014003000000',
  'SP014004000000',
  'SP014005000000',
] as const;

export const MOTOR_RATE_BOOK_VERSION = '2026.1';

export type MotorSelectionConstraint =
  | {
      kind: 'WEIGHT_BAND';
      expectedLabel: string;
      minExclusive?: number;
      minInclusive?: number;
      maxExclusive?: number;
      maxInclusive?: number;
      recommendedRiskHint: string;
    }
  | {
      kind: 'VEHICLE_AGE';
      expectedLabel: string;
      minInclusive?: number;
      maxExclusive?: number;
      recommendedRiskHint: string;
    };

export interface ApprovedMotorFactorDefinition {
  code: string;
  name: string;
  data_type: FactorDataType;
  unit: FactorUnit;
  default_value: string | null;
}

export const APPROVED_MOTOR_FACTORS: ApprovedMotorFactorDefinition[] = [
  {
    code: 'sum_insured',
    name: 'Sum Insured',
    data_type: FactorDataType.DECIMAL,
    unit: FactorUnit.CURRENCY,
    default_value: null,
  },
  {
    code: 'seat_capacity',
    name: 'Seat Capacity',
    data_type: FactorDataType.INTEGER,
    unit: FactorUnit.SEAT,
    default_value: null,
  },
  {
    code: 'gross_weight_tons',
    name: 'Gross Weight',
    data_type: FactorDataType.DECIMAL,
    unit: FactorUnit.TONNE,
    default_value: null,
  },
  {
    code: 'year_of_manufacture',
    name: 'Year of Manufacture',
    data_type: FactorDataType.INTEGER,
    unit: FactorUnit.YEAR,
    default_value: null,
  },
];

export function isMotorProductCode(productCode: string | null | undefined): boolean {
  return MOTOR_PRODUCT_CODES.includes(
    (productCode ?? '').trim().toUpperCase() as (typeof MOTOR_PRODUCT_CODES)[number],
  );
}

export function resolveMotorRateBookCode(productCode: string): string {
  switch (productCode.trim().toUpperCase()) {
    case 'SP014001000000':
      return 'MOTOR_PRIVATE_VEHICLE';
    case 'SP014002000000':
      return 'MOTOR_MOTOR_CYCLE';
    case 'SP014003000000':
      return 'MOTOR_COMMERCIAL_VEHICLE';
    case 'SP014004000000':
      return 'MOTOR_PASSENGER_CARRYING';
    case 'SP014005000000':
      return 'MOTOR_SPECIAL_TYPE_VEHICLE';
    default:
      return `MOTOR_${productCode.trim().toUpperCase()}`;
  }
}

export function deriveMotorRequiredFactorCodes(params: {
  riskName: string;
  rateType: RateType;
  perUnitFactorCode?: string | null;
}): string[] {
  const required = new Set<string>();
  const normalizedRiskName = params.riskName.toLowerCase();

  switch (params.rateType) {
    case RateType.PERCENTAGE:
    case RateType.PERCENTAGE_PLUS_FIXED:
    case RateType.PERCENTAGE_PLUS_PER_UNIT:
      required.add('sum_insured');
      break;
    case RateType.FIXED:
    case RateType.PER_UNIT:
    case RateType.FORMULA:
    default:
      break;
  }

  if (params.perUnitFactorCode?.trim().toLowerCase() === 'seat_capacity') {
    required.add('seat_capacity');
  }

  const constraint = deriveMotorSelectionConstraint(normalizedRiskName);
  if (constraint?.kind === 'WEIGHT_BAND') {
    required.add('gross_weight_tons');
  }
  if (constraint?.kind === 'VEHICLE_AGE') {
    required.add('year_of_manufacture');
  }

  return Array.from(required);
}

export function deriveMotorSelectionConstraint(
  riskName: string,
): MotorSelectionConstraint | null {
  const normalizedRiskName = riskName.trim().toLowerCase();

  if (normalizedRiskName.includes('up to 2 tonnes')) {
    return {
      kind: 'WEIGHT_BAND',
      expectedLabel: 'weight > 0 and weight <= 2 tonnes',
      minExclusive: 0,
      maxInclusive: 2,
      recommendedRiskHint: 'up to 2 tonnes',
    };
  }
  if (normalizedRiskName.includes('above 2 to 5 tonnes')) {
    return {
      kind: 'WEIGHT_BAND',
      expectedLabel: 'weight > 2 and weight <= 5 tonnes',
      minExclusive: 2,
      maxInclusive: 5,
      recommendedRiskHint: 'above 2 to 5 tonnes',
    };
  }
  if (
    normalizedRiskName.includes('in excess of 5 tonnes but less than 10 tonnes') ||
    normalizedRiskName.includes('in excess of 5 tonnes but less in 10 tonnes')
  ) {
    return {
      kind: 'WEIGHT_BAND',
      expectedLabel: 'weight > 5 and weight < 10 tonnes',
      minExclusive: 5,
      maxExclusive: 10,
      recommendedRiskHint: 'in excess of 5 tonnes but less than 10 tonnes',
    };
  }
  if (normalizedRiskName.includes('in excess of 10 tonnes')) {
    return {
      kind: 'WEIGHT_BAND',
      expectedLabel: 'weight >= 10 tonnes',
      minInclusive: 10,
      recommendedRiskHint: 'in excess of 10 tonnes',
    };
  }
  if (
    normalizedRiskName.includes('less than 10 years old') ||
    normalizedRiskName.includes('below 10 years')
  ) {
    return {
      kind: 'VEHICLE_AGE',
      expectedLabel: 'vehicle age below 10 years',
      maxExclusive: 10,
      recommendedRiskHint: 'below 10 years',
    };
  }
  if (
    normalizedRiskName.includes('over 10 years old') ||
    normalizedRiskName.includes('over 10 years')
  ) {
    return {
      kind: 'VEHICLE_AGE',
      expectedLabel: 'vehicle age 10 years or above',
      minInclusive: 10,
      recommendedRiskHint: 'over 10 years',
    };
  }

  return null;
}

