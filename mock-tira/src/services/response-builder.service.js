const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const {
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
} = require('../constants/tiramis-roots.constant');
const { escapeXml, getTag } = require('../utils/xml.util');
const {
  buildDigitGroupReference,
} = require('./mock-response-data.service');

function buildTiraMessage(contentXml, signer) {
  const signature = signer ? signer(contentXml) : '';

  return [
    '<TiraMsg>',
    `<Content>${escapeXml(contentXml)}</Content>`,
    `<MsgSignature>${escapeXml(signature || '')}</MsgSignature>`,
    '</TiraMsg>',
  ].join('');
}

function buildRawTiraMessage(contentXml, signer) {
  const signature = signer ? signer(contentXml) : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<TiraMsg>',
    contentXml,
    `<MsgSignature>${escapeXml(signature || '')}</MsgSignature>`,
    '</TiraMsg>',
  ].join('');
}

function buildResponseId() {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  const suffix = String(Math.floor(Math.random() * 10_000_000)).padStart(
    7,
    '0',
  );

  return `${timestamp}${suffix}`;
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
  const responseId = options.responseId || buildResponseId();
  const responseData = options.responseData || {};
  const extraFields = buildFinalExtraFields(root, requestId, responseData);

  if (root === 'MotorCoverNoteRefReq' && responseData.isFleet) {
    const fleetFailed = String(code).toUpperCase() !== 'TIRA001';
    const lastFleetItemIndex = (responseData.fleetItems || []).length - 1;
    const fleetDetails = (responseData.fleetItems || [])
      .map((item, index) => {
        const itemFailed = fleetFailed && index === lastFleetItemIndex;
        const itemCode = itemFailed ? 'TIRA137' : 'TIRA001';
        const itemDesc = itemFailed
          ? 'Invalid motor registration number'
          : 'Successful';

        return [
          '<FleetResDtl>',
          `<FleetEntry>${escapeXml(item.fleetEntry)}</FleetEntry>`,
          `<CoverNoteNumber>${escapeXml(item.coverNoteNumber)}</CoverNoteNumber>`,
          `<CoverNoteReferenceNumber>${escapeXml(
            fleetFailed ? '' : item.coverNoteReferenceNumber,
          )}</CoverNoteReferenceNumber>`,
          `<StickerNumber>${escapeXml(
            fleetFailed ? '' : item.stickerNumber,
          )}</StickerNumber>`,
          `<ResponseStatusCode>${itemCode}</ResponseStatusCode>`,
          `<ResponseStatusDesc>${itemDesc}</ResponseStatusDesc>`,
          '</FleetResDtl>',
        ].join('');
      })
      .join('');

    return [
      `<${finalRoot}>`,
      '<FleetResHdr>',
      `<ResponseId>${escapeXml(responseId)}</ResponseId>`,
      `<RequestId>${escapeXml(requestId)}</RequestId>`,
      `<FleetId>${escapeXml(responseData.fleetId || '')}</FleetId>`,
      `<FleetStatusCode>${escapeXml(code)}</FleetStatusCode>`,
      `<FleetStatusDesc>${escapeXml(
        fleetFailed ? 'Failure' : desc,
      )}</FleetStatusDesc>`,
      '</FleetResHdr>',
      fleetDetails,
      buildCustomFields(responseData.customFields),
      `</${finalRoot}>`,
    ].join('');
  }

  if (root === 'MotorCoverNoteRefReq') {
    return [
      `<${finalRoot}>`,
      `<ResponseId>${escapeXml(responseId)}</ResponseId>`,
      `<RequestId>${escapeXml(requestId)}</RequestId>`,
      extraFields,
      `<ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>`,
      `<ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>`,
      buildCustomFields(responseData.customFields),
      `</${finalRoot}>`,
    ].join('');
  }

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

  if (root === 'CoverNoteVerificationReq') {
    const numericRequestId = String(requestId || '').replace(/^[^0-9]+/, '');

    return buildCoverNoteVerificationResponseContent({
      requestId,
      responseId: options.responseId || `TIRA${numericRequestId || requestId}`,
      code,
      desc,
      originalXml,
      responseData,
      includeDetails: String(code || '').trim() === 'TIRA001',
    });
  }

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

function buildCoverNoteVerificationResponseContent(params = {}) {
  const requestId = params.requestId || '';
  const responseId = params.responseId || `TIRA${requestId}`;
  const code = params.code || RESPONSE_CODES.TIRA001;
  const desc = params.desc || RESPONSE_CODES.TIRA001;
  const originalXml = params.originalXml || '';
  const responseData = params.responseData || {};
  const includeDetails = params.includeDetails !== false;
  const requestCompanyCode = getTag(originalXml, 'CompanyCode') || 'IC0003';

  const hdr = [
    '<CoverNoteHdr>',
    `<ResponseId>${escapeXml(responseId)}</ResponseId>`,
    `<RequestId>${escapeXml(requestId)}</RequestId>`,
    `<ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>`,
    `<ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>`,
    '</CoverNoteHdr>',
  ].join('');

  if (!includeDetails) {
    return [
      '<CoverNoteVerificationRes>',
      hdr,
      '</CoverNoteVerificationRes>',
    ].join('');
  }

  const requestReference =
    getTag(originalXml, 'CoverNoteReferenceNumber') ||
    responseData.coverNoteReferenceNumber ||
    '';
  const stickerNumber =
    getTag(originalXml, 'StickerNumber') ||
    responseData.stickerNumber ||
    '';
  const motorRegistrationNumber =
    getTag(originalXml, 'MotorRegistrationNumber') ||
    responseData.motorRegistrationNumber ||
    '';
  const motorChassisNumber =
    getTag(originalXml, 'MotorChassisNumber') ||
    responseData.motorChassisNumber ||
    '';

  const detailFields = [
    ['CoverNoteTypeDesc', responseData.coverNoteTypeDesc || 'New'],
    ['CoverNoteNumber', responseData.coverNoteNumber || 'SPCPLICC1130343878209SN1'],
    ['CoverNoteReferenceNumber', requestReference || '113261785840113'],
    ['InsurerCompanyCode', responseData.insurerCompanyCode || 'ICC113'],
    [
      'InsurerCompanyName',
      responseData.insurerCompanyName || 'BUMACO INSURANCE COMPANY',
    ],
    [
      'TransactionCompanyCode',
      responseData.transactionCompanyCode || 'ICC113',
    ],
    [
      'TransactionCompanyName',
      responseData.transactionCompanyName || 'BUMACO INSURANCE COMPANY',
    ],
    [
      'CoverNoteIssueDate',
      responseData.coverNoteIssueDate || '2026-06-27T01:39:23',
    ],
    [
      'CoverNoteStartDate',
      responseData.coverNoteStartDate || '2026-06-27T01:38:17',
    ],
    [
      'CoverNoteEndDate',
      responseData.coverNoteEndDate || '2027-06-26T11:59:59',
    ],
    ['CoverNoteDesc', responseData.coverNoteDesc || 'Private Vehicles'],
    ['OperativeClause', responseData.operativeClause || 'Third Party Only'],
    ['CurrencyCode', responseData.currencyCode || 'TZS'],
    [
      'TotalPremiumExcludingTax',
      responseData.totalPremiumExcludingTax || '100000.00',
    ],
    [
      'TotalPremiumIncludingTax',
      responseData.totalPremiumIncludingTax || '118000.00',
    ],
    ['CommisionPaid', responseData.commissionPaid || '12500.00'],
    ['CommisionRate', responseData.commissionRate || '0.13'],
    ['ProductCode', responseData.productCode || 'SP014001000000'],
    ['ProductName', responseData.productName || 'MOTOR PRIVATE VEHICLE'],
  ];

  const detailContent = detailFields
    .filter(([, value]) => String(value || '').trim().length > 0)
    .map(([tagName, value]) => `<${tagName}>${escapeXml(value)}</${tagName}>`)
    .join('');

  const risksCoveredXml = [
    '<RisksCovered>',
    '<RiskCovered>',
    '<RiskCode>SP014001000004</RiskCode>',
    '<RiskName>MOTOR Private Vehicles-TPO</RiskName>',
    '<SumInsured>0.00</SumInsured>',
    '<PremiumRate>0.0</PremiumRate>',
    '<PremiumBeforeDiscount>100000.00</PremiumBeforeDiscount>',
    '<PremiumAfterDiscount>100000.00</PremiumAfterDiscount>',
    '<PremiumIncludingTax>118000.00</PremiumIncludingTax>',
    '<TaxesCharged>',
    '<TaxCharged>',
    '<TaxCode>VAT-MAINLAND</TaxCode>',
    '<TaxRate>0.18</TaxRate>',
    '<TaxAmount>18000.00</TaxAmount>',
    '</TaxCharged>',
    '</TaxesCharged>',
    '</RiskCovered>',
    '</RisksCovered>',
  ].join('');

  const subjectMattersCoveredXml = [
    '<SubjectMattersCovered>',
    '<SubjectMatter>',
    '<SubjectMatterReference>HSB001</SubjectMatterReference>',
    '<SubjectMatterDesc>Vehicle</SubjectMatterDesc>',
    '</SubjectMatter>',
    '</SubjectMattersCovered>',
  ].join('');

  const motorDtlXml = [
    '<MotorDtl>',
    '<MotorCategory>1</MotorCategory>',
    '<MotorCategoryDesc>Registered</MotorCategoryDesc>',
    '<RegistrationNumber>T665CSF</RegistrationNumber>',
    '<ChassisNumber>NZE1213144335</ChassisNumber>',
    '<Make>Toyota</Make>',
    '<Model>COROLLA SPACIO</Model>',
    '<ModelNumber>TA-NZE121N</ModelNumber>',
    '<BodyType>SALOON (CLOSED TOP)</BodyType>',
    '<Color>White</Color>',
    '<EngineNumber>1NZ127659</EngineNumber>',
    '<FuelUsed>PETROL</FuelUsed>',
    '<TareWeight>1180.00</TareWeight>',
    '<GrossWeight>1280.00</GrossWeight>',
    '<MotorUsage>1</MotorUsage>',
    '<MotorUsageDesc>Private</MotorUsageDesc>',
    '<OwnerName>PHILIP MARSEL SAKAYA</OwnerName>',
    '<OwnerCategory>1</OwnerCategory>',
    '<OwnerCategoryDesc>Citizen of Tanzania</OwnerCategoryDesc>',
    '<OwnerAddress>BOX 6736 DAR ES SALAAM\n0713237867</OwnerAddress>',
    '</MotorDtl>',
  ].join('');

  return [
    '<CoverNoteVerificationRes>',
    hdr,
    '<CoverNoteDtl>',
    detailContent,
    risksCoveredXml,
    '<SubjectMattersCovered>',
    '<SubjectMatter>',
    '<SubjectMatterReference>HSB001</SubjectMatterReference>',
    '<SubjectMatterDesc>Vehicle</SubjectMatterDesc>',
    '</SubjectMatter>',
    '</SubjectMattersCovered>',
    '<CoverNoteAddons/>',
    '<PolicyHolders/>',
    motorDtlXml,
    '</CoverNoteDtl>',
    '</CoverNoteVerificationRes>',
  ].join('');
}

function buildFinalExtraFields(root, requestId, responseData = {}) {
  switch (root) {
    case 'CoverNoteRefReq':
      return [
        `<CoverNoteReferenceNumber>${escapeXml(
          responseData.coverNoteReferenceNumber ||
            buildDigitGroupReference(`cover-note:${requestId}`),
        )}</CoverNoteReferenceNumber>`,
      ].join('');
    case 'MotorCoverNoteRefReq':
      return [
        `<CoverNoteReferenceNumber>${escapeXml(
          responseData.motorCoverNoteReferenceNumber ||
            responseData.coverNoteReferenceNumber ||
            buildDigitGroupReference(`motor-cover-note:${requestId}`),
        )}</CoverNoteReferenceNumber>`,
        `<StickerNumber>${escapeXml(
          responseData.stickerNumber ||
            buildDigitGroupReference(`sticker:${requestId}`),
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
    return [
      '<CoverNoteDtl>',
      [
        [
          'CoverNoteReferenceNumber',
          getTag(originalXml, 'CoverNoteReferenceNumber'),
        ],
        ['StickerNumber', getTag(originalXml, 'StickerNumber')],
        [
          'MotorRegistrationNumber',
          getTag(originalXml, 'MotorRegistrationNumber'),
        ],
        ['MotorChassisNumber', getTag(originalXml, 'MotorChassisNumber')],
      ]
        .filter(([, value]) => String(value || '').trim().length > 0)
        .map(([tagName, value]) => `<${tagName}>${escapeXml(value)}</${tagName}>`)
        .join(''),
      `<VerificationStatus>${escapeXml(verificationStatus)}</VerificationStatus>`,
      `<VerificationMessage>${escapeXml(verificationMessage)}</VerificationMessage>`,
      '</CoverNoteDtl>',
    ].join('');
  }

  if (root === 'MotorVerificationReq') {
    const registrationNumber = getTag(
      originalXml,
      'MotorRegistrationNumber',
    );
    const chassisNumber = getTag(originalXml, 'MotorChassisNumber');

    return [
      `<MotorRegistrationNumber>${escapeXml(registrationNumber || '')}</MotorRegistrationNumber>`,
      `<MotorChassisNumber>${escapeXml(chassisNumber || '')}</MotorChassisNumber>`,
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
  buildRawTiraMessage,
  buildAcknowledgementContent,
  buildAsyncFinalResponseContent,
  buildSyncResponseContent,
  buildFailureReply,
  getDefaultSuccessDesc,
};
