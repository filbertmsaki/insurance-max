import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export const TIRAMIS_MESSAGE_PATTERNS = {
  HEALTH: 'tiramis.health',
  STATUS: 'tiramis.submission.status',
  TRACE: 'tiramis.submission.trace',
  SUBMIT_NON_MOTOR: 'tiramis.non_motor.submit',
  SUBMIT_MOTOR: 'tiramis.motor.submit',
  SUBMIT_MOTOR_FLEET: 'tiramis.motor_fleet.submit',
  SUBMIT_REINSURANCE: 'tiramis.reinsurance.submit',
  SUBMIT_POLICY: 'tiramis.policy.submit',
  SUBMIT_CLAIM_NOTIFICATION: 'tiramis.claim.notification.submit',
  SUBMIT_CLAIM_INTIMATION: 'tiramis.claim.intimation.submit',
  SUBMIT_CLAIM_ASSESSMENT: 'tiramis.claim.assessment.submit',
  SUBMIT_DISCHARGE_VOUCHER: 'tiramis.claim.discharge_voucher.submit',
  SUBMIT_CLAIM_PAYMENT: 'tiramis.claim.payment.submit',
  SUBMIT_CLAIM_REJECTION: 'tiramis.claim.rejection.submit',
  SUBMIT_COVER_NOTE_VERIFICATION: 'tiramis.verification.cover_note.submit',
  SUBMIT_MOTOR_VERIFICATION: 'tiramis.verification.motor.submit',
  SUBMIT_NIN_VERIFICATION: 'tiramis.verification.nin.submit',
  SUBMIT_COMPANY_VERIFICATION: 'tiramis.verification.company.submit',
  SUBMIT_DETAILS_VERIFICATION: 'tiramis.verification.details.submit',
} as const;

export const TIRAMIS_SUBMIT_PATTERN_BY_REQUEST_TYPE: Record<
  TiramisRequestType,
  string
> = {
  [TiramisRequestType.NON_MOTOR]: TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NON_MOTOR,
  [TiramisRequestType.MOTOR]: TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR,
  [TiramisRequestType.MOTOR_FLEET]: TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET,
  [TiramisRequestType.REINSURANCE]: TIRAMIS_MESSAGE_PATTERNS.SUBMIT_REINSURANCE,
  [TiramisRequestType.POLICY]: TIRAMIS_MESSAGE_PATTERNS.SUBMIT_POLICY,
  [TiramisRequestType.CLAIM_NOTIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_NOTIFICATION,
  [TiramisRequestType.CLAIM_INTIMATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_INTIMATION,
  [TiramisRequestType.CLAIM_ASSESSMENT]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_ASSESSMENT,
  [TiramisRequestType.DISCHARGE_VOUCHER]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_DISCHARGE_VOUCHER,
  [TiramisRequestType.CLAIM_PAYMENT]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_PAYMENT,
  [TiramisRequestType.CLAIM_REJECTION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_REJECTION,
  [TiramisRequestType.COVER_NOTE_VERIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION,
  [TiramisRequestType.MOTOR_VERIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_VERIFICATION,
  [TiramisRequestType.NIN_VERIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NIN_VERIFICATION,
  [TiramisRequestType.COMPANY_VERIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COMPANY_VERIFICATION,
  [TiramisRequestType.DETAILS_VERIFICATION]:
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_DETAILS_VERIFICATION,
};
