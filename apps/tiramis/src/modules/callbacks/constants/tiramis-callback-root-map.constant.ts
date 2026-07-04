export type TiramisCallbackBusinessTarget =
  | 'COVER_NOTE'
  | 'MOTOR'
  | 'REINSURANCE'
  | 'POLICY'
  | 'CLAIM';

export interface TiramisCallbackRootDefinition {
  responseRoot: string;
  responseAckRoot: string;
  serviceType: string;
  businessTarget: TiramisCallbackBusinessTarget;
}

export const TIRAMIS_CALLBACK_RESPONSE_ROOTS: Record<
  string,
  TiramisCallbackRootDefinition
> = {
  CoverNoteRefRes: {
    responseRoot: 'CoverNoteRefRes',
    responseAckRoot: 'CoverNoteRefResAck',
    serviceType: 'NON_MOTOR',
    businessTarget: 'COVER_NOTE',
  },
  MotorCoverNoteRefRes: {
    responseRoot: 'MotorCoverNoteRefRes',
    responseAckRoot: 'MotorCoverNoteRefResAck',
    serviceType: 'MOTOR',
    businessTarget: 'MOTOR',
  },
  ReinsuranceRes: {
    responseRoot: 'ReinsuranceRes',
    responseAckRoot: 'ReinsuranceResAck',
    serviceType: 'REINSURANCE',
    businessTarget: 'REINSURANCE',
  },
  PolicyRes: {
    responseRoot: 'PolicyRes',
    responseAckRoot: 'PolicyResAck',
    serviceType: 'POLICY',
    businessTarget: 'POLICY',
  },
  ClaimNotificationRefRes: {
    responseRoot: 'ClaimNotificationRefRes',
    responseAckRoot: 'ClaimNotificationRefResAck',
    serviceType: 'CLAIM_NOTIFICATION',
    businessTarget: 'CLAIM',
  },
  ClaimIntimationRes: {
    responseRoot: 'ClaimIntimationRes',
    responseAckRoot: 'ClaimIntimationResAck',
    serviceType: 'CLAIM_INTIMATION',
    businessTarget: 'CLAIM',
  },
  ClaimAssessmentRes: {
    responseRoot: 'ClaimAssessmentRes',
    responseAckRoot: 'ClaimAssessmentResAck',
    serviceType: 'CLAIM_ASSESSMENT',
    businessTarget: 'CLAIM',
  },
  DischargeVoucherRes: {
    responseRoot: 'DischargeVoucherRes',
    responseAckRoot: 'DischargeVoucherResAck',
    serviceType: 'DISCHARGE_VOUCHER',
    businessTarget: 'CLAIM',
  },
  ClaimPaymentRes: {
    responseRoot: 'ClaimPaymentRes',
    responseAckRoot: 'ClaimPaymentResAck',
    serviceType: 'CLAIM_PAYMENT',
    businessTarget: 'CLAIM',
  },
  ClaimRejectionRes: {
    responseRoot: 'ClaimRejectionRes',
    responseAckRoot: 'ClaimRejectionResAck',
    serviceType: 'CLAIM_REJECTION',
    businessTarget: 'CLAIM',
  },
};

export function getTiramisCallbackRootDefinition(
  responseRoot: string,
): TiramisCallbackRootDefinition | null {
  return TIRAMIS_CALLBACK_RESPONSE_ROOTS[responseRoot] || null;
}
