const ASYNC_RESPONSE_ROOTS = {
  CoverNoteRefReq: {
    ackRoot: 'CoverNoteRefReqAck',
    finalRoot: 'CoverNoteRefRes',
    finalAckRoot: 'CoverNoteRefResAck',
    serviceType: 'NON_MOTOR',
  },

  MotorCoverNoteRefReq: {
    ackRoot: 'MotorCoverNoteRefReqAck',
    finalRoot: 'MotorCoverNoteRefRes',
    finalAckRoot: 'MotorCoverNoteRefResAck',
    serviceType: 'MOTOR',
  },

  ReinsuranceReq: {
    ackRoot: 'ReinsuranceReqAck',
    finalRoot: 'ReinsuranceRes',
    finalAckRoot: 'ReinsuranceResAck',
    serviceType: 'REINSURANCE',
  },

  PolicyReq: {
    ackRoot: 'PolicyReqAck',
    finalRoot: 'PolicyRes',
    finalAckRoot: 'PolicyResAck',
    serviceType: 'POLICY',
  },

  ClaimNotificationRefReq: {
    ackRoot: 'ClaimNotificationRefReqAck',
    finalRoot: 'ClaimNotificationRefRes',
    finalAckRoot: 'ClaimNotificationRefResAck',
    serviceType: 'CLAIM_NOTIFICATION',
  },

  ClaimIntimationReq: {
    ackRoot: 'ClaimIntimationReqAck',
    finalRoot: 'ClaimIntimationRes',
    finalAckRoot: 'ClaimIntimationResAck',
    serviceType: 'CLAIM_INTIMATION',
  },

  ClaimAssessmentReq: {
    ackRoot: 'ClaimAssessmentReqAck',
    finalRoot: 'ClaimAssessmentRes',
    finalAckRoot: 'ClaimAssessmentResAck',
    serviceType: 'CLAIM_ASSESSMENT',
  },

  DischargeVoucherReq: {
    ackRoot: 'DischargeVoucherReqAck',
    finalRoot: 'DischargeVoucherRes',
    finalAckRoot: 'DischargeVoucherResAck',
    serviceType: 'DISCHARGE_VOUCHER',
  },

  ClaimPaymentReq: {
    ackRoot: 'ClaimPaymentReqAck',
    finalRoot: 'ClaimPaymentRes',
    finalAckRoot: 'ClaimPaymentResAck',
    serviceType: 'CLAIM_PAYMENT',
  },

  ClaimRejectionReq: {
    ackRoot: 'ClaimRejectionReqAck',
    finalRoot: 'ClaimRejectionRes',
    finalAckRoot: 'ClaimRejectionResAck',
    serviceType: 'CLAIM_REJECTION',
  },
};

const SYNC_RESPONSE_ROOTS = {
  CoverNoteVerificationReq: {
    responseRoot: 'CoverNoteVerificationRes',
    serviceType: 'COVER_NOTE_VERIFICATION',
  },

  MotorVerificationReq: {
    responseRoot: 'MotorVerificationRes',
    serviceType: 'MOTOR_VERIFICATION',
  },

  NINVerificationReq: {
    responseRoot: 'NINVerificationRes',
    serviceType: 'NIN_VERIFICATION',
  },

  CompanyVerificationReq: {
    responseRoot: 'CompanyVerificationRes',
    serviceType: 'COMPANY_VERIFICATION',
  },

};

function isAsyncRoot(root) {
  return !!ASYNC_RESPONSE_ROOTS[root];
}

function isSyncRoot(root) {
  return !!SYNC_RESPONSE_ROOTS[root];
}

function getFinalAckRootForRequestRoot(requestRoot) {
  return ASYNC_RESPONSE_ROOTS[requestRoot]?.finalAckRoot || null;
}

function getFinalRootForRequestRoot(requestRoot) {
  return ASYNC_RESPONSE_ROOTS[requestRoot]?.finalRoot || null;
}

function getRequestRootByFinalRoot(finalRoot) {
  return (
    Object.keys(ASYNC_RESPONSE_ROOTS).find(
      (requestRoot) =>
        ASYNC_RESPONSE_ROOTS[requestRoot].finalRoot === finalRoot,
    ) || null
  );
}

module.exports = {
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
  isAsyncRoot,
  isSyncRoot,
  getFinalAckRootForRequestRoot,
  getFinalRootForRequestRoot,
  getRequestRootByFinalRoot,
};
