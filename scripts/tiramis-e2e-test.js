const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(process.cwd(), '.env.e2e'));
loadEnv(path.join(process.cwd(), 'apps', 'insurance-portal-service', '.env.e2e'));

const config = {
  portalBaseUrl: process.env.PORTAL_BASE_URL || 'http://localhost:9090',
  tiramisServiceBaseUrl:
    process.env.TIRAMIS_SERVICE_BASE_URL || 'http://localhost:9091',
  mockTiraBaseUrl: process.env.MOCK_TIRA_BASE_URL || 'http://localhost:5050',
  token: process.env.E2E_AUTH_TOKEN,
  authEmail:
    process.env.E2E_AUTH_EMAIL ||
    process.env.INITIAL_COMPANY_ADMIN_EMAIL ||
    process.env.INITIAL_OWNER_EMAIL ||
    'inocent@alliance.co.tz',
  authPassword:
    process.env.E2E_AUTH_PASSWORD ||
    process.env.INITIAL_COMPANY_ADMIN_PASSWORD ||
    process.env.INITIAL_OWNER_PASSWORD ||
    'Admin123!',
  requestType: process.env.E2E_REQUEST_TYPE || 'NIN_VERIFICATION',
  validateOnly:
    process.env.E2E_VALIDATE_ONLY === 'true' ||
    process.env.E2E_SKIP_SUBMIT === 'true',
  sourceModule: process.env.E2E_SOURCE_MODULE || 'verifications',
  sourceRecordId:
    process.env.E2E_SOURCE_RECORD_ID ||
    process.env.E2E_NIN ||
    '19900101123456789001',
  businessReference:
    process.env.E2E_BUSINESS_REFERENCE ||
    process.env.E2E_SOURCE_RECORD_ID ||
    process.env.E2E_NIN ||
    '19900101123456789001',
  nin: process.env.E2E_NIN || '19900101123456789001',
  timeoutMs: Number(process.env.E2E_TIMEOUT_MS || 60000),
  tiramisEnvironment: process.env.E2E_TIRAMIS_ENV || 'test',
};

const portalApiBaseUrl = `${config.portalBaseUrl.replace(/\/$/, '')}/api/v1`;

const results = [];
let summaryPrinted = false;

function now() {
  return new Date().toISOString();
}

function mask(value) {
  if (!value) {
    return value;
  }

  const str = String(value);

  if (str.length <= 10) {
    return '********';
  }

  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function logStep(title) {
  console.log(`\n========== ${title} ==========`);
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logFail(message) {
  console.log(`FAIL ${message}`);
}

function saveResult(name, status, data, error) {
  results.push({
    name,
    status,
    at: now(),
    data,
    error: error ? String(error.message || error) : null,
  });
}

function unwrapApiData(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if ('data' in payload) {
    return payload.data;
  }

  return payload;
}

function loadJsonPayload() {
  if (process.env.E2E_PAYLOAD_JSON) {
    return JSON.parse(process.env.E2E_PAYLOAD_JSON);
  }

  if (process.env.E2E_PAYLOAD_FILE) {
    const payloadPath = path.resolve(process.cwd(), process.env.E2E_PAYLOAD_FILE);
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  }

  return null;
}

const configuredPayload = loadJsonPayload();

function buildSubmissionPayload() {
  if (configuredPayload) {
    return configuredPayload;
  }

  switch (config.requestType) {
    case 'COMPANY_VERIFICATION':
      return {
        companyName: process.env.E2E_COMPANY_NAME || 'ACME Insurance Ltd',
      };
    case 'COVER_NOTE_VERIFICATION':
      return {
        coverNoteReferenceNumber:
          process.env.E2E_COVER_NOTE_REFERENCE ||
          process.env.E2E_BUSINESS_REFERENCE ||
          config.businessReference,
      };
    case 'MOTOR_VERIFICATION':
      return {
        motorCategory: Number(process.env.E2E_MOTOR_CATEGORY || 1),
        motorRegistrationNumber:
          process.env.E2E_MOTOR_REGISTRATION_NUMBER || 'T123ABC',
      };
    case 'NIN_VERIFICATION':
    default:
      return {
        nin: config.nin,
      };
  }
}

async function request(name, method, url, body, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-correlation-id': randomUUID(),
    ...(options.auth === false
      ? {}
      : {
          Authorization: `Bearer ${config.token}`,
        }),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const result = {
      statusCode: response.status,
      ok: response.ok,
      body: data,
      data: unwrapApiData(data),
    };

    saveResult(name, response.ok ? 'PASS' : 'FAIL', result);

    return result;
  } catch (error) {
    clearTimeout(timer);

    saveResult(name, 'ERROR', null, error);

    return {
      ok: false,
      statusCode: 0,
      data: null,
      error,
    };
  }
}

function assert(name, condition, detail) {
  if (!condition) {
    saveResult(name, 'FAIL', detail || null, new Error(`${name} failed`));
    logFail(name);
    if (detail) {
      console.log(JSON.stringify(detail, null, 2));
    }
    return false;
  }

  saveResult(name, 'PASS', detail || null);
  logPass(name);
  return true;
}

async function loginAndGetToken() {
  if (config.token && !config.token.includes('PASTE_YOUR')) {
    return;
  }

  logStep('0. Portal login');

  const response = await request(
    'portal-login',
    'POST',
    `${portalApiBaseUrl}/auth/login`,
    {
      email: config.authEmail,
      password: config.authPassword,
    },
    { auth: false },
  );

  assert('Login request works', response.ok, response.data);

  const token = response.data?.access_token;
  assert('Login returned access token', Boolean(token), response.body);

  const scope = response.data?.scope;
  const hasCompanyContext =
    Boolean(response.data?.company?.id) ||
    Boolean(response.data?.activeCompany?.id) ||
    Boolean(response.data?.user?.company_id) ||
    Boolean(response.data?.user?.companyId);

  const tenantSessionOk = assert(
    'Login returned tenant/company-scoped session',
    scope !== 'platform' || hasCompanyContext,
    {
      scope,
      hint:
        'Use E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD for a company user with TIRAMIS permissions, not a platform owner session.',
    },
  );

  if (!tenantSessionOk) {
    throw new Error('E2E login did not return a tenant/company-scoped session');
  }

  config.token = token;
}

async function testPortalHealth() {
  logStep('1. Portal TIRAMIS service health');

  const response = await request(
    'portal-service-health',
    'GET',
    `${portalApiBaseUrl}/tiramis/service-health`,
  );

  assert('Portal can reach tiramis-service', response.ok, response.data);

  return response;
}

async function testBusinessDashboard() {
  logStep('2. Portal dashboard and schema status');

  const dashboard = await request(
    'portal-dashboard',
    'GET',
    `${portalApiBaseUrl}/tiramis/business/dashboard?limit=5`,
  );

  assert('Dashboard endpoint works', dashboard.ok, dashboard.data);

  const health = await request(
    'portal-business-health',
    'GET',
    `${portalApiBaseUrl}/tiramis/business/health`,
  );

  assert('Business health endpoint works', health.ok, health.data);

  const schema = await request(
    'portal-schema-status',
    'GET',
    `${portalApiBaseUrl}/tiramis/business/schema-status`,
  );

  assert('Schema status endpoint works', schema.ok, schema.data);

  return {
    dashboard,
    health,
    schema,
  };
}

async function testValidation() {
  logStep('3. Validate payload before submit');

  const response = await request(
    'validate-business-payload',
    'POST',
    `${portalApiBaseUrl}/tiramis/business/validate`,
    {
      requestType: config.requestType,
      sourceModule: config.sourceModule,
      sourceRecordId: config.sourceRecordId,
      payload: buildSubmissionPayload(),
    },
  );

  assert(
    'Validation passed',
    response.ok && response.body?.success !== false,
    response.body,
  );

  return response;
}

async function validateCompanyConfiguration() {
  logStep('4. Validate active company TIRAMIS configuration');

  const response = await request(
    'validate-company-configuration',
    'POST',
    `${portalApiBaseUrl}/companies/my/tiramis-configurations/${config.tiramisEnvironment}/validate`,
  );

  assert(
    'Company TIRAMIS configuration is valid',
    response.ok && response.data?.valid === true,
    response.body,
  );

  return response;
}

async function testSubmit() {
  logStep('5. Submit to TIRAMIS through portal');

  const response = await request(
    'submit-business-record',
    'POST',
    `${portalApiBaseUrl}/tiramis/business/submit`,
    {
      requestType: config.requestType,
      sourceModule: config.sourceModule,
      sourceRecordId: config.sourceRecordId,
      businessReference: config.businessReference,
      payload: buildSubmissionPayload(),
      returnExisting: true,
    },
  );

  assert(
    'Submit request accepted',
    response.ok &&
      (response.body?.success === true ||
        response.data?.localTrackingId ||
        response.data?.duplicatePrevented),
    response.body,
  );

  return response;
}

async function testDuplicatePrevention() {
  logStep('6. Duplicate prevention');

  const duplicate = await request(
    'duplicate-submit-with-return-existing',
    'POST',
    `${portalApiBaseUrl}/tiramis/business/submit`,
    {
      requestType: config.requestType,
      sourceModule: config.sourceModule,
      sourceRecordId: config.sourceRecordId,
      businessReference: config.businessReference,
      payload: buildSubmissionPayload(),
      returnExisting: true,
    },
  );

  assert(
    'Duplicate request returns existing or succeeds safely',
    duplicate.ok,
    duplicate.data,
  );

  const duplicateCheck = await request(
    'duplicate-check',
    'GET',
    `${portalApiBaseUrl}/tiramis/business/${config.requestType}/${config.sourceModule}/${config.sourceRecordId}/duplicate-check?businessReference=${encodeURIComponent(
      config.businessReference,
    )}`,
  );

  assert('Duplicate check endpoint works', duplicateCheck.ok, duplicateCheck.data);

  return {
    duplicate,
    duplicateCheck,
  };
}

async function testStatusAndSync() {
  logStep('7. Status and manual sync');

  const sync = await request(
    'sync-business-record',
    'POST',
    `${portalApiBaseUrl}/tiramis/business/${config.sourceModule}/${config.sourceRecordId}/sync?requestType=${config.requestType}`,
  );

  assert('Manual business sync endpoint works', sync.ok, sync.data);

  const status = await request(
    'business-status',
    'GET',
    `${portalApiBaseUrl}/tiramis/business/${config.sourceModule}/${config.sourceRecordId}/status?requestType=${config.requestType}&includeHistory=true`,
  );

  assert('Business status endpoint works', status.ok, status.data);

  return {
    sync,
    status,
  };
}

async function testAdminMonitoring() {
  logStep('8. Admin monitoring endpoints');

  const adminDashboard = await request(
    'admin-dashboard',
    'GET',
    `${portalApiBaseUrl}/tiramis/admin/dashboard?limit=5`,
  );

  assert('Admin dashboard works', adminDashboard.ok, adminDashboard.data);

  const adminHealth = await request(
    'admin-health',
    'GET',
    `${portalApiBaseUrl}/tiramis/admin/health`,
  );

  assert('Admin health works', adminHealth.ok, adminHealth.data);

  const notifications = await request(
    'admin-notifications-summary',
    'GET',
    `${portalApiBaseUrl}/tiramis/admin/notifications/summary`,
  );

  assert('Notification summary works', notifications.ok, notifications.data);

  const auditLogs = await request(
    'admin-audit-logs',
    'GET',
    `${portalApiBaseUrl}/tiramis/admin/audit-logs?limit=5`,
  );

  assert('Audit logs endpoint works', auditLogs.ok, auditLogs.data);

  return {
    adminDashboard,
    adminHealth,
    notifications,
    auditLogs,
  };
}

async function testRetryEndpoint() {
  logStep('9. Retry endpoint check');

  const retry = await request(
    'admin-retry-pending',
    'POST',
    `${portalApiBaseUrl}/tiramis/admin/submissions/retry`,
  );

  assert('Retry pending endpoint works', retry.ok, retry.data);

  return retry;
}

function printSummary() {
  if (summaryPrinted) {
    return;
  }

  summaryPrinted = true;
  logStep('E2E Summary');

  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length;
  const errors = results.filter((item) => item.status === 'ERROR').length;

  console.log({
    total: results.length,
    passed,
    failed,
    errors,
  });

  const failedItems = results.filter(
    (item) => item.status === 'FAIL' || item.status === 'ERROR',
  );

  if (failedItems.length) {
    console.log('\nFailed items:');
    for (const item of failedItems) {
      console.log(`- ${item.name}: ${item.error || item.status}`);
    }
  }

  const outputDir = path.join(process.cwd(), 'tmp');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'tiramis-e2e-result.json');

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        config: {
          ...config,
          token: mask(config.token),
        },
        summary: {
          total: results.length,
          passed,
          failed,
          errors,
        },
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\nResult saved to: ${outputPath}`);

  if (failed || errors) {
    process.exitCode = 1;
  }
}

async function main() {
  console.log('TIRAMIS E2E Test Started');
  console.log({
    portalBaseUrl: config.portalBaseUrl,
    tiramisServiceBaseUrl: config.tiramisServiceBaseUrl,
    mockTiraBaseUrl: config.mockTiraBaseUrl,
    requestType: config.requestType,
    sourceModule: config.sourceModule,
    sourceRecordId: config.sourceRecordId,
    businessReference: config.businessReference,
    validateOnly: config.validateOnly,
    token: mask(config.token),
  });

  try {
    await loginAndGetToken();
    await testPortalHealth();
    await testBusinessDashboard();
    await testValidation();
    await validateCompanyConfiguration();
    if (config.validateOnly) {
      return;
    }
    await testSubmit();
    await testDuplicatePrevention();
    await testStatusAndSync();
    await testAdminMonitoring();
    await testRetryEndpoint();
  } finally {
    printSummary();
  }
}

main().catch((error) => {
  logFail(error.message || String(error));
  saveResult('main', 'ERROR', null, error);
  printSummary();
});
