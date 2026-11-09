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

/** What the Create Quotation chooser offers; short-term is not a line. */
export type MotorQuotationKind = MotorInsuranceType | 'short-term';

export const MOTOR_QUOTATION_KINDS: Array<{
  type: MotorQuotationKind;
  /** Line the user must be allowed to create on. */
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
    label: 'Fleet Motor',
    description:
      'Insure two or more vehicles together under one Fleet ID, each with its own cover note.',
  },
  {
    type: 'short-term',
    // Single mode drafts on the Motor line; Fleet mode also needs Fleet.
    line: UnderwriteLine.MOTOR,
    label: 'Short-Term (In-Transit)',
    description:
      'A 30-day transit cover for one vehicle or a fleet, with the cover details filled in for you.',
  },
];

export function typeForLine(line: UnderwriteLine): MotorInsuranceType | null {
  return MOTOR_INSURANCE_TYPES.find((item) => item.line === line)?.type ?? null;
}
