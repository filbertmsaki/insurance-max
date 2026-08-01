const { CONFIG } = require('../config/mock-config');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const { getTag } = require('../utils/xml.util');
const { listTrackingRecords } = require('../store/mock-request.store');

const FAILED_STATUSES = [
  'HEADER_VALIDATION_FAILED',
  'SIGNATURE_VALIDATION_FAILED',
  'BUSINESS_VALIDATION_FAILED',
  'UNKNOWN_ROOT',
  'ROOT_ENDPOINT_MISMATCH',
  'CALLBACK_URL_INVALID',
  'UNSUPPORTED_ASYNC_ROOT',
  'SCENARIO_ACK_FAILED',
  'HTTP_500',
  'HTTP_503',
];

function extractBusinessReference(root, xml) {
  switch (root) {
    case 'CoverNoteRefReq':
    case 'MotorCoverNoteRefReq':
      return (
        getTag(xml, 'CoverNoteNumber') ||
        getTag(xml, 'FleetId') ||
        getTag(xml, 'CoverNoteReferenceNumber') ||
        null
      );
    case 'ReinsuranceReq':
      return getTag(xml, 'CoverNoteReferenceNumber');
    case 'PolicyReq':
      return getTag(xml, 'PolicyNumber');
    case 'ClaimNotificationRefReq':
      return getTag(xml, 'ClaimNotificationNumber');
    case 'ClaimIntimationReq':
      return getTag(xml, 'ClaimIntimationNumber');
    case 'ClaimAssessmentReq':
      return getTag(xml, 'ClaimAssessmentNumber');
    case 'DischargeVoucherReq':
      return getTag(xml, 'DischargeVoucherNumber');
    case 'ClaimPaymentReq':
      return getTag(xml, 'ClaimPaymentNumber');
    case 'ClaimRejectionReq':
      return getTag(xml, 'ClaimRejectionNumber');
    case 'CoverNoteVerificationReq':
      return getTag(xml, 'CoverNoteReferenceNumber');
    case 'MotorVerificationReq':
      return (
        getTag(xml, 'MotorRegistrationNumber') ||
        getTag(xml, 'MotorChassisNumber')
      );
    default:
      return (
        getTag(xml, 'PolicyNumber') ||
        getTag(xml, 'CoverNoteNumber') ||
        getTag(xml, 'CoverNoteReferenceNumber') ||
        getTag(xml, 'ClaimReferenceNumber') ||
        getTag(xml, 'ClaimNotificationNumber') ||
        getTag(xml, 'ClaimIntimationNumber') ||
        getTag(xml, 'ClaimAssessmentNumber') ||
        getTag(xml, 'DischargeVoucherNumber') ||
        getTag(xml, 'ClaimPaymentNumber') ||
        getTag(xml, 'ClaimRejectionNumber') ||
        null
      );
  }
}

function extractDuplicateIdentity(root, xml, endpointDefinition = {}) {
  return {
    root,
    serviceType: endpointDefinition.serviceType || null,
    endpoint: endpointDefinition.endpointUrl || null,
    requestId: getTag(xml, 'RequestId'),
    companyCode: getTag(xml, 'CompanyCode'),
    insurerCompanyCode: getTag(xml, 'InsurerCompanyCode'),
    businessReference: extractBusinessReference(root, xml),
  };
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function buildDuplicateKey(identity) {
  return [
    identity.serviceType || 'unknown-service',
    identity.root || 'unknown-root',
    identity.companyCode || 'unknown-company',
    identity.insurerCompanyCode || 'unknown-insurer',
    identity.requestId || 'unknown-request-id',
    identity.businessReference || 'unknown-business-reference',
  ]
    .map(normalizeValue)
    .join('|');
}

function isWithinDuplicateWindow(record) {
  const windowMinutes = Number(CONFIG.duplicateWindowMinutes || 1440);

  if (!windowMinutes || windowMinutes <= 0) {
    return true;
  }

  const createdAt = new Date(record.createdAt || record.updatedAt || 0).getTime();

  if (!createdAt) {
    return true;
  }

  const ageMs = Date.now() - createdAt;
  const windowMs = windowMinutes * 60 * 1000;

  return ageMs <= windowMs;
}

function shouldConsiderExistingRecord(record) {
  if (!record) {
    return false;
  }

  if (!CONFIG.duplicateIncludeFailed && FAILED_STATUSES.includes(record.status)) {
    return false;
  }

  return isWithinDuplicateWindow(record);
}

function buildDuplicateResult(params) {
  return {
    isDuplicate: true,
    code: CONFIG.duplicateResponseCode || 'TIRA007',
    desc:
      RESPONSE_CODES[CONFIG.duplicateResponseCode || 'TIRA007'] ||
      RESPONSE_CODES.TIRA007 ||
      'Duplicate request',
    reason: params.reason,
    identity: params.identity,
    duplicateKey: buildDuplicateKey(params.identity),
    duplicateOfRequestId: params.record.requestId,
    duplicateOfTrackingId: params.record.id,
    duplicateOfStatus: params.record.status,
    duplicateOfCreatedAt: params.record.createdAt,
  };
}

function checkDuplicateRequest(params) {
  if (!CONFIG.duplicateDetectionEnabled) {
    return {
      isDuplicate: false,
      skipped: true,
      reason: 'MOCK_DUPLICATE_DETECTION_ENABLED=false',
    };
  }

  const identity =
    params.identity ||
    extractDuplicateIdentity(params.root, params.xml, params.endpointDefinition);

  const currentTrackingId = params.currentTrackingId || null;
  const currentRequestId = params.currentRequestId || identity.requestId;

  const records = listTrackingRecords();

  for (const record of records) {
    if (record.id === currentTrackingId) {
      continue;
    }

    if (!shouldConsiderExistingRecord(record)) {
      continue;
    }

    if (record.root && identity.root && record.root !== identity.root) {
      continue;
    }

    if (
      record.serviceType &&
      identity.serviceType &&
      record.serviceType !== identity.serviceType
    ) {
      continue;
    }

    const sameCompany =
      normalizeValue(record.companyCode) === normalizeValue(identity.companyCode) ||
      normalizeValue(record.insurerCompanyCode) ===
        normalizeValue(identity.insurerCompanyCode);

    const companyComparable =
      Boolean(record.companyCode || record.insurerCompanyCode) &&
      Boolean(identity.companyCode || identity.insurerCompanyCode);

    if (companyComparable && !sameCompany) {
      continue;
    }

    if (
      CONFIG.duplicateCompareRequestId &&
      record.requestId &&
      identity.requestId &&
      normalizeValue(record.requestId) === normalizeValue(identity.requestId)
    ) {
      return buildDuplicateResult({
        identity,
        record,
        reason: `Duplicate RequestId: ${identity.requestId}`,
      });
    }

    if (
      CONFIG.duplicateCompareBusinessReference &&
      record.businessReference &&
      identity.businessReference &&
      normalizeValue(record.businessReference) ===
        normalizeValue(identity.businessReference)
    ) {
      return buildDuplicateResult({
        identity,
        record,
        reason: `Duplicate business reference: ${identity.businessReference}`,
      });
    }
  }

  return {
    isDuplicate: false,
    identity,
    duplicateKey: buildDuplicateKey(identity),
  };
}

function getDuplicateConfiguration() {
  return {
    enabled: CONFIG.duplicateDetectionEnabled,
    responseCode: CONFIG.duplicateResponseCode,
    compareRequestId: CONFIG.duplicateCompareRequestId,
    compareBusinessReference: CONFIG.duplicateCompareBusinessReference,
    windowMinutes: CONFIG.duplicateWindowMinutes,
    includeFailed: CONFIG.duplicateIncludeFailed,
  };
}

module.exports = {
  extractBusinessReference,
  extractDuplicateIdentity,
  buildDuplicateKey,
  checkDuplicateRequest,
  getDuplicateConfiguration,
};
