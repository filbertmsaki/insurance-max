export const TIRAMIS_CALLBACK_ROOTS = {
  COVER_NOTE_RESPONSE: 'CoverNoteRefRes',
  MOTOR_COVER_NOTE_RESPONSE: 'MotorCoverNoteRefRes',
  REINSURANCE_RESPONSE: 'ReinsuranceRes',
  POLICY_RESPONSE: 'PolicyRes',
  CLAIM_NOTIFICATION_RESPONSE: 'ClaimNotificationRefRes',
  CLAIM_INTIMATION_RESPONSE: 'ClaimIntimationRes',
  CLAIM_ASSESSMENT_RESPONSE: 'ClaimAssessmentRes',
  DISCHARGE_VOUCHER_RESPONSE: 'DischargeVoucherRes',
  CLAIM_PAYMENT_RESPONSE: 'ClaimPaymentRes',
  CLAIM_REJECTION_RESPONSE: 'ClaimRejectionRes',
} as const;

export const TIRAMIS_CALLBACK_ACK_ROOTS: Record<string, string> = {
  CoverNoteRefRes: 'CoverNoteRefResAck',
  MotorCoverNoteRefRes: 'MotorCoverNoteRefResAck',
  ReinsuranceRes: 'ReinsuranceResAck',
  PolicyRes: 'PolicyResAck',
  ClaimNotificationRefRes: 'ClaimNotificationRefResAck',
  ClaimIntimationRes: 'ClaimIntimationResAck',
  ClaimAssessmentRes: 'ClaimAssessmentResAck',
  DischargeVoucherRes: 'DischargeVoucherResAck',
  ClaimPaymentRes: 'ClaimPaymentResAck',
  ClaimRejectionRes: 'ClaimRejectionResAck',
};

export const TIRAMIS_CALLBACK_ACK_STATUS = {
  SUCCESS_CODE: 'TIRA001',
  SUCCESS_DESC: 'Successful',
  FAILED_CODE: 'TIRA002',
  FAILED_DESC: 'Failed',
} as const;
