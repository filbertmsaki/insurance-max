export const TIRAMIS_VERIFICATION_TYPE = {
  COVER_NOTE: 'COVER_NOTE',
  NIN: 'NIN',
  COMPANY: 'COMPANY',
  MOTOR: 'MOTOR',
} as const;

export enum MotorCategory {
  MOTOR_VEHICLE = 1,
  MOTORCYCLE = 2,
}

export function isMotorCategory(value: unknown): value is MotorCategory {
  return (
    typeof value === 'number' &&
    (value === MotorCategory.MOTOR_VEHICLE ||
      value === MotorCategory.MOTORCYCLE)
  );
}

export const TIRAMIS_VERIFICATION_SERVICE_TYPE = {
  COVER_NOTE_VERIFICATION: 'COVER_NOTE_VERIFICATION',
  NIN_VERIFICATION: 'NIN_VERIFICATION',
  COMPANY_VERIFICATION: 'COMPANY_VERIFICATION',
  MOTOR_VERIFICATION: 'MOTOR_VERIFICATION',
} as const;

export const TIRAMIS_VERIFICATION_ROOT_ELEMENT = {
  COVER_NOTE: 'CoverNoteVerificationReq',
  NIN: 'NINVerificationReq',
  COMPANY: 'CompanyVerificationReq',
  MOTOR: 'MotorVerificationReq',
} as const;

export const TIRAMIS_VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
} as const;
