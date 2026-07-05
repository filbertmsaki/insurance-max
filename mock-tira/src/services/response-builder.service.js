const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const {
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
} = require('../constants/tiramis-roots.constant');
const { escapeXml, getTag } = require('../utils/xml.util');

function buildTiraMessage(contentXml, signer) {
  const signature = signer ? signer(contentXml) : '';

  return [
    '<TiraMsg>',
    `<Content>${escapeXml(contentXml)}</Content>`,
    `<MsgSignature>${escapeXml(signature || '')}</MsgSignature>`,
    '</TiraMsg>',
  ].join('');
}

function buildAcknowledgementContent(root, requestId, code, desc) {
  const config = ASYNC_RESPONSE_ROOTS[root];
  const ackRoot = config?.ackRoot || `${root}Ack`;

  return [
    `<${ackRoot}>`,
    `<RequestId>${escapeXml(requestId)}</RequestId>`,
    `<AcknowledgementStatusCode>${escapeXml(code)}</AcknowledgementStatusCode>`,
    `<AcknowledgementStatusDesc>${escapeXml(desc)}</AcknowledgementStatusDesc>`,
    `</${ackRoot}>`,
  ].join('');
}

function buildAsyncFinalResponseContent(root, requestId, code, desc, options = {}) {
  const config = ASYNC_RESPONSE_ROOTS[root];
  const finalRoot = config?.finalRoot || `${root.replace(/Req$/, '')}Res`;
  const responseId = options.responseId || `MOCK-RES-${Date.now()}`;
  const responseData = options.responseData || {};
  const extraFields = buildFinalExtraFields(root, requestId, responseData);

  return [
    `<${finalRoot}>`,
    `<RequestId>${escapeXml(requestId)}</RequestId>`,
    `<ResponseId>${escapeXml(responseId)}</ResponseId>`,
    `<ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>`,
    `<ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>`,
    extraFields,
    buildCustomFields(responseData.customFields),
    `</${finalRoot}>`,
  ].join('');
}

function buildSyncResponseContent(
  root,
  requestId,
  code,
  desc,
  originalXml,
  options = {},
) {
  const config = SYNC_RESPONSE_ROOTS[root];
  const responseRoot = config?.responseRoot || `${root.replace(/Req$/, '')}Res`;
  const responseId = options.responseId || `MOCK-SYNC-${Date.now()}`;
  const responseData = options.responseData || {};

  return [
    `<${responseRoot}>`,
    `<RequestId>${escapeXml(requestId)}</RequestId>`,
    `<ResponseId>${escapeXml(responseId)}</ResponseId>`,
    `<ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>`,
    `<ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>`,
    buildSyncExtraFields(root, originalXml, responseData),
    buildCustomFields(responseData.customFields),
    `</${responseRoot}>`,
  ].join('');
}

function buildFailureReply(root, requestId, code, desc, originalXml, options = {}) {
  if (SYNC_RESPONSE_ROOTS[root]) {
    return buildSyncResponseContent(root, requestId, code, desc, originalXml, options);
  }

  return buildAcknowledgementContent(root, requestId, code, desc);
}

function buildFinalExtraFields(root, requestId, responseData = {}) {
  switch (root) {
    case 'CoverNoteRefReq':
      return [
        `<CoverNoteReferenceNumber>${escapeXml(
          responseData.coverNoteReferenceNumber || `CN-${requestId}`,
        )}</CoverNoteReferenceNumber>`,
      ].join('');
    case 'MotorCoverNoteRefReq':
      return [
        `<CoverNoteReferenceNumber>${escapeXml(
          responseData.motorCoverNoteReferenceNumber ||
            responseData.coverNoteReferenceNumber ||
            `MCN-${requestId}`,
        )}</CoverNoteReferenceNumber>`,
        `<StickerNumber>${escapeXml(
          responseData.stickerNumber || `STK-${Date.now()}`,
        )}</StickerNumber>`,
      ].join('');
    case 'ClaimNotificationRefReq':
      return [
        `<ClaimReferenceNumber>${escapeXml(
          responseData.claimReferenceNumber || `CLM-REF-${requestId}`,
        )}</ClaimReferenceNumber>`,
      ].join('');
    case 'PolicyReq':
      return [
        `<PolicyReferenceNumber>${escapeXml(
          responseData.policyReferenceNumber || `POL-REF-${requestId}`,
        )}</PolicyReferenceNumber>`,
      ].join('');
    case 'ReinsuranceReq':
      return [
        `<ReinsuranceReferenceNumber>${escapeXml(
          responseData.reinsuranceReferenceNumber || `RE-${requestId}`,
        )}</ReinsuranceReferenceNumber>`,
      ].join('');
    default:
      return '';
  }
}

function buildSyncExtraFields(root, originalXml, responseData = {}) {
  const verificationStatus = responseData.verificationStatus || 'VALID';
  const verificationMessage =
    responseData.verificationMessage || 'Verified successfully';

  if (root === 'CoverNoteVerificationReq') {
    const ref = getTag(originalXml, 'CoverNoteReferenceNumber');

    return [
      `<CoverNoteReferenceNumber>${escapeXml(ref || '')}</CoverNoteReferenceNumber>`,
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
    ].join('');
  }

  if (root === 'MotorVerificationReq') {
    const registrationNumber = getTag(originalXml, 'RegistrationNumber');

    return [
      `<RegistrationNumber>${escapeXml(registrationNumber || '')}</RegistrationNumber>`,
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
    ].join('');
  }

  if (root === 'NINVerificationReq') {
    const nin = getTag(originalXml, 'NIN');

    return [
      `<NIN>${escapeXml(nin || '')}</NIN>`,
      `<FullName>${escapeXml(
        responseData.verificationFullName || 'Mock NIN Holder',
      )}</FullName>`,
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
    ].join('');
  }

  if (root === 'CompanyVerificationReq') {
    const tin = getTag(originalXml, 'TIN');
    const registrationNumber = getTag(originalXml, 'RegistrationNumber');
    const companyName = getTag(originalXml, 'CompanyName');

    return [
      `<TIN>${escapeXml(tin || '')}</TIN>`,
      `<RegistrationNumber>${escapeXml(registrationNumber || '')}</RegistrationNumber>`,
      `<CompanyName>${escapeXml(
        companyName ||
          responseData.verificationCompanyName ||
          'Mock Company Limited',
      )}</CompanyName>`,
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
    ].join('');
  }

  if (root === 'DetailsVerificationReq') {
    const nin = getTag(originalXml, 'NIN');
    const tin = getTag(originalXml, 'TIN');
    const registrationNumber = getTag(originalXml, 'RegistrationNumber');
    const coverNoteReferenceNumber = getTag(originalXml, 'CoverNoteReferenceNumber');
    const policyNumber = getTag(originalXml, 'PolicyNumber');

    return [
      `<NIN>${escapeXml(nin || '')}</NIN>`,
      `<TIN>${escapeXml(tin || '')}</TIN>`,
      `<RegistrationNumber>${escapeXml(registrationNumber || '')}</RegistrationNumber>`,
      `<CoverNoteReferenceNumber>${escapeXml(coverNoteReferenceNumber || '')}</CoverNoteReferenceNumber>`,
      `<PolicyNumber>${escapeXml(policyNumber || '')}</PolicyNumber>`,
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
    ].join('');
  }

  return '';
}

function buildCustomFields(customFields = {}) {
  if (!customFields || typeof customFields !== 'object') {
    return '';
  }

  return Object.entries(customFields)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');
}

function getDefaultSuccessDesc() {
  return RESPONSE_CODES.TIRA001;
}

module.exports = {
  buildTiraMessage,
  buildAcknowledgementContent,
  buildAsyncFinalResponseContent,
  buildSyncResponseContent,
  buildFailureReply,
  getDefaultSuccessDesc,
};
