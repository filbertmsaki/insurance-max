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
    type: ['application/xml', 'text/xml', 'application/soap+xml', 'text/plain', '*/xml'],
    limit: '50mb',
  }),
);

app.use(
  express.json({
    limit: '50mb',
  }),
);

const { CONFIG } = require('./src/config/mock-config');
const { MOCK_SCENARIOS } = require('./src/constants/mock-scenarios.constant');
const { RESPONSE_CODES } = require('./src/constants/response-codes.constant');
const {
  ACK_ROOTS,
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
  SEEDED_SERVICE_ENDPOINTS,
  LEGACY_MOCK_ENDPOINT,
  MOCKED_ENDPOINTS,
} = require('./src/constants/endpoints.constant');
const { nowIso, getDelayMs } = require('./src/utils/time.util');
const {
  createTrackingRecord,
  updateTracking,
  addCallbackAttempt,
  getTrackingRecord,
  listTrackingRecords,
  getPublicTrackingRecord,
  getMockStatistics,
  clearTrackingRecords,
  initializeTrackingStore,
  flushTrackingStoreBeforeExit,
} = require('./src/store/mock-request.store');
const {
  normalizeScenario,
  resolveScenario,
  scenarioToHttpFailure,
  scenarioToAckFailure,
  getScenarioAckDelay,
  getScenarioCallbackDelay,
  getScenarioFinalStatus,
  queueScenario,
  listQueuedScenarios,
} = require('./src/services/scenario.service');
const {
  validateBusinessXml,
  buildValidationFailureDescription,
} = require('./src/services/validation.service');
const {
  createTiramisRequestHandler,
} = require('./src/services/tiramis-handler.service');
const { registerMockAdminRoutes } = require('./src/routes/mock-admin.routes');
const { registerTiramisRoutes } = require('./src/routes/tiramis.routes');
const { registerLoadTestRoutes } = require('./src/routes/load-test.routes');
const { registerDashboardRoutes } = require('./src/routes/dashboard.routes');
const signatureService = require('./src/services/signature.service');
const PORT = CONFIG.port;
const trackingStoreInit = initializeTrackingStore();

console.log('[tracking-store]', trackingStoreInit);


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



function sendXml(res, xml, statusCode = 200, delayMs = 0) {
  res.set('Content-Type', 'application/xml');

  if (!delayMs || delayMs <= 0) {
    return res.status(statusCode).send(xml);
  }

  return setTimeout(() => {
    if (!res.headersSent) {
      res.status(statusCode).send(xml);
    }
  }, delayMs);
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

  const maxAttempts = Number(CONFIG.callbackRetries || 3);
  const retryDelayMs = Number(CONFIG.callbackRetryDelayMs || 5000);
  const requestId = context.requestId || null;
  const scenario = context.scenario || MOCK_SCENARIOS.SUCCESS;
  const expectedAckRoot = `${getRoot(finalResponseXml) || 'Unknown'}Ack`;
  const failFirstAttempts =
    scenario === MOCK_SCENARIOS.CALLBACK_RETRY
      ? Math.max(Number(CONFIG.callbackFailFirstAttempts || 1), 0)
      : 0;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const forcedFailure = attempt <= failFirstAttempts;

    try {
      console.log(`[callback] Attempt ${attempt}/${maxAttempts}`);

      if (forcedFailure) {
        throw new Error(
          `Forced callback failure for scenario=${scenario} attempt=${attempt}`,
        );
      }

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: finalResponseXml,
      });

      const responseText = await response.text();
      const ackContentXml = extractContentXml(responseText);
      const ackRoot = getRoot(ackContentXml || responseText);
      const ackSignature = extractSignature(responseText);

      console.log('[callback] HTTP Status:', response.status);
      console.log('[callback] Client acknowledgement root:', ackRoot || 'UNKNOWN');
      console.log('[callback] Client acknowledgement:\n', responseText);

      const ackSignatureValid = ackSignature
        ? verifySignatureWithPublicCert(
            ackContentXml,
            ackSignature,
            CONFIG.clientPublicCertPath,
            CONFIG.clientPublicCertPassword,
          )
        : null;

      const ackRootOk = ackRoot === expectedAckRoot;
      const ackSignatureOk = ackSignatureValid !== false;

      addCallbackAttempt(requestId, {
        attempt,
        status: response.ok && ackRootOk && ackSignatureOk ? 'ACKED' : 'FAILED',
        scenario,
        url: callbackUrl,
        expectedAckRoot,
        httpStatus: response.status,
        ackRoot,
        ackSignaturePresent: Boolean(ackSignature),
        ackSignatureValid,
        responseText,
      });

      if (response.ok && ackRootOk && ackSignatureOk) {
        if (requestId) {
          updateTracking(requestId, {
            status: 'CALLBACK_ACKED',
          });
        }

        console.log('[callback] Final signed response accepted by callback endpoint');
        return true;
      }

      lastError = new Error(
        `Callback acknowledgement validation failed: httpOk=${response.ok} ackRootOk=${ackRootOk} ackSignatureOk=${ackSignatureOk}`,
      );
    } catch (error) {
      lastError = error;
      console.error('[callback] Failed attempt:', attempt);
      console.error('[callback] Error:', error.message);

      addCallbackAttempt(requestId, {
        attempt,
        status: forcedFailure ? 'FORCED_FAILURE' : 'ERROR',
        scenario,
        url: callbackUrl,
        expectedAckRoot,
        error: error.message,
      });
    }

    if (requestId) {
      updateTracking(requestId, {
        status: attempt < maxAttempts ? 'CALLBACK_RETRYING' : 'CALLBACK_FAILED',
        lastError: lastError?.message || null,
      });
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
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
  const contentXml = extractContentXml(xml);
  const root = getRoot(contentXml || xml);
  const requestId = getTag(contentXml || xml, 'RequestId') || `REQ-${Date.now()}`;
  const callbackUrl = getTag(contentXml || xml, 'CallBackUrl');

  req.mockEndpointDefinition = endpointDefinition;
  const scenario = resolveScenario(req, contentXml || xml, root);

  const tracking = createTrackingRecord({
    requestId,
    root,
    serviceType: endpointDefinition.serviceType,
    endpoint: endpointDefinition.endpointUrl,
    mode: endpointDefinition.mode,
    scenario,
    callbackUrl,
    rawRequestXml: xml,
    contentXml,
    headers: {
      contentType: req.header('Content-Type') || null,
      clientCode: req.header('ClientCode') || null,
      clientKeyPresent: Boolean(req.header('ClientKey')),
      mockScenario:
        req.header('X-Mock-Scenario') ||
        req.query?.scenario ||
        getTag(contentXml || xml, 'MockScenario') ||
        null,
    },
  });

  console.log('\n========== MOCK TIRA REQUEST ==========');
  console.log('Endpoint:', endpointDefinition.endpointUrl);
  console.log('ServiceType:', endpointDefinition.serviceType);
  console.log('Mode:', endpointDefinition.mode);
  console.log('Root:', root || 'UNKNOWN');
  console.log('RequestId:', requestId);
  console.log('Scenario:', scenario);
  console.log('CallbackUrl:', callbackUrl || 'N/A');

  const httpFailure = scenarioToHttpFailure(scenario);

  if (httpFailure) {
    updateTracking(tracking, {
      status: `HTTP_${httpFailure.status}`,
      lastError: httpFailure.body,
    });

    return res.status(httpFailure.status).send(httpFailure.body);
  }

  if (scenario === MOCK_SCENARIOS.TIMEOUT_BEFORE_ACK) {
    const delayMs = getDelayMs(
      req,
      'X-Mock-Timeout-Ms',
      'timeoutMs',
      CONFIG.timeoutBeforeAckMs,
    );

    updateTracking(tracking, {
      status: 'TIMEOUT_SIMULATED',
      timeoutDelayMs: delayMs,
    });

    console.warn(
      `[scenario] timeout_before_ack: delaying response for ${delayMs}ms`,
    );

    return setTimeout(() => {
      if (!res.headersSent) {
        res
          .status(504)
          .send('Mock TIRA timeout_before_ack scenario completed after delay');
      }
    }, delayMs);
  }

  if (!root) {
    const content = buildAcknowledgementContent(
      'UnknownReq',
      requestId,
      'TIRA005',
      RESPONSE_CODES.TIRA005,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'UNKNOWN_ROOT',
      ackCode: 'TIRA005',
      ackXml: responseXml,
    });

    return sendXml(res, responseXml);
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

    updateTracking(tracking, {
      status: 'ROOT_ENDPOINT_MISMATCH',
      ackCode: 'TIRA005',
      ackXml: responseXml,
      validations: [
        `Root ${root} is not allowed for endpoint ${endpointDefinition.endpointUrl}`,
      ],
    });

    return sendXml(res, responseXml);
  }

  const scenarioAckFailure = scenarioToAckFailure(scenario);

  if (scenarioAckFailure) {
    const content = buildFailureReply(
      root,
      requestId,
      scenarioAckFailure.code,
      scenarioAckFailure.desc,
      xml,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'SCENARIO_ACK_FAILED',
      ackCode: scenarioAckFailure.code,
      ackXml: responseXml,
      validations: [scenarioAckFailure.desc],
    });

    return sendXml(
      res,
      responseXml,
      200,
      getScenarioAckDelay(req, scenario),
    );
  }

  const headerValidation = validateHeaders(req);

  updateTracking(tracking, {
    headerValidation,
  });

  if (!headerValidation.ok) {
    const content = buildFailureReply(
      root,
      requestId,
      headerValidation.code,
      headerValidation.desc,
      xml,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'HEADER_VALIDATION_FAILED',
      ackCode: headerValidation.code,
      ackXml: responseXml,
      validations: [headerValidation.desc],
    });

    return sendXml(res, responseXml);
  }

  const signatureValidation = verifyClientRequestSignature(xml);

  updateTracking(tracking, {
    signatureValidation,
  });

  if (!signatureValidation.ok) {
    const content = buildFailureReply(
      root,
      requestId,
      signatureValidation.code,
      signatureValidation.desc,
      xml,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'SIGNATURE_VALIDATION_FAILED',
      ackCode: signatureValidation.code,
      ackXml: responseXml,
      validations: [signatureValidation.desc],
    });

    return sendXml(res, responseXml);
  }

  const businessValidation = validateBusinessXml(root, contentXml || xml);

  updateTracking(tracking, {
    validations: businessValidation.errors || [],
  });

  if (!businessValidation.ok) {
    const content = buildFailureReply(
      root,
      requestId,
      'TIRA005',
      buildValidationFailureDescription(businessValidation.errors),
      xml,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'BUSINESS_VALIDATION_FAILED',
      ackCode: 'TIRA005',
      ackXml: responseXml,
    });

    return sendXml(
      res,
      responseXml,
      200,
      getScenarioAckDelay(req, scenario),
    );
  }

  if (isSyncRequest(endpointDefinition, root)) {
    const content = buildSyncResponseContent(
      root,
      requestId,
      'TIRA001',
      RESPONSE_CODES.TIRA001,
      contentXml || xml,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'SYNC_RESPONSE_SENT',
      finalCode: 'TIRA001',
      finalXml: responseXml,
    });

    return sendXml(
      res,
      responseXml,
      200,
      getScenarioAckDelay(req, scenario),
    );
  }

  if (!ASYNC_RESPONSE_ROOTS[root]) {
    const content = buildAcknowledgementContent(
      root,
      requestId,
      'TIRA005',
      `Unsupported request root: ${root}`,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'UNSUPPORTED_ASYNC_ROOT',
      ackCode: 'TIRA005',
      ackXml: responseXml,
    });

    return sendXml(res, responseXml);
  }

  if (!callbackUrl) {
    const content = buildAcknowledgementContent(
      root,
      requestId,
      'TIRA017',
      RESPONSE_CODES.TIRA017,
    );

    const responseXml = buildTiraMessage(content);

    updateTracking(tracking, {
      status: 'CALLBACK_URL_INVALID',
      ackCode: 'TIRA017',
      ackXml: responseXml,
    });

    return sendXml(res, responseXml);
  }

  const ackContent = buildAcknowledgementContent(
    root,
    requestId,
    'TIRA001',
    RESPONSE_CODES.TIRA001,
  );

  const ackXml = buildTiraMessage(ackContent);

  updateTracking(tracking, {
    status: 'ACK_SENT',
    ackCode: 'TIRA001',
    ackXml,
  });

  const ackDelayMs = getScenarioAckDelay(req, scenario);

  sendXml(res, ackXml, 200, ackDelayMs);

  console.log('[response] ACK sent');

  if (scenario === MOCK_SCENARIOS.NO_CALLBACK) {
    updateTracking(tracking, {
      status: 'ACK_SENT_NO_CALLBACK',
      finalCode: null,
    });

    console.log('[scenario] no_callback: final callback skipped');
    return;
  }

  const finalStatus = getScenarioFinalStatus(scenario);

  const finalContent = buildAsyncFinalResponseContent(
    root,
    requestId,
    finalStatus.code,
    finalStatus.desc,
  );

  const finalResponseXml = buildTiraMessage(finalContent);
  const callbackDelayMs = getScenarioCallbackDelay(req, scenario);
  const callbackScheduleDelayMs = ackDelayMs + callbackDelayMs;

  updateTracking(tracking, {
    status: 'CALLBACK_SCHEDULED',
    finalCode: finalStatus.code,
    finalXml: finalResponseXml,
    callbackDelayMs: callbackScheduleDelayMs,
  });

  console.log(
    `[callback] Final response scheduled in ${callbackScheduleDelayMs}ms for RequestId ${requestId}`,
  );

  setTimeout(() => {
    sendCallbackWithRetry(callbackUrl, finalResponseXml, {
      trackingId: tracking.id,
      serviceType: endpointDefinition.serviceType,
      endpointUrl: endpointDefinition.endpointUrl,
      root,
      requestId,
      scenario,
    });
  }, callbackScheduleDelayMs);
}

const mockTiramisRequestHandler = createTiramisRequestHandler({
  validateHeaders: signatureService.validateHeaders,
  verifyClientRequestSignature:
    signatureService.verifyClientRequestSignature,
  wrapTiraMessage: signatureService.wrapTiraMessage,
});

registerMockAdminRoutes(app, {
  wrapTiraMessage: signatureService.wrapTiraMessage,
});

registerTiramisRoutes(app, mockTiramisRequestHandler);
registerLoadTestRoutes(app);
registerDashboardRoutes(app);

function shutdown(signal) {
  console.log(`[server] Received ${signal}. Flushing mock tracking store...`);

  const result = flushTrackingStoreBeforeExit();

  console.log('[tracking-store] flush result:', result);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

app.get('/tiramis/mock/certificates', (req, res) => {
  res.json(signatureService.getCertificateHealth());
});

app.post('/tiramis/mock/certificates/reload', (req, res) => {
  signatureService.clearCertificateCache();

  res.json({
    success: true,
    message: 'Certificate cache cleared. Certificates will reload on next request.',
    health: signatureService.getCertificateHealth(),
  });
});

app.post('/tiramis/mock/tools/sign-client-content', (req, res) => {
  try {
    const contentXml = req.body || '';
    const signature = signatureService.signClientContent(contentXml);

    res.json({
      success: true,
      signature,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || String(error),
    });
  }
});

app.post('/tiramis/mock/tools/wrap-client-message', (req, res) => {
  try {
    const contentXml = req.body || '';
    const tiraMsg = signatureService.wrapClientTiraMessage(contentXml);

    res.set('Content-Type', 'application/xml');
    res.send(tiraMsg);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || String(error),
    });
  }
});

app.post('/tiramis/mock/tools/verify-tira-response', (req, res) => {
  const xml = req.body || '';

  res.json({
    success: true,
    verification: signatureService.verifyTiraResponseSignature(xml),
  });
});

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
  console.log(`Dashboard: http://localhost:${PORT}/tiramis/mock/dashboard`);
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


