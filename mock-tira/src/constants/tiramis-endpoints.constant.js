function createEndpoint(params) {
  return {
    serviceType: params.serviceType,
    endpointUrl: params.endpointUrl,
    requestRoots: params.requestRoots,
    mode: params.mode,
    aliases: params.aliases || [],
  };
}

const CANONICAL_SERVICE_ENDPOINTS = [
  createEndpoint({
    serviceType: 'NON_MOTOR',
    endpointUrl: '/ecovernote/api/covernote/non-life/other/v2/request',
    requestRoots: ['CoverNoteRefReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/covernote/v1/request',
      '/ecovernote/api/covernote/non-motor/v1/request',
      '/ecovernote/api/covernote/non-life/other/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'MOTOR',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor/v2/request',
    requestRoots: ['MotorCoverNoteRefReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/motor/covernote/v1/request',
      '/ecovernote/api/covernote/motor/v1/request',
      '/ecovernote/api/covernote/non-life/motor/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'MOTOR_FLEET',
    endpointUrl: '/ecovernote/api/covernote/non-life/motor-fleet/v2/request',
    requestRoots: ['MotorCoverNoteRefReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/motor/fleet/covernote/v1/request',
      '/ecovernote/api/covernote/motor-fleet/v1/request',
      '/ecovernote/api/covernote/non-life/motor-fleet/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'REINSURANCE',
    endpointUrl: '/ecovernote/api/reinsurance/v1/request',
    requestRoots: ['ReinsuranceReq'],
    mode: 'async',
    aliases: [],
  }),
  createEndpoint({
    serviceType: 'POLICY',
    endpointUrl: '/ecovernote/api/policy/v1/request',
    requestRoots: ['PolicyReq'],
    mode: 'async',
    aliases: [],
  }),
  createEndpoint({
    serviceType: 'CLAIM_NOTIFICATION',
    endpointUrl: '/eclaim/api/claim/claim-notification/v1/request',
    requestRoots: ['ClaimNotificationRefReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/notification/v1/request',
      '/eclaim/api/claim/notification/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'CLAIM_INTIMATION',
    endpointUrl: '/eclaim/api/claim/claim-intimation/v1/request',
    requestRoots: ['ClaimIntimationReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/intimation/v1/request',
      '/eclaim/api/claim/intimation/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'CLAIM_ASSESSMENT',
    endpointUrl: '/eclaim/api/claim/claim-assessment/v1/request',
    requestRoots: ['ClaimAssessmentReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/assessment/v1/request',
      '/eclaim/api/claim/assessment/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'DISCHARGE_VOUCHER',
    endpointUrl: '/eclaim/api/claim/claim-dischargevoucher/v1/request',
    requestRoots: ['DischargeVoucherReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/discharge-voucher/v1/request',
      '/eclaim/api/claim/discharge-voucher/v1/request',
      '/eclaim/api/claim/claim-discharge-voucher/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'CLAIM_PAYMENT',
    endpointUrl: '/eclaim/api/claim/claim-payment/v1/request',
    requestRoots: ['ClaimPaymentReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/payment/v1/request',
      '/eclaim/api/claim/payment/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'CLAIM_REJECTION',
    endpointUrl: '/eclaim/api/claim/claim-rejection/v1/request',
    requestRoots: ['ClaimRejectionReq'],
    mode: 'async',
    aliases: [
      '/ecovernote/api/claim/rejection/v1/request',
      '/eclaim/api/claim/rejection/v1/request',
    ],
  }),
  createEndpoint({
    serviceType: 'COVER_NOTE_VERIFICATION',
    endpointUrl: '/ecovernote/api/covernote/verification/min/v1/request',
    requestRoots: ['CoverNoteVerificationReq'],
    mode: 'sync',
    aliases: [
      '/ecovernote/api/covernote/verification/v1/request',
      '/ecovernote/api/covernote/verification/request',
    ],
  }),
  createEndpoint({
    serviceType: 'MOTOR_VERIFICATION',
    endpointUrl: '/dispatch/api/motor/verification/v3/request',
    requestRoots: ['MotorVerificationReq'],
    mode: 'sync',
    aliases: [
      '/ecovernote/api/motor/verification/v1/request',
      '/dispatch/api/motor/verification/v1/request',
      '/dispatch/api/motor/verification/request',
    ],
  }),
  createEndpoint({
    serviceType: 'NIN_VERIFICATION',
    endpointUrl: '/dispatch/api/nin/verification/v1/request',
    requestRoots: ['NINVerificationReq'],
    mode: 'sync',
    aliases: [
      '/ecovernote/api/nin/verification/v1/request',
      '/dispatch/api/nin/verification/request',
    ],
  }),
  createEndpoint({
    serviceType: 'COMPANY_VERIFICATION',
    endpointUrl: '/dispatch/api/company/verification/v1/request',
    requestRoots: ['CompanyVerificationReq'],
    mode: 'sync',
    aliases: [
      '/ecovernote/api/company/verification/v1/request',
      '/dispatch/api/company/verification/request',
    ],
  }),
  createEndpoint({
    serviceType: 'DETAILS_VERIFICATION',
    endpointUrl: '/dispatch/api/details/verification/v1/request',
    requestRoots: ['DetailsVerificationReq'],
    mode: 'sync',
    aliases: [
      '/ecovernote/api/details/verification/v1/request',
      '/dispatch/api/details/verification/request',
    ],
  }),
];

function flattenEndpointsWithAliases() {
  const routes = [];

  for (const endpoint of CANONICAL_SERVICE_ENDPOINTS) {
    routes.push({
      ...endpoint,
      canonicalEndpointUrl: endpoint.endpointUrl,
      isAlias: false,
      aliasOf: null,
    });

    for (const alias of endpoint.aliases || []) {
      routes.push({
        ...endpoint,
        endpointUrl: alias,
        canonicalEndpointUrl: endpoint.endpointUrl,
        isAlias: true,
        aliasOf: endpoint.endpointUrl,
      });
    }
  }

  return routes;
}

const SEEDED_SERVICE_ENDPOINTS = flattenEndpointsWithAliases();

const LEGACY_MOCK_ENDPOINT = {
  serviceType: 'LEGACY_MOCK',
  endpointUrl: '/tiramis/mock',
  requestRoots: [
    'CoverNoteRefReq',
    'MotorCoverNoteRefReq',
    'ReinsuranceReq',
    'PolicyReq',
    'ClaimNotificationRefReq',
    'ClaimIntimationReq',
    'ClaimAssessmentReq',
    'DischargeVoucherReq',
    'ClaimPaymentReq',
    'ClaimRejectionReq',
    'CoverNoteVerificationReq',
    'MotorVerificationReq',
    'NINVerificationReq',
    'CompanyVerificationReq',
    'DetailsVerificationReq',
  ],
  mode: 'mixed',
  aliases: [],
};

function findCanonicalEndpointByServiceType(serviceType) {
  const normalized = String(serviceType || '').trim().toUpperCase();

  return (
    CANONICAL_SERVICE_ENDPOINTS.find(
      (item) => String(item.serviceType).toUpperCase() === normalized,
    ) || null
  );
}

function findCanonicalEndpointByRoot(root) {
  return (
    CANONICAL_SERVICE_ENDPOINTS.find((item) =>
      item.requestRoots.includes(root),
    ) || null
  );
}

module.exports = {
  CANONICAL_SERVICE_ENDPOINTS,
  SEEDED_SERVICE_ENDPOINTS,
  LEGACY_MOCK_ENDPOINT,
  findCanonicalEndpointByServiceType,
  findCanonicalEndpointByRoot,
};
