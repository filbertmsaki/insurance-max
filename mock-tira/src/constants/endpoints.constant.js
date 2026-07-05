const ACK_ROOTS = {
  CoverNoteRefReq: 'CoverNoteRefReqAck',
  MotorCoverNoteRefReq: 'MotorCoverNoteRefReqAck',
  ReinsuranceReq: 'ReinsuranceReqAck',
  PolicyReq: 'PolicyReqAck',

  ClaimNotificationRefReq: 'ClaimNotificationRefReqAck',
  ClaimIntimationReq: 'ClaimIntimationReqAck',
  ClaimAssessmentReq: 'ClaimAssessmentReqAck',
  DischargeVoucherReq: 'DischargeVoucherReqAck',
  ClaimPaymentReq: 'ClaimPaymentReqAck',
  ClaimRejectionReq: 'ClaimRejectionReqAck',
};

const ASYNC_RESPONSE_ROOTS = {
  CoverNoteRefReq: 'CoverNoteRefRes',
  MotorCoverNoteRefReq: 'MotorCoverNoteRefRes',
  ReinsuranceReq: 'ReinsuranceRes',
  PolicyReq: 'PolicyRes',

  ClaimNotificationRefReq: 'ClaimNotificationRefRes',
  ClaimIntimationReq: 'ClaimIntimationRes',
  ClaimAssessmentReq: 'ClaimAssessmentRes',
  DischargeVoucherReq: 'DischargeVoucherRes',
  ClaimPaymentReq: 'ClaimPaymentRes',
  ClaimRejectionReq: 'ClaimRejectionRes',
};

const SYNC_RESPONSE_ROOTS = {
  CoverNoteVerificationReq: 'CoverNoteVerificationRes',
  NINVerificationReq: 'NINVerificationRes',
  CompanyVerificationReq: 'CompanyVerificationRes',
  MotorVerificationReq: 'MotorVerificationRes',
  DetailsVerificationReq: 'DetailsVerificationRes',
};

const SEEDED_SERVICE_ENDPOINTS = [
  {
    serviceType: 'COVER_NOTE_NON_MOTOR',
    endpointUrl: '/ecovernote/api/covernote/non-life/other/v2/request',
    requestRoots: ['CoverNoteRefReq'],
    mode: 'async',
  },
  {
    serviceType: 'MOTOR_COVER_NOTE_NON_FLEET',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor/v2/request',
    requestRoots: ['MotorCoverNoteRefReq'],
    mode: 'async',
  },
  {
    serviceType: 'MOTOR_COVER_NOTE_FLEET',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor-fleet/v2/request',
    requestRoots: ['MotorCoverNoteRefReq'],
    mode: 'async',
  },
  {
    serviceType: 'REINSURANCE',
    endpointUrl: '/ecovernote/api/reinsurance/v1/request',
    requestRoots: ['ReinsuranceReq'],
    mode: 'async',
  },
  {
    serviceType: 'POLICY',
    endpointUrl: '/ecovernote/api/policy/v1/request',
    requestRoots: ['PolicyReq'],
    mode: 'async',
  },
  {
    serviceType: 'CLAIM_NOTIFICATION',
    endpointUrl: '/eclaim/api/claim/claim-notification/v1/request',
    requestRoots: ['ClaimNotificationRefReq'],
    mode: 'async',
  },
  {
    serviceType: 'CLAIM_INTIMATION',
    endpointUrl: '/eclaim/api/claim/claim-intimation/v1/request',
    requestRoots: ['ClaimIntimationReq'],
    mode: 'async',
  },
  {
    serviceType: 'CLAIM_ASSESSMENT',
    endpointUrl: '/eclaim/api/claim/claim-assessment/v1/request',
    requestRoots: ['ClaimAssessmentReq'],
    mode: 'async',
  },
  {
    serviceType: 'DISCHARGE_VOUCHER',
    endpointUrl: '/eclaim/api/claim/claim-dischargevoucher/v1/request',
    requestRoots: ['DischargeVoucherReq'],
    mode: 'async',
  },
  {
    serviceType: 'CLAIM_PAYMENT',
    endpointUrl: '/eclaim/api/claim/claim-payment/v1/request',
    requestRoots: ['ClaimPaymentReq'],
    mode: 'async',
  },
  {
    serviceType: 'CLAIM_REJECTION',
    endpointUrl: '/eclaim/api/claim/claim-rejection/v1/request',
    requestRoots: ['ClaimRejectionReq'],
    mode: 'async',
  },
  {
    serviceType: 'COVER_NOTE_VERIFICATION',
    endpointUrl: '/ecovernote/api/covernote/verification/min/v1/request',
    requestRoots: ['CoverNoteVerificationReq'],
    mode: 'sync',
  },
  {
    serviceType: 'MOTOR_VERIFICATION',
    endpointUrl: '/dispatch/api/motor/verification/v3/request',
    requestRoots: ['MotorVerificationReq'],
    mode: 'sync',
  },
];

const LEGACY_MOCK_ENDPOINT = {
  serviceType: 'LEGACY_MOCK_GATEWAY',
  endpointUrl: '/tiramis/mock',
  requestRoots: [
    ...Object.keys(ACK_ROOTS),
    ...Object.keys(SYNC_RESPONSE_ROOTS),
  ],
  mode: 'auto',
};

const MOCKED_ENDPOINTS = [LEGACY_MOCK_ENDPOINT, ...SEEDED_SERVICE_ENDPOINTS];

module.exports = {
  ACK_ROOTS,
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
  SEEDED_SERVICE_ENDPOINTS,
  LEGACY_MOCK_ENDPOINT,
  MOCKED_ENDPOINTS,
};
