require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

const app = express();
const PROJECT_ROOT = __dirname;

app.use(
  express.text({
    type: ['application/xml', 'text/xml', '*/*'],
    limit: '20mb',
  }),
);

const PORT = Number(process.env.PORT || 5050);

const CONFIG = {
  clientCode: process.env.CLIENT_CODE || '',
  clientKey: process.env.CLIENT_KEY || '',

  verifyIncomingSignature: process.env.VERIFY_INCOMING_SIGNATURE === 'true',
  signResponses: process.env.SIGN_RESPONSES !== 'false',
  allowMockSignature: process.env.ALLOW_MOCK_SIGNATURE === 'true',

  signatureXmlMode: process.env.SIGNATURE_XML_MODE || 'compact',

  clientPublicCertPath:
    process.env.CLIENT_PUBLIC_CERT_PATH ||
    './certs/client/tiramisclientpublic.pfx',

  clientPublicCertPassword:
    process.env.CLIENT_PUBLIC_CERT_PASSWORD ||
    process.env.CLIENT_PFX_PASSWORD ||
    'password',

  tiraPrivatePfxPath:
    process.env.TIRA_PRIVATE_PFX_PATH ||
    './certs/tira/mock-tira-private.pfx',

  tiraPrivatePfxPassword:
    process.env.TIRA_PRIVATE_PFX_PASSWORD ||
    process.env.TIRA_PFX_PASSWORD ||
    'password',

  tiraPublicCertPath:
    process.env.TIRA_PUBLIC_CERT_PATH ||
    './certs/tira/mock-tira-public.pfx',

  tiraPublicCertPassword:
    process.env.TIRA_PUBLIC_CERT_PASSWORD ||
    process.env.TIRA_PRIVATE_PFX_PASSWORD ||
    process.env.TIRA_PFX_PASSWORD ||
    'password',

  callbackDelayMs: Number(process.env.CALLBACK_DELAY_MS || 3000),
  callbackRetries: Number(process.env.CALLBACK_RETRIES || 3),
  callbackRetryDelayMs: Number(process.env.CALLBACK_RETRY_DELAY_MS || 5000),
};

const RESPONSE_CODES = {
  TIRA001: 'Successful',
  TIRA002: 'Failure',
  TIRA003: 'Invalid client key',
  TIRA004: 'An error occurred while processing',
  TIRA005: 'Invalid or incomplete request data',
  TIRA006: 'Request could not be processed. Try again later',
  TIRA007: 'Requested data could not be found',
  TIRA008: 'Required request header information not provided',
  TIRA009: 'Request header information mismatch client identification parameters',
  TIRA010: 'Server internal communication failure',
  TIRA011: 'Client system configuration not found',
  TIRA012: 'Inactive or disabled client system configuration',
  TIRA013: 'Inactive or invalid client',
  TIRA014: 'Client PKI certificate file not found in specified path',
  TIRA015: 'Bad or missing Client PKI configurations',
  TIRA016: 'Invalid request signature',
  TIRA017: 'Invalid client system call back url',
};

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

function resolveProjectPath(filePath) {
  if (!filePath) {
    return null;
  }

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(PROJECT_ROOT, filePath);
}

function displayProjectPath(filePath) {
  const resolvedPath = resolveProjectPath(filePath);

  if (!resolvedPath) {
    return 'N/A';
  }

  const relativePath = path.relative(PROJECT_ROOT, resolvedPath);
  return relativePath && !relativePath.startsWith('..')
    ? `./${relativePath.replace(/\\/g, '/')}`
    : resolvedPath;
}

function fileExists(filePath) {
  const resolved = resolveProjectPath(filePath);
  return Boolean(resolved && fs.existsSync(resolved));
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 9999)}`;
}

function getTag(xml, tagName) {
  const match = String(xml || '').match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
  );

  return match?.[1]?.trim() || null;
}

function removeXmlDeclaration(xml) {
  return String(xml || '')
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/i, '')
    .trim();
}

function removeWrapperIndent(xml) {
  const lines = String(xml || '').replace(/\r\n/g, '\n').split('\n');
  const firstContentLine = lines.find((line) => line.trim());

  if (!firstContentLine) {
    return String(xml || '');
  }

  const indent = firstContentLine.match(/^[ \t]*/)?.[0] || '';

  if (!indent) {
    return String(xml || '');
  }

  return lines
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n');
}

function extractContentXml(xml) {
  const raw = removeXmlDeclaration(xml);

  const tiraMatch = raw.match(/<TiraMsg[^>]*>([\s\S]*?)<\/TiraMsg>/i);
  const insideTira = tiraMatch ? tiraMatch[1] : raw;

  const withoutSignature = insideTira.replace(
    /<MsgSignature[^>]*>[\s\S]*?<\/MsgSignature>/i,
    '',
  );

  return removeWrapperIndent(withoutSignature).trim();
}

function extractSignature(xml) {
  return getTag(xml, 'MsgSignature');
}

function getRoot(xml) {
  const contentXml = extractContentXml(xml);
  const match = contentXml.match(/<([A-Za-z0-9_:.-]+)(\s|>)/);
  return match?.[1] || null;
}

function normalizeXmlForSignature(xml) {
  let normalized = removeXmlDeclaration(xml)
    .replace(/\r\n/g, '\n')
    .trim();

  if (CONFIG.signatureXmlMode === 'compact') {
    normalized = normalized.replace(/>\s+</g, '><');
  }

  if (CONFIG.signatureXmlMode === 'preserve') {
    return `${normalized}\n`;
  }

  return normalized;
}

function loadPkcs12Material(pfxPath, password) {
  const resolvedPath = resolveProjectPath(pfxPath);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`PFX certificate file not found: ${resolvedPath}`);
  }

  console.log(`[cert] Loading PKCS#12 material from ${displayProjectPath(resolvedPath)}`);

  const pfxBuffer = fs.readFileSync(resolvedPath);
  const pfxBinary = pfxBuffer.toString('binary');

  const asn1 = forge.asn1.fromDer(pfxBinary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password || '');

  let privateKeyPem = null;
  let publicCertPem = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (
        !privateKeyPem &&
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          safeBag.type === forge.pki.oids.keyBag) &&
        safeBag.key
      ) {
        privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
      }

      if (
        !publicCertPem &&
        safeBag.type === forge.pki.oids.certBag &&
        safeBag.cert
      ) {
        publicCertPem = forge.pki.certificateToPem(safeBag.cert);
      }
    }
  }

  console.log(
    `[cert] Loaded ${displayProjectPath(resolvedPath)} ` +
      `(privateKey=${Boolean(privateKeyPem)}, publicCert=${Boolean(publicCertPem)})`,
  );

  return {
    privateKeyPem,
    publicCertPem,
  };
}

function loadPrivateKeyFromPfx(pfxPath, password) {
  const material = loadPkcs12Material(pfxPath, password);

  if (!material.privateKeyPem) {
    throw new Error(`Private key not found inside PFX: ${pfxPath}`);
  }

  return material.privateKeyPem;
}

function loadPublicCertificate(certOrPfxPath, password) {
  const resolvedPath = resolveProjectPath(certOrPfxPath);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Public certificate file not found: ${resolvedPath}`);
  }

  console.log(`[cert] Loading public certificate from ${displayProjectPath(resolvedPath)}`);

  const extension = path.extname(resolvedPath).toLowerCase();

  if (extension === '.pfx' || extension === '.p12') {
    const material = loadPkcs12Material(resolvedPath, password);

    if (!material.publicCertPem) {
      throw new Error(`Public certificate not found inside PFX: ${certOrPfxPath}`);
    }

    console.log(`[cert] Public certificate ready from ${displayProjectPath(resolvedPath)}`);
    return material.publicCertPem;
  }

  const certBuffer = fs.readFileSync(resolvedPath);
  const certText = certBuffer.toString('utf8');

  if (certText.includes('-----BEGIN CERTIFICATE-----')) {
    console.log(`[cert] Public certificate ready from ${displayProjectPath(resolvedPath)}`);
    return certText;
  }

  const certBinary = certBuffer.toString('binary');
  const asn1 = forge.asn1.fromDer(certBinary);
  const cert = forge.pki.certificateFromAsn1(asn1);

  console.log(`[cert] Public certificate ready from ${displayProjectPath(resolvedPath)}`);
  return forge.pki.certificateToPem(cert);
}

function createSignatureWithPrivatePfx(contentXml, privatePfxPath, password) {
  console.log(`[sign] Creating RSA-SHA1 signature with ${displayProjectPath(privatePfxPath)}`);

  const privateKeyPem = loadPrivateKeyFromPfx(privatePfxPath, password);
  const contentToSign = normalizeXmlForSignature(contentXml);

  const signer = crypto.createSign('RSA-SHA1');
  signer.update(contentToSign, 'utf8');
  signer.end();

  const signature = signer.sign(privateKeyPem, 'base64');
  console.log(`[sign] Signature created (${signature.length} base64 chars)`);

  return signature;
}

function verifySignatureWithPublicCert(
  contentXml,
  signatureBase64,
  publicCertPath,
  publicCertPassword,
) {
  if (!signatureBase64) {
    return false;
  }

  if (CONFIG.allowMockSignature && signatureBase64 === 'MOCK_SIGNATURE') {
    console.log('[verify] MOCK_SIGNATURE accepted because ALLOW_MOCK_SIGNATURE=true');
    return true;
  }

  console.log(`[verify] Verifying RSA-SHA1 signature with ${displayProjectPath(publicCertPath)}`);

  const publicCertPem = loadPublicCertificate(publicCertPath, publicCertPassword);
  const contentToVerify = normalizeXmlForSignature(contentXml);

  const verifier = crypto.createVerify('RSA-SHA1');
  verifier.update(contentToVerify, 'utf8');
  verifier.end();

  const valid = verifier.verify(publicCertPem, signatureBase64, 'base64');
  console.log(`[verify] Signature verification result: ${valid ? 'valid' : 'invalid'}`);

  return valid;
}

function signAsMockTira(contentXml) {
  return createSignatureWithPrivatePfx(
    contentXml,
    CONFIG.tiraPrivatePfxPath,
    CONFIG.tiraPrivatePfxPassword,
  );
}

function verifyClientRequestSignature(fullXml) {
  if (!CONFIG.verifyIncomingSignature) {
    console.log('[verify] Incoming request signature verification skipped by config');
    return {
      ok: true,
      skipped: true,
    };
  }

  console.log('[verify] Verifying incoming client request signature');

  const contentXml = extractContentXml(fullXml);
  const signatureBase64 = extractSignature(fullXml);

  if (!signatureBase64) {
    console.warn('[verify] Incoming request is missing MsgSignature');
    return {
      ok: false,
      code: 'TIRA016',
      desc: 'Missing MsgSignature',
    };
  }

  try {
    const valid = verifySignatureWithPublicCert(
      contentXml,
      signatureBase64,
      CONFIG.clientPublicCertPath,
      CONFIG.clientPublicCertPassword,
    );

    if (!valid) {
      console.warn('[verify] Incoming client request signature is invalid');
      return {
        ok: false,
        code: 'TIRA016',
        desc: RESPONSE_CODES.TIRA016,
      };
    }

    console.log('[verify] Incoming client request signature is valid');
    return {
      ok: true,
    };
  } catch (error) {
    console.error('[verify] Incoming client request signature verification failed:', error.message);
    return {
      ok: false,
      code: 'TIRA015',
      desc: `${RESPONSE_CODES.TIRA015}: ${error.message}`,
    };
  }
}

function buildTiraMessage(contentXml) {
  let signature = 'MOCK_SIGNATURE';

  if (CONFIG.signResponses) {
    console.log('[sign] Signing mock TIRA response message');
    signature = signAsMockTira(contentXml);
  } else {
    console.log('[sign] Response signing disabled; using MOCK_SIGNATURE');
  }

  return `
<TiraMsg>
${contentXml}
<MsgSignature>${signature}</MsgSignature>
</TiraMsg>
`.trim();
}

function validateHeaders(req) {
  const contentType = req.header('Content-Type') || '';
  const clientCode = req.header('ClientCode');
  const clientKey = req.header('ClientKey');

  if (!contentType.toLowerCase().includes('xml')) {
    return {
      ok: false,
      code: 'TIRA005',
      desc: 'Content-Type must be application/xml',
    };
  }

  if (!clientCode || !clientKey) {
    return {
      ok: false,
      code: 'TIRA008',
      desc: RESPONSE_CODES.TIRA008,
    };
  }

  if (CONFIG.clientCode && clientCode !== CONFIG.clientCode) {
    return {
      ok: false,
      code: 'TIRA009',
      desc: RESPONSE_CODES.TIRA009,
    };
  }

  if (CONFIG.clientKey && clientKey !== CONFIG.clientKey) {
    return {
      ok: false,
      code: 'TIRA003',
      desc: RESPONSE_CODES.TIRA003,
    };
  }

  return {
    ok: true,
  };
}

function isRootAllowedForEndpoint(endpointDefinition, root) {
  if (!root || !endpointDefinition?.requestRoots?.length) {
    return true;
  }

  return endpointDefinition.requestRoots.includes(root);
}

function isSyncRequest(endpointDefinition, root) {
  if (endpointDefinition?.mode === 'sync') {
    return true;
  }

  if (endpointDefinition?.mode === 'async') {
    return false;
  }

  return Boolean(SYNC_RESPONSE_ROOTS[root]);
}

function getEndpointSummary(endpointDefinition) {
  return {
    serviceType: endpointDefinition.serviceType,
    endpointUrl: endpointDefinition.endpointUrl,
    mode: endpointDefinition.mode,
    requestRoots: endpointDefinition.requestRoots,
  };
}

function getMockedEndpointSummaries() {
  return MOCKED_ENDPOINTS.map(getEndpointSummary);
}

function buildAcknowledgementContent(root, requestId, code, desc) {
  const ackRoot = ACK_ROOTS[root] || 'UnknownReqAck';

  return `
<${ackRoot}>
  <AcknowledgementId>${escapeXml(makeId('ACK'))}</AcknowledgementId>
  <RequestId>${escapeXml(requestId)}</RequestId>
  <AcknowledgementStatusCode>${escapeXml(code)}</AcknowledgementStatusCode>
  <AcknowledgementStatusDesc>${escapeXml(desc)}</AcknowledgementStatusDesc>
</${ackRoot}>
`.trim();
}

function buildAsyncFinalResponseContent(root, requestId, code, desc) {
  const responseRoot = ASYNC_RESPONSE_ROOTS[root];

  if (!responseRoot) {
    return null;
  }

  let extra = '';

  if (responseRoot === 'CoverNoteRefRes') {
    extra = `
  <CoverNoteReferenceNumber>TIRA-CN-${Date.now()}</CoverNoteReferenceNumber>`;
  }

  if (responseRoot === 'MotorCoverNoteRefRes') {
    extra = `
  <CoverNoteReferenceNumber>TIRA-MCN-${Date.now()}</CoverNoteReferenceNumber>
  <StickerNumber>STK-${Date.now()}</StickerNumber>`;
  }

  if (responseRoot === 'ReinsuranceRes') {
    extra = `
  <ReinsuranceReferenceNumber>TIRA-RI-${Date.now()}</ReinsuranceReferenceNumber>`;
  }

  if (responseRoot === 'PolicyRes') {
    extra = `
  <PolicyReferenceNumber>TIRA-POL-${Date.now()}</PolicyReferenceNumber>`;
  }

  if (responseRoot === 'ClaimNotificationRefRes') {
    extra = `
  <ClaimReferenceNumber>TIRA-CLM-${Date.now()}</ClaimReferenceNumber>`;
  }

  return `
<${responseRoot}>
  <ResponseId>${escapeXml(makeId('RES'))}</ResponseId>
  <RequestId>${escapeXml(requestId)}</RequestId>${extra}
  <ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>
  <ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>
</${responseRoot}>
`.trim();
}

function buildSyncResponseContent(root, requestId, code, desc, requestXml) {
  const responseRoot = SYNC_RESPONSE_ROOTS[root] || 'UnknownVerificationRes';

  let extra = '';

  if (responseRoot === 'CoverNoteVerificationRes') {
    extra = `
  <CoverNoteReferenceNumber>${escapeXml(
    getTag(requestXml, 'CoverNoteReferenceNumber') || `TIRA-CN-${Date.now()}`,
  )}</CoverNoteReferenceNumber>
  <CoverNoteNumber>${escapeXml(
    getTag(requestXml, 'CoverNoteNumber') || `CN-${Date.now()}`,
  )}</CoverNoteNumber>
  <VerificationStatus>VERIFIED</VerificationStatus>`;
  }

  if (responseRoot === 'NINVerificationRes') {
    extra = `
  <NIN>${escapeXml(
    getTag(requestXml, 'NIN') ||
      getTag(requestXml, 'NationalIdNumber') ||
      '19900101123456789000',
  )}</NIN>
  <FirstName>MOCK</FirstName>
  <MiddleName>TIRA</MiddleName>
  <LastName>CLIENT</LastName>
  <VerificationStatus>VERIFIED</VerificationStatus>`;
  }

  if (responseRoot === 'CompanyVerificationRes') {
    extra = `
  <CompanyName>MOCK COMPANY LIMITED</CompanyName>
  <TIN>${escapeXml(getTag(requestXml, 'TIN') || '100000000')}</TIN>
  <VerificationStatus>VERIFIED</VerificationStatus>`;
  }

  if (
    responseRoot === 'MotorVerificationRes' ||
    responseRoot === 'DetailsVerificationRes'
  ) {
    extra = `
  <RegistrationNumber>${escapeXml(
    getTag(requestXml, 'RegistrationNumber') ||
      getTag(requestXml, 'RegNo') ||
      'T123ABC',
  )}</RegistrationNumber>
  <ChassisNumber>${escapeXml(
    getTag(requestXml, 'ChassisNumber') || 'MOCKCHASSIS123456',
  )}</ChassisNumber>
  <Make>${escapeXml(getTag(requestXml, 'Make') || 'TOYOTA')}</Make>
  <Model>${escapeXml(getTag(requestXml, 'Model') || 'IST')}</Model>
  <MotorDescription>Mock motor details verified successfully</MotorDescription>
  <VerificationStatus>VERIFIED</VerificationStatus>`;
  }

  return `
<${responseRoot}>
  <ResponseId>${escapeXml(makeId('RES'))}</ResponseId>
  <RequestId>${escapeXml(requestId)}</RequestId>${extra}
  <ResponseStatusCode>${escapeXml(code)}</ResponseStatusCode>
  <ResponseStatusDesc>${escapeXml(desc)}</ResponseStatusDesc>
</${responseRoot}>
`.trim();
}

async function sendCallbackWithRetry(callbackUrl, finalResponseXml, context = {}) {
  console.log(`[callback] Sending signed final response to ${callbackUrl}`);
  console.log('[callback] Service type:', context.serviceType || 'UNKNOWN');
  console.log('[callback] Request root:', context.root || 'UNKNOWN');
  console.log('[callback] RequestId:', context.requestId || 'UNKNOWN');

  for (let attempt = 1; attempt <= CONFIG.callbackRetries; attempt++) {
    try {
      console.log(`[callback] Attempt ${attempt}/${CONFIG.callbackRetries}`);

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: finalResponseXml,
      });

      const responseText = await response.text();

      console.log('[callback] HTTP Status:', response.status);
      console.log('[callback] Client acknowledgement:\n', responseText);

      if (response.ok) {
        console.log('[callback] Final signed response accepted by callback endpoint');
        return true;
      }
    } catch (error) {
      console.error('[callback] Failed attempt:', attempt);
      console.error('[callback] Error:', error.message);
    }

    if (attempt < CONFIG.callbackRetries) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.callbackRetryDelayMs),
      );
    }
  }

  console.error('[callback] Exhausted callback retries without success');
  return false;
}

function inspectPfxMaterial(label, pfxPath, password) {
  const result = {
    path: pfxPath,
    displayPath: displayProjectPath(pfxPath),
    exists: fileExists(pfxPath),
    loads: false,
    hasPrivateKey: false,
    hasPublicCert: false,
  };

  try {
    const material = loadPkcs12Material(pfxPath, password);
    result.loads = true;
    result.hasPrivateKey = Boolean(material.privateKeyPem);
    result.hasPublicCert = Boolean(material.publicCertPem);
    console.log(`[config-health] ${label} loaded successfully`);
  } catch (error) {
    result.error = error.message;
    console.error(`[config-health] ${label} failed to load:`, error.message);
  }

  return result;
}

function inspectPublicCertificate(label, certPath, password) {
  const result = {
    path: certPath,
    displayPath: displayProjectPath(certPath),
    exists: fileExists(certPath),
    loads: false,
    hasPublicCert: false,
  };

  try {
    loadPublicCertificate(certPath, password);
    result.loads = true;
    result.hasPublicCert = true;
    console.log(`[config-health] ${label} loaded successfully`);
  } catch (error) {
    result.error = error.message;
    console.error(`[config-health] ${label} failed to load:`, error.message);
  }

  return result;
}

function buildFailureReply(root, requestId, code, desc, originalXml) {
  if (SYNC_RESPONSE_ROOTS[root]) {
    return buildSyncResponseContent(root, requestId, code, desc, originalXml);
  }

  return buildAcknowledgementContent(root, requestId, code, desc);
}

async function handleTiramisRequest(req, res, endpointDefinition) {
  const xml = req.body || '';

  const root = getRoot(xml);
  const requestId = getTag(xml, 'RequestId') || `REQ-${Date.now()}`;
  const callbackUrl = getTag(xml, 'CallBackUrl');

  console.log('\nReceived TIRAMIS request');
  console.log('Endpoint:', endpointDefinition.endpointUrl);
  console.log('ServiceType:', endpointDefinition.serviceType);
  console.log('Mode:', endpointDefinition.mode);
  console.log('Root:', root || 'UNKNOWN');
  console.log('RequestId:', requestId);
  console.log('CallbackUrl:', callbackUrl || 'N/A');

  res.set('Content-Type', 'application/xml');

  if (!root) {
    const content = buildAcknowledgementContent(
      'UnknownReq',
      requestId,
      'TIRA005',
      RESPONSE_CODES.TIRA005,
    );

    const responseXml = buildTiraMessage(content);
    console.log('[response] Unknown-root acknowledgement sent');
    return res.status(200).send(responseXml);
  }

  if (!isRootAllowedForEndpoint(endpointDefinition, root)) {
    console.warn(
      `[route] Root ${root} is not configured for ${endpointDefinition.endpointUrl}`,
    );

    const content = buildFailureReply(
      root,
      requestId,
      'TIRA005',
      `Unsupported request root ${root} for endpoint ${endpointDefinition.endpointUrl}`,
      xml,
    );

    const responseXml = buildTiraMessage(content);
    console.log('[response] Endpoint/root mismatch response sent');
    return res.status(200).send(responseXml);
  }

  const headerValidation = validateHeaders(req);

  if (!headerValidation.ok) {
    const content = buildFailureReply(
      root,
      requestId,
      headerValidation.code,
      headerValidation.desc,
      xml,
    );

    const responseXml = buildTiraMessage(content);
    console.log(
      `[response] Header validation failure sent (${headerValidation.code})`,
    );
    return res.status(200).send(responseXml);
  }

  const signatureValidation = verifyClientRequestSignature(xml);

  if (!signatureValidation.ok) {
    const content = buildFailureReply(
      root,
      requestId,
      signatureValidation.code,
      signatureValidation.desc,
      xml,
    );

    const responseXml = buildTiraMessage(content);
    console.log(
      `[response] Signature verification failure sent (${signatureValidation.code})`,
    );
    return res.status(200).send(responseXml);
  }

  if (isSyncRequest(endpointDefinition, root)) {
    const content = buildSyncResponseContent(
      root,
      requestId,
      'TIRA001',
      RESPONSE_CODES.TIRA001,
      xml,
    );

    const responseXml = buildTiraMessage(content);
    console.log('[response] Synchronous signed final response sent');
    return res.status(200).send(responseXml);
  }

  if (!ASYNC_RESPONSE_ROOTS[root]) {
    const content = buildAcknowledgementContent(
      root,
      requestId,
      'TIRA005',
      `Unsupported request root: ${root}`,
    );

    const responseXml = buildTiraMessage(content);
    console.log('[response] Unsupported async-root acknowledgement sent');
    return res.status(200).send(responseXml);
  }

  if (!callbackUrl) {
    const content = buildAcknowledgementContent(
      root,
      requestId,
      'TIRA017',
      RESPONSE_CODES.TIRA017,
    );

    const responseXml = buildTiraMessage(content);
    console.log('[response] Missing-callback acknowledgement sent');
    return res.status(200).send(responseXml);
  }

  const ackContent = buildAcknowledgementContent(
    root,
    requestId,
    'TIRA001',
    RESPONSE_CODES.TIRA001,
  );

  const ackXml = buildTiraMessage(ackContent);

  res.status(200).send(ackXml);
  console.log('[response] Signed acknowledgement sent');

  const finalContent = buildAsyncFinalResponseContent(
    root,
    requestId,
    'TIRA001',
    RESPONSE_CODES.TIRA001,
  );

  const finalResponseXml = buildTiraMessage(finalContent);

  console.log(
    `[callback] Scheduling final signed response to ${callbackUrl} ` +
      `in ${CONFIG.callbackDelayMs}ms`,
  );

  setTimeout(() => {
    sendCallbackWithRetry(callbackUrl, finalResponseXml, {
      serviceType: endpointDefinition.serviceType,
      endpointUrl: endpointDefinition.endpointUrl,
      root,
      requestId,
    });
  }, CONFIG.callbackDelayMs);
}

for (const endpointDefinition of SEEDED_SERVICE_ENDPOINTS) {
  app.post(endpointDefinition.endpointUrl, (req, res) =>
    handleTiramisRequest(req, res, endpointDefinition),
  );
}

app.post(LEGACY_MOCK_ENDPOINT.endpointUrl, (req, res) =>
  handleTiramisRequest(req, res, LEGACY_MOCK_ENDPOINT),
);

app.post('/tiramis/tools/sign-as-client', (req, res) => {
  try {
    const clientPrivatePfxPath =
      process.env.CLIENT_PRIVATE_PFX_PATH ||
      './certs/client/tiramisclientprivate.pfx';

    const clientPrivatePfxPassword =
      process.env.CLIENT_PRIVATE_PFX_PASSWORD ||
      process.env.CLIENT_PFX_PASSWORD ||
      'password';

    const inputXml = req.body || '';
    const contentXml = inputXml.includes('<TiraMsg')
      ? extractContentXml(inputXml)
      : inputXml.trim();

    const signature = createSignatureWithPrivatePfx(
      contentXml,
      clientPrivatePfxPath,
      clientPrivatePfxPassword,
    );

    const signedXml = `
<TiraMsg>
${contentXml}
<MsgSignature>${signature}</MsgSignature>
</TiraMsg>
`.trim();

    res.json({
      success: true,
      note: 'This is only a local testing helper. In real flow, your application signs using client private certificate.',
      signature,
      signedXml,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/tiramis/tools/sign-as-tira', (req, res) => {
  try {
    const inputXml = req.body || '';
    const contentXml = inputXml.includes('<TiraMsg')
      ? extractContentXml(inputXml)
      : inputXml.trim();

    const signature = signAsMockTira(contentXml);

    const signedXml = `
<TiraMsg>
${contentXml}
<MsgSignature>${signature}</MsgSignature>
</TiraMsg>
`.trim();

    res.json({
      success: true,
      note: 'Mock TIRA signed this payload using TIRA private PFX.',
      signature,
      signedXml,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/tiramis/tools/verify-client-signature', (req, res) => {
  try {
    const inputXml = req.body || '';
    const contentXml = extractContentXml(inputXml);
    const signature = extractSignature(inputXml);

    const valid = verifySignatureWithPublicCert(
      contentXml,
      signature,
      CONFIG.clientPublicCertPath,
      CONFIG.clientPublicCertPassword,
    );

    res.json({
      success: true,
      valid,
      note: 'Verified using client public certificate.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message,
    });
  }
});

app.post('/tiramis/tools/verify-tira-signature', (req, res) => {
  try {
    const inputXml = req.body || '';
    const contentXml = extractContentXml(inputXml);
    const signature = extractSignature(inputXml);

    const valid = verifySignatureWithPublicCert(
      contentXml,
      signature,
      CONFIG.tiraPublicCertPath,
      CONFIG.tiraPublicCertPassword,
    );

    res.json({
      success: true,
      valid,
      note: 'Verified using TIRA public certificate.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mock-tira',
    port: PORT,
    endpoint: `http://localhost:${PORT}/tiramis/mock`,
    mockedEndpointCount: MOCKED_ENDPOINTS.length,
    mockedEndpoints: getMockedEndpointSummaries(),
    verifyIncomingSignature: CONFIG.verifyIncomingSignature,
    signResponses: CONFIG.signResponses,
    signatureXmlMode: CONFIG.signatureXmlMode,
  });
});

app.get('/config-health', (req, res) => {
  const clientPublicCert = inspectPublicCertificate(
    'client public certificate',
    CONFIG.clientPublicCertPath,
    CONFIG.clientPublicCertPassword,
  );
  const tiraPrivatePfx = inspectPfxMaterial(
    'mock TIRA private PFX',
    CONFIG.tiraPrivatePfxPath,
    CONFIG.tiraPrivatePfxPassword,
  );
  const tiraPublicCert = inspectPublicCertificate(
    'mock TIRA public certificate',
    CONFIG.tiraPublicCertPath,
    CONFIG.tiraPublicCertPassword,
  );

  res.json({
    status: 'ok',
    clientCodeConfigured: Boolean(CONFIG.clientCode),
    clientKeyConfigured: Boolean(CONFIG.clientKey),

    clientPublicCertPath: CONFIG.clientPublicCertPath,
    clientPublicCertExists: fileExists(CONFIG.clientPublicCertPath),
    clientPublicCertLoads: clientPublicCert.loads,

    tiraPrivatePfxPath: CONFIG.tiraPrivatePfxPath,
    tiraPrivatePfxExists: fileExists(CONFIG.tiraPrivatePfxPath),
    tiraPrivatePfxLoads: tiraPrivatePfx.loads,
    tiraPrivatePfxHasPrivateKey: tiraPrivatePfx.hasPrivateKey,

    tiraPublicCertPath: CONFIG.tiraPublicCertPath,
    tiraPublicCertExists: fileExists(CONFIG.tiraPublicCertPath),
    tiraPublicCertLoads: tiraPublicCert.loads,

    verifyIncomingSignature: CONFIG.verifyIncomingSignature,
    signResponses: CONFIG.signResponses,
    allowMockSignature: CONFIG.allowMockSignature,
    signatureXmlMode: CONFIG.signatureXmlMode,
    mockedEndpointCount: MOCKED_ENDPOINTS.length,
    mockedEndpoints: getMockedEndpointSummaries(),

    certificates: {
      clientPublicCert,
      tiraPrivatePfx,
      tiraPublicCert,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Mock TIRA running on http://localhost:${PORT}`);
  console.log(`Mock endpoint: http://localhost:${PORT}/tiramis/mock`);
  console.log('[config] Seeded service endpoints:');
  for (const endpointDefinition of SEEDED_SERVICE_ENDPOINTS) {
    console.log(
      `[config] ${endpointDefinition.serviceType} ${endpointDefinition.endpointUrl} ` +
        `(${endpointDefinition.mode}, roots=${endpointDefinition.requestRoots.join(',')})`,
    );
  }
  console.log(`[config] Project root: ${PROJECT_ROOT}`);
  console.log(`[config] Client public certificate: ${displayProjectPath(CONFIG.clientPublicCertPath)}`);
  console.log(`[config] Mock TIRA private PFX: ${displayProjectPath(CONFIG.tiraPrivatePfxPath)}`);
  console.log(`[config] Mock TIRA public certificate: ${displayProjectPath(CONFIG.tiraPublicCertPath)}`);
  console.log(`[config] Verify incoming signatures: ${CONFIG.verifyIncomingSignature}`);
  console.log(`[config] Sign responses: ${CONFIG.signResponses}`);
});
