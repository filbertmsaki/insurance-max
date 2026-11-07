import { UnderwriteLine } from '@insurance-max/contracts';
import type { MotorInsuranceType } from './api';

export const MOTOR_INSURANCE_TYPES: Array<{
  type: MotorInsuranceType;
  line: UnderwriteLine;
  label: string;
  description: string;
}> = [
  {
    type: 'single',
    line: UnderwriteLine.MOTOR,
    label: 'Single Motor',
    description: 'Insure one vehicle under one cover note.',
  },
  {
    type: 'fleet',
    line: UnderwriteLine.FLEET,
    label: 'Fleet',
    description:
      'Insure two or more vehicles together under one Fleet ID, each with its own cover note.',
  },
];

export function typeForLine(line: UnderwriteLine): MotorInsuranceType | null {
  return MOTOR_INSURANCE_TYPES.find((item) => item.line === line)?.type ?? null;
}
