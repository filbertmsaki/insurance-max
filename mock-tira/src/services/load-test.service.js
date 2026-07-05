const { CONFIG } = require('../config/mock-config');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const {
  CANONICAL_SERVICE_ENDPOINTS,
  findCanonicalEndpointByServiceType,
  findCanonicalEndpointByRoot,
} = require('../constants/tiramis-endpoints.constant');
const {
  getRequestRootByFinalRoot,
  getFinalAckRootForRequestRoot,
} = require('../constants/tiramis-roots.constant');
const {
  getRoot,
  getTag,
  extractContentXml,
} = require('../utils/xml.util');
const { wrapClientTiraMessage } = require('./signature.service');

const SERVICE_TYPE_ALIASES = {
  NON_MOTOR: 'COVER_NOTE_NON_MOTOR',
  MOTOR: 'MOTOR_COVER_NOTE_NON_FLEET',
  MOTOR_FLEET: 'MOTOR_COVER_NOTE_FLEET',
};

function normalizeServiceType(serviceType) {
  return String(serviceType || '').trim().toUpperCase();
}

function resolveEndpointByServiceType(serviceType) {
  const normalized = normalizeServiceType(serviceType);
  const alias = SERVICE_TYPE_ALIASES[normalized] || normalized;

  return (
    findCanonicalEndpointByServiceType(alias) ||
    findCanonicalEndpointByServiceType(normalized)
  );
}

function resolveEndpointByRoot(root) {
  return findCanonicalEndpointByRoot(root);
}

function getLoadTestServiceTypes() {
  return CANONICAL_SERVICE_ENDPOINTS.map((item) => ({
    serviceType: item.serviceType,
    endpointUrl: item.endpointUrl,
    aliases: item.aliases || [],
    mode: item.mode,
    requestRoots: item.requestRoots,
  }));
}

function buildRequestId(prefix, index) {
  const padded = String(index).padStart(5, '0');
  return `${prefix}-${Date.now()}-${padded}`;
}

function buildCommonFields(params) {
  return {
    requestId: params.requestId || buildRequestId('REQ-LOAD', 1),
    callbackUrl: params.callbackUrl || CONFIG.loadTestDefaultCallbackUrl,
    companyCode: params.companyCode || 'COMP001',
    systemCode: params.systemCode || 'SYS001',
    insurerCompanyCode: params.insurerCompanyCode || 'INS001',
    tranCompanyCode: params.tranCompanyCode || 'TRN001',
  };
}

function buildSampleContentXml(params = {}) {
  const serviceType = params.serviceType || 'POLICY';
  const endpoint =
    resolveEndpointByServiceType(serviceType) ||
    resolveEndpointByRoot(params.root) ||
    resolveEndpointByServiceType('POLICY');

  if (!endpoint) {
    throw new Error(`Unsupported load test serviceType: ${serviceType}`);
  }

  const root = params.root || endpoint.requestRoots[0];
  const fields = buildCommonFields(params);

  switch (root) {
    case 'CoverNoteRefReq':
      return [
        '<CoverNoteRefReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<TranCompanyCode>${fields.tranCompanyCode}</TranCompanyCode>`,
        '<CoverNoteType>1</CoverNoteType>',
        `<CoverNoteNumber>CN-${fields.requestId}</CoverNoteNumber>`,
        '</CoverNoteRefReq>',
      ].join('');

    case 'MotorCoverNoteRefReq':
      return [
        '<MotorCoverNoteRefReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<TranCompanyCode>${fields.tranCompanyCode}</TranCompanyCode>`,
        '<CoverNoteType>1</CoverNoteType>',
        `<CoverNoteNumber>MCN-${fields.requestId}</CoverNoteNumber>`,
        `<FleetId>FLT-${fields.requestId}</FleetId>`,
        '<FleetSize>1</FleetSize>',
        `<RegistrationNumber>T${String(Date.now()).slice(-6)}ABC</RegistrationNumber>`,
        `<ChassisNumber>CH-${fields.requestId}</ChassisNumber>`,
        '</MotorCoverNoteRefReq>',
      ].join('');

    case 'ReinsuranceReq':
      return [
        '<ReinsuranceReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<PremiumIncludingTax>100000</PremiumIncludingTax>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<AuthorizingOfficerName>Mock Officer</AuthorizingOfficerName>',
        '<AuthorizingOfficerTitle>Manager</AuthorizingOfficerTitle>',
        '<ReinsuranceCategory>1</ReinsuranceCategory>',
        '<Participant>Mock Participant</Participant>',
        '</ReinsuranceReq>',
      ].join('');

    case 'PolicyReq':
      return [
        '<PolicyReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<PolicyNumber>POL-${fields.requestId}</PolicyNumber>`,
        '<PolicyOperativeClause>Mock policy operative clause</PolicyOperativeClause>',
        '<SpecialConditions>Mock special conditions</SpecialConditions>',
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '</PolicyReq>',
      ].join('');

    case 'ClaimNotificationRefReq':
      return [
        '<ClaimNotificationRefReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<TranCompanyCode>${fields.tranCompanyCode}</TranCompanyCode>`,
        `<ClaimNotificationNumber>CLN-${fields.requestId}</ClaimNotificationNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<ClaimReportDate>2026-07-05T10:00:00</ClaimReportDate>',
        '<ClaimFormDullyFilled>Y</ClaimFormDullyFilled>',
        '<LossDate>2026-07-05T09:00:00</LossDate>',
        '<LossNature>Accident</LossNature>',
        '<LossType>Motor</LossType>',
        '<LossLocation>Dar es Salaam</LossLocation>',
        '<OfficerName>Mock Officer</OfficerName>',
        '<OfficerTitle>Claims Officer</OfficerTitle>',
        '</ClaimNotificationRefReq>',
      ].join('');

    case 'ClaimIntimationReq':
      return [
        '<ClaimIntimationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<ClaimIntimationNumber>CLI-${fields.requestId}</ClaimIntimationNumber>`,
        `<ClaimReferenceNumber>CLMREF-${fields.requestId}</ClaimReferenceNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<ClaimIntimationDate>2026-07-05T11:00:00</ClaimIntimationDate>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<ClaimEstimatedAmount>500000</ClaimEstimatedAmount>',
        '<ClaimReserveAmount>450000</ClaimReserveAmount>',
        '<ClaimReserveMethod>Manual</ClaimReserveMethod>',
        '<LossAssessmentOption>1</LossAssessmentOption>',
        '<AssessorName>Mock Assessor</AssessorName>',
        `<AssessorIdNumber>ASS-${fields.requestId}</AssessorIdNumber>`,
        '<AssessorIdType>1</AssessorIdType>',
        '<Claimant>Mock Claimant</Claimant>',
        '</ClaimIntimationReq>',
      ].join('');

    case 'ClaimAssessmentReq':
      return [
        '<ClaimAssessmentReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<ClaimAssessmentNumber>CLA-${fields.requestId}</ClaimAssessmentNumber>`,
        `<ClaimIntimationNumber>CLI-${fields.requestId}</ClaimIntimationNumber>`,
        `<ClaimReferenceNumber>CLMREF-${fields.requestId}</ClaimReferenceNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<AssessmentReceivedDate>2026-07-05T12:00:00</AssessmentReceivedDate>',
        '<AssessmentReportSummary>Mock assessment summary</AssessmentReportSummary>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<AssessmentAmount>450000</AssessmentAmount>',
        '<ApprovedClaimAmount>400000</ApprovedClaimAmount>',
        '<ClaimApprovalDate>2026-07-05T13:00:00</ClaimApprovalDate>',
        '<ClaimApprovalAuthority>Mock Authority</ClaimApprovalAuthority>',
        '<IsReAssessment>N</IsReAssessment>',
        '<Claimant>Mock Claimant</Claimant>',
        '</ClaimAssessmentReq>',
      ].join('');

    case 'DischargeVoucherReq':
      return [
        '<DischargeVoucherReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<DischargeVoucherNumber>DV-${fields.requestId}</DischargeVoucherNumber>`,
        `<ClaimAssessmentNumber>CLA-${fields.requestId}</ClaimAssessmentNumber>`,
        `<ClaimReferenceNumber>CLMREF-${fields.requestId}</ClaimReferenceNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<DischargeVoucherDate>2026-07-05T14:00:00</DischargeVoucherDate>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<ClaimOfferCommunicationDate>2026-07-05T14:10:00</ClaimOfferCommunicationDate>',
        '<ClaimOfferAmount>400000</ClaimOfferAmount>',
        '<ClaimantResponseDate>2026-07-05T14:20:00</ClaimantResponseDate>',
        '<AdjustmentDate>2026-07-05T14:30:00</AdjustmentDate>',
        '<AdjustmentReason>No adjustment</AdjustmentReason>',
        '<AdjustmentAmount>0</AdjustmentAmount>',
        '<ReconciliationDate>2026-07-05T14:40:00</ReconciliationDate>',
        '<ReconciliationSummary>Mock reconciliation</ReconciliationSummary>',
        '<ReconciledAmount>400000</ReconciledAmount>',
        '<OfferAccepted>Y</OfferAccepted>',
        '<Claimant>Mock Claimant</Claimant>',
        '</DischargeVoucherReq>',
      ].join('');

    case 'ClaimPaymentReq':
      return [
        '<ClaimPaymentReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<ClaimPaymentNumber>PAY-${fields.requestId}</ClaimPaymentNumber>`,
        `<ClaimReferenceNumber>CLMREF-${fields.requestId}</ClaimReferenceNumber>`,
        `<ClaimIntimationNumber>CLI-${fields.requestId}</ClaimIntimationNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<PaymentDate>2026-07-05T15:00:00</PaymentDate>',
        '<PaidAmount>400000</PaidAmount>',
        '<PaymentMode>1</PaymentMode>',
        '<PartiesNotified>Y</PartiesNotified>',
        '<NetPremiumEarned>100000</NetPremiumEarned>',
        '<ClaimResultedLitigation>N</ClaimResultedLitigation>',
        '<LitigationReason>None</LitigationReason>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<Claimant>Mock Claimant</Claimant>',
        '</ClaimPaymentReq>',
      ].join('');

    case 'ClaimRejectionReq':
      return [
        '<ClaimRejectionReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CallBackUrl>${fields.callbackUrl}</CallBackUrl>`,
        `<InsurerCompanyCode>${fields.insurerCompanyCode}</InsurerCompanyCode>`,
        `<ClaimRejectionNumber>REJ-${fields.requestId}</ClaimRejectionNumber>`,
        `<ClaimReferenceNumber>CLMREF-${fields.requestId}</ClaimReferenceNumber>`,
        `<ClaimIntimationNumber>CLI-${fields.requestId}</ClaimIntimationNumber>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '<RejectionDate>2026-07-05T16:00:00</RejectionDate>',
        '<RejectionReason>Mock rejection reason</RejectionReason>',
        '<ClaimResultedLitigation>N</ClaimResultedLitigation>',
        '<ClaimAmount>400000</ClaimAmount>',
        '<CurrencyCode>TZS</CurrencyCode>',
        '<ExchangeRate>1</ExchangeRate>',
        '<Claimant>Mock Claimant</Claimant>',
        '</ClaimRejectionReq>',
      ].join('');

    case 'CoverNoteVerificationReq':
      return [
        '<CoverNoteVerificationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        '</CoverNoteVerificationReq>',
      ].join('');

    case 'MotorVerificationReq':
      return [
        '<MotorVerificationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        `<RegistrationNumber>T${String(Date.now()).slice(-6)}ABC</RegistrationNumber>`,
        '</MotorVerificationReq>',
      ].join('');

    case 'NINVerificationReq':
      return [
        '<NINVerificationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        '<NIN>19900101123456789001</NIN>',
        '</NINVerificationReq>',
      ].join('');

    case 'CompanyVerificationReq':
      return [
        '<CompanyVerificationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        '<CompanyName>Mock Company Limited</CompanyName>',
        '<TIN>123456789</TIN>',
        `<RegistrationNumber>REG-${fields.requestId}</RegistrationNumber>`,
        '</CompanyVerificationReq>',
      ].join('');

    case 'DetailsVerificationReq':
      return [
        '<DetailsVerificationReq>',
        `<RequestId>${fields.requestId}</RequestId>`,
        `<CompanyCode>${fields.companyCode}</CompanyCode>`,
        `<SystemCode>${fields.systemCode}</SystemCode>`,
        '<NIN>19900101123456789001</NIN>',
        '<TIN>123456789</TIN>',
        '<RegistrationNumber>T123ABC</RegistrationNumber>',
        `<CoverNoteReferenceNumber>CNREF-${fields.requestId}</CoverNoteReferenceNumber>`,
        `<PolicyNumber>POL-${fields.requestId}</PolicyNumber>`,
        '</DetailsVerificationReq>',
      ].join('');

    default:
      throw new Error(`Unsupported load test root: ${root}`);
  }
}

function buildCallbackAckForFinalResponse(finalResponseXml) {
  const contentXml = extractContentXml(finalResponseXml);
  const finalRoot = getRoot(contentXml || finalResponseXml);
  const requestRoot = getRequestRootByFinalRoot(finalRoot);
  const ackRoot = requestRoot
    ? getFinalAckRootForRequestRoot(requestRoot)
    : `${finalRoot}Ack`;
  const requestId = getTag(contentXml || finalResponseXml, 'RequestId');

  return [
    `<${ackRoot}>`,
    `<RequestId>${requestId || ''}</RequestId>`,
    '<AcknowledgementStatusCode>TIRA001</AcknowledgementStatusCode>',
    `<AcknowledgementStatusDesc>${RESPONSE_CODES.TIRA001}</AcknowledgementStatusDesc>`,
    `</${ackRoot}>`,
  ].join('');
}

async function runLoadTest(params = {}) {
  if (!CONFIG.loadTestEnabled) {
    throw new Error('Load testing is disabled. Set MOCK_LOAD_TEST_ENABLED=true');
  }

  const count = Math.min(
    Math.max(Number(params.count || 10), 1),
    Number(CONFIG.loadTestMaxRequests || 500),
  );

  const concurrency = Math.min(
    Math.max(
      Number(params.concurrency || CONFIG.loadTestDefaultConcurrency || 5),
      1,
    ),
    count,
  );

  const serviceType = params.serviceType || 'POLICY';
  const endpoint =
    resolveEndpointByServiceType(serviceType) ||
    resolveEndpointByRoot(params.root);

  if (!endpoint) {
    throw new Error(`Unsupported serviceType: ${serviceType}`);
  }

  const baseUrl = params.baseUrl || `http://localhost:${CONFIG.port}`;
  const url = `${baseUrl}${endpoint.endpointUrl}`;
  const scenario = params.scenario || 'success';
  const signed = params.signed !== false;
  const requestPrefix = params.requestPrefix || 'REQ-LOAD';
  const callbackUrl = params.callbackUrl || CONFIG.loadTestDefaultCallbackUrl;

  const startedAt = Date.now();
  const results = [];
  let nextIndex = 0;

  async function worker(workerId) {
    while (true) {
      const index = nextIndex + 1;
      nextIndex += 1;

      if (index > count) {
        return;
      }

      const result = await submitOneLoadTestRequest({
        index,
        workerId,
        url,
        endpoint,
        serviceType,
        scenario,
        signed,
        requestPrefix,
        callbackUrl,
        clientCode: params.clientCode || CONFIG.clientCode,
        clientKey: params.clientKey || CONFIG.clientKey,
        companyCode: params.companyCode,
        systemCode: params.systemCode,
        insurerCompanyCode: params.insurerCompanyCode,
      });

      results.push(result);
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, (_, idx) => worker(idx + 1)),
  );

  const durationMs = Date.now() - startedAt;

  return {
    success: true,
    serviceType,
    endpointUrl: endpoint.endpointUrl,
    scenario,
    signed,
    count,
    concurrency,
    durationMs,
    requestsPerSecond:
      durationMs > 0 ? Number((count / (durationMs / 1000)).toFixed(2)) : count,
    summary: summarizeLoadResults(results),
    results: results.sort((a, b) => a.index - b.index),
  };
}

async function submitOneLoadTestRequest(params) {
  const requestId = buildRequestId(params.requestPrefix, params.index);
  const contentXml = buildSampleContentXml({
    serviceType: params.serviceType,
    root: params.endpoint.requestRoots[0],
    requestId,
    callbackUrl: params.callbackUrl,
    companyCode: params.companyCode,
    systemCode: params.systemCode,
    insurerCompanyCode: params.insurerCompanyCode,
  });

  const body = params.signed ? wrapClientTiraMessage(contentXml) : contentXml;
  const startedAt = Date.now();

  try {
    const response = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        ClientCode: params.clientCode,
        ClientKey: params.clientKey,
        'X-Mock-Scenario': params.scenario,
        'X-Load-Test': 'true',
        'X-Load-Test-Worker': String(params.workerId),
        'X-Load-Test-Index': String(params.index),
      },
      body,
    });

    const responseText = await response.text();
    const content = extractContentXml(responseText);
    const root = getRoot(content || responseText);
    const code =
      getTag(content || responseText, 'AcknowledgementStatusCode') ||
      getTag(content || responseText, 'ResponseStatusCode') ||
      getTag(content || responseText, 'StatusCode');

    return {
      index: params.index,
      workerId: params.workerId,
      requestId,
      ok: response.ok,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      responseRoot: root,
      responseCode: code,
      responsePreview: responseText.slice(0, 500),
    };
  } catch (error) {
    return {
      index: params.index,
      workerId: params.workerId,
      requestId,
      ok: false,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      error: error.message || String(error),
    };
  }
}

function summarizeLoadResults(results) {
  const summary = {
    total: results.length,
    ok: 0,
    failed: 0,
    byHttpStatus: {},
    byResponseCode: {},
    minDurationMs: null,
    maxDurationMs: null,
    avgDurationMs: 0,
  };

  let totalDuration = 0;

  for (const result of results) {
    if (result.ok) {
      summary.ok += 1;
    } else {
      summary.failed += 1;
    }

    const httpStatus = String(result.httpStatus || 'NO_RESPONSE');
    summary.byHttpStatus[httpStatus] =
      (summary.byHttpStatus[httpStatus] || 0) + 1;

    const responseCode = String(result.responseCode || 'NO_CODE');
    summary.byResponseCode[responseCode] =
      (summary.byResponseCode[responseCode] || 0) + 1;

    const duration = Number(result.durationMs || 0);
    totalDuration += duration;

    if (summary.minDurationMs === null || duration < summary.minDurationMs) {
      summary.minDurationMs = duration;
    }

    if (summary.maxDurationMs === null || duration > summary.maxDurationMs) {
      summary.maxDurationMs = duration;
    }
  }

  summary.avgDurationMs =
    results.length > 0
      ? Number((totalDuration / results.length).toFixed(2))
      : 0;

  return summary;
}

module.exports = {
  getLoadTestServiceTypes,
  buildSampleContentXml,
  buildCallbackAckForFinalResponse,
  runLoadTest,
};
