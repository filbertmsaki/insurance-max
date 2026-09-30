export const ClaimRegulatoryOperationType = {
  NOTIFICATION: 'NOTIFICATION',
  INTIMATION: 'INTIMATION',
  ASSESSMENT: 'ASSESSMENT',
  DISCHARGE_VOUCHER: 'DISCHARGE_VOUCHER',
  PAYMENT: 'PAYMENT',
  REJECTION: 'REJECTION',
} as const;

export type ClaimRegulatoryOperationType =
  (typeof ClaimRegulatoryOperationType)[keyof typeof ClaimRegulatoryOperationType];

export const ClaimReserveMovementType = {
  INITIAL: 'INITIAL',
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
  RELEASE: 'RELEASE',
  REOPEN: 'REOPEN',
  ASSESSMENT_ADJUSTMENT: 'ASSESSMENT_ADJUSTMENT',
  PAYMENT_REDUCTION: 'PAYMENT_REDUCTION',
  RECOVERY: 'RECOVERY',
  CLOSURE_ADJUSTMENT: 'CLOSURE_ADJUSTMENT',
} as const;

export type ClaimReserveMovementType =
  (typeof ClaimReserveMovementType)[keyof typeof ClaimReserveMovementType];

export const ClaimPaymentType = {
  INDEMNITY: 'INDEMNITY',
  ASSESSOR_FEE: 'ASSESSOR_FEE',
  LEGAL_FEE: 'LEGAL_FEE',
  MEDICAL_EXPENSE: 'MEDICAL_EXPENSE',
  REPAIRER_PAYMENT: 'REPAIRER_PAYMENT',
  TOWING_EXPENSE: 'TOWING_EXPENSE',
  INVESTIGATION_EXPENSE: 'INVESTIGATION_EXPENSE',
  OTHER_EXPENSE: 'OTHER_EXPENSE',
} as const;

export type ClaimPaymentType =
  (typeof ClaimPaymentType)[keyof typeof ClaimPaymentType];

export const ClaimDecisionType = {
  ADMIT: 'ADMIT',
  PARTIALLY_ADMIT: 'PARTIALLY_ADMIT',
  DENY: 'DENY',
  REQUEST_REASSESSMENT: 'REQUEST_REASSESSMENT',
} as const;

export type ClaimDecisionType =
  (typeof ClaimDecisionType)[keyof typeof ClaimDecisionType];

export const ClaimSourceChannel = {
  INTERNAL: 'INTERNAL',
  CUSTOMER_PORTAL: 'CUSTOMER_PORTAL',
  INTERMEDIARY_PORTAL: 'INTERMEDIARY_PORTAL',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WALK_IN: 'WALK_IN',
  OTHER: 'OTHER',
} as const;

export type ClaimSourceChannel =
  (typeof ClaimSourceChannel)[keyof typeof ClaimSourceChannel];
