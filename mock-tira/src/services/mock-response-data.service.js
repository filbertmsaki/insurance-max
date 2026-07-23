const { CONFIG } = require('../config/mock-config');
const { getTag } = require('../utils/xml.util');

const RUNTIME_RESPONSE_CONFIG = {
  coverNoteReferenceNumber: null,
  motorCoverNoteReferenceNumber: null,
  stickerNumber: null,
  policyReferenceNumber: null,
  reinsuranceReferenceNumber: null,
  claimReferenceNumber: null,

  verificationStatus: null,
  verificationMessage: null,
  verificationFullName: null,
  verificationCompanyName: null,

  customFields: {},
};

function getRuntimeResponseConfig() {
  return {
    ...RUNTIME_RESPONSE_CONFIG,
  };
}

function updateRuntimeResponseConfig(payload = {}) {
  const allowedKeys = [
    'coverNoteReferenceNumber',
    'motorCoverNoteReferenceNumber',
    'stickerNumber',
    'policyReferenceNumber',
    'reinsuranceReferenceNumber',
    'claimReferenceNumber',
    'verificationStatus',
    'verificationMessage',
    'verificationFullName',
    'verificationCompanyName',
  ];

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      RUNTIME_RESPONSE_CONFIG[key] = payload[key] || null;
    }
  }

  if (payload.customFields && typeof payload.customFields === 'object') {
    RUNTIME_RESPONSE_CONFIG.customFields = {
      ...RUNTIME_RESPONSE_CONFIG.customFields,
      ...payload.customFields,
    };
  }

  return getRuntimeResponseConfig();
}

function resetRuntimeResponseConfig() {
  RUNTIME_RESPONSE_CONFIG.coverNoteReferenceNumber = null;
  RUNTIME_RESPONSE_CONFIG.motorCoverNoteReferenceNumber = null;
  RUNTIME_RESPONSE_CONFIG.stickerNumber = null;
  RUNTIME_RESPONSE_CONFIG.policyReferenceNumber = null;
  RUNTIME_RESPONSE_CONFIG.reinsuranceReferenceNumber = null;
  RUNTIME_RESPONSE_CONFIG.claimReferenceNumber = null;

  RUNTIME_RESPONSE_CONFIG.verificationStatus = null;
  RUNTIME_RESPONSE_CONFIG.verificationMessage = null;
  RUNTIME_RESPONSE_CONFIG.verificationFullName = null;
  RUNTIME_RESPONSE_CONFIG.verificationCompanyName = null;

  RUNTIME_RESPONSE_CONFIG.customFields = {};

  return getRuntimeResponseConfig();
}

function buildReference(prefix, requestId) {
  const safePrefix = String(prefix || 'MOCK').trim();

  if (CONFIG.responseUseRequestId && requestId) {
    return `${safePrefix}-${requestId}`;
  }

  return `${safePrefix}-${Date.now()}`;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return null;
}

function header(req, name) {
  if (!req) {
    return null;
  }

  return req.header(name) || null;
}

function query(req, name) {
  if (!req) {
    return null;
  }

  return req.query?.[name] || null;
}

function extractResponseOverrides(req, xml) {
  if (!CONFIG.allowResponseOverrides) {
    return {};
  }

  return {
    coverNoteReferenceNumber: firstValue(
      header(req, 'X-Mock-CoverNoteReferenceNumber'),
      header(req, 'X-Mock-Cover-Note-Reference-Number'),
      query(req, 'coverNoteReferenceNumber'),
      query(req, 'coverNoteRef'),
      getTag(xml, 'MockCoverNoteReferenceNumber'),
      getTag(xml, 'MockCoverNoteRef'),
    ),
    motorCoverNoteReferenceNumber: firstValue(
      header(req, 'X-Mock-MotorCoverNoteReferenceNumber'),
      header(req, 'X-Mock-Motor-Cover-Note-Reference-Number'),
      query(req, 'motorCoverNoteReferenceNumber'),
      query(req, 'motorCoverNoteRef'),
      getTag(xml, 'MockMotorCoverNoteReferenceNumber'),
      getTag(xml, 'MockMotorCoverNoteRef'),
    ),
    stickerNumber: firstValue(
      header(req, 'X-Mock-StickerNumber'),
      header(req, 'X-Mock-Sticker-Number'),
      query(req, 'stickerNumber'),
      getTag(xml, 'MockStickerNumber'),
    ),
    policyReferenceNumber: firstValue(
      header(req, 'X-Mock-PolicyReferenceNumber'),
      header(req, 'X-Mock-Policy-Reference-Number'),
      query(req, 'policyReferenceNumber'),
      query(req, 'policyRef'),
      getTag(xml, 'MockPolicyReferenceNumber'),
      getTag(xml, 'MockPolicyRef'),
    ),
    reinsuranceReferenceNumber: firstValue(
      header(req, 'X-Mock-ReinsuranceReferenceNumber'),
      header(req, 'X-Mock-Reinsurance-Reference-Number'),
      query(req, 'reinsuranceReferenceNumber'),
      query(req, 'reinsuranceRef'),
      getTag(xml, 'MockReinsuranceReferenceNumber'),
      getTag(xml, 'MockReinsuranceRef'),
    ),
    claimReferenceNumber: firstValue(
      header(req, 'X-Mock-ClaimReferenceNumber'),
      header(req, 'X-Mock-Claim-Reference-Number'),
      query(req, 'claimReferenceNumber'),
      query(req, 'claimRef'),
      getTag(xml, 'MockClaimReferenceNumber'),
      getTag(xml, 'MockClaimRef'),
    ),
    verificationStatus: firstValue(
      header(req, 'X-Mock-VerificationStatus'),
      header(req, 'X-Mock-Verification-Status'),
      query(req, 'verificationStatus'),
      getTag(xml, 'MockVerificationStatus'),
    ),
    verificationMessage: firstValue(
      header(req, 'X-Mock-VerificationMessage'),
      header(req, 'X-Mock-Verification-Message'),
      query(req, 'verificationMessage'),
      getTag(xml, 'MockVerificationMessage'),
    ),
    verificationFullName: firstValue(
      header(req, 'X-Mock-VerificationFullName'),
      header(req, 'X-Mock-Verification-Full-Name'),
      query(req, 'verificationFullName'),
      getTag(xml, 'MockVerificationFullName'),
    ),
    verificationCompanyName: firstValue(
      header(req, 'X-Mock-VerificationCompanyName'),
      header(req, 'X-Mock-Verification-Company-Name'),
      query(req, 'verificationCompanyName'),
      getTag(xml, 'MockVerificationCompanyName'),
    ),
  };
}

function resolveMockResponseData(params = {}) {
  const root = params.root;
  const requestId = params.requestId;
  const req = params.req || null;
  const xml = params.xml || '';

  const overrides = extractResponseOverrides(req, xml);

  const data = {
    coverNoteReferenceNumber: firstValue(
      overrides.coverNoteReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.coverNoteReferenceNumber,
      CONFIG.defaultCoverNoteReferenceNumber,
      buildReference(CONFIG.coverNoteRefPrefix, requestId),
    ),
    motorCoverNoteReferenceNumber: firstValue(
      overrides.motorCoverNoteReferenceNumber,
      overrides.coverNoteReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.motorCoverNoteReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.coverNoteReferenceNumber,
      CONFIG.defaultMotorCoverNoteReferenceNumber,
      CONFIG.defaultCoverNoteReferenceNumber,
      buildReference(CONFIG.motorCoverNoteRefPrefix, requestId),
    ),
    stickerNumber: firstValue(
      overrides.stickerNumber,
      RUNTIME_RESPONSE_CONFIG.stickerNumber,
      CONFIG.defaultStickerNumber,
      buildReference(CONFIG.stickerPrefix, requestId),
    ),
    policyReferenceNumber: firstValue(
      overrides.policyReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.policyReferenceNumber,
      buildReference(CONFIG.policyRefPrefix, requestId),
    ),
    reinsuranceReferenceNumber: firstValue(
      overrides.reinsuranceReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.reinsuranceReferenceNumber,
      buildReference(CONFIG.reinsuranceRefPrefix, requestId),
    ),
    claimReferenceNumber: firstValue(
      overrides.claimReferenceNumber,
      RUNTIME_RESPONSE_CONFIG.claimReferenceNumber,
      buildReference(CONFIG.claimRefPrefix, requestId),
    ),
    verificationStatus: firstValue(
      overrides.verificationStatus,
      RUNTIME_RESPONSE_CONFIG.verificationStatus,
      CONFIG.verificationStatus,
      'VALID',
    ),
    verificationMessage: firstValue(
      overrides.verificationMessage,
      RUNTIME_RESPONSE_CONFIG.verificationMessage,
      CONFIG.verificationMessage,
      'Verified successfully',
    ),
    verificationFullName: firstValue(
      overrides.verificationFullName,
      RUNTIME_RESPONSE_CONFIG.verificationFullName,
      CONFIG.verificationFullName,
      'Mock NIN Holder',
    ),
    verificationCompanyName: firstValue(
      overrides.verificationCompanyName,
      RUNTIME_RESPONSE_CONFIG.verificationCompanyName,
      CONFIG.verificationCompanyName,
      'Mock Company Limited',
    ),
    customFields: {
      ...RUNTIME_RESPONSE_CONFIG.customFields,
    },
    source: {
      root,
      requestId,
      overrides,
      runtimeConfigApplied: getRuntimeResponseConfig(),
    },
  };

  return data;
}

module.exports = {
  getRuntimeResponseConfig,
  updateRuntimeResponseConfig,
  resetRuntimeResponseConfig,
  extractResponseOverrides,
  resolveMockResponseData,
};
