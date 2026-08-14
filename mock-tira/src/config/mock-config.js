require('dotenv').config();

const CONFIG = {
  port: Number(process.env.PORT || process.env.MOCK_TIRA_PORT || 5050),

  clientCode: process.env.CLIENT_CODE || '',
  clientKey: process.env.CLIENT_KEY || '',

  verifyIncomingSignature: process.env.VERIFY_INCOMING_SIGNATURE === 'true',
  signResponses: process.env.SIGN_RESPONSES !== 'false',
  allowMockSignature: process.env.ALLOW_MOCK_SIGNATURE === 'true',

  defaultScenario: process.env.MOCK_DEFAULT_SCENARIO || 'success',
  enableBusinessValidation:
    process.env.MOCK_ENABLE_BUSINESS_VALIDATION !== 'false',

  ackDelayMs: Number(process.env.MOCK_ACK_DELAY_MS || 0),
  callbackDelayMs: Number(process.env.MOCK_CALLBACK_DELAY_MS || 3000),

  slowAckDelayMs: Number(process.env.MOCK_SLOW_ACK_DELAY_MS || 10000),
  slowCallbackDelayMs: Number(process.env.MOCK_SLOW_CALLBACK_DELAY_MS || 15000),
  timeoutBeforeAckMs: Number(process.env.MOCK_TIMEOUT_BEFORE_ACK_MS || 90000),

  callbackRetries: Number(process.env.MOCK_CALLBACK_RETRIES || 3),
  callbackRetryDelayMs: Number(process.env.MOCK_CALLBACK_RETRY_DELAY_MS || 5000),

  callbackFailFirstAttempts: Number(
    process.env.MOCK_CALLBACK_FAIL_FIRST_ATTEMPTS || 1,
  ),

  dashboardEnabled: process.env.MOCK_DASHBOARD_ENABLED !== 'false',

  dashboardTitle:
    process.env.MOCK_DASHBOARD_TITLE || 'TIRAMIS Mock TIRA Dashboard',

  chaosEnabled: process.env.MOCK_CHAOS_ENABLED === 'true',

  chaosMinLatencyMs: Number(process.env.MOCK_CHAOS_MIN_LATENCY_MS || 0),

  chaosMaxLatencyMs: Number(process.env.MOCK_CHAOS_MAX_LATENCY_MS || 3000),

  randomTimeoutRate: Number(process.env.MOCK_RANDOM_TIMEOUT_RATE || 0),

  randomHttp500Rate: Number(process.env.MOCK_RANDOM_HTTP_500_RATE || 0),

  randomHttp503Rate: Number(process.env.MOCK_RANDOM_HTTP_503_RATE || 0),

  randomAckFailureRate: Number(process.env.MOCK_RANDOM_ACK_FAILURE_RATE || 0),

  randomFinalFailureRate: Number(process.env.MOCK_RANDOM_FINAL_FAILURE_RATE || 0),

  randomNoCallbackRate: Number(process.env.MOCK_RANDOM_NO_CALLBACK_RATE || 0),

  randomCallbackRetryRate: Number(
    process.env.MOCK_RANDOM_CALLBACK_RETRY_RATE || 0,
  ),

  unstableTimeoutRate: Number(process.env.MOCK_UNSTABLE_TIMEOUT_RATE || 10),

  unstableHttp500Rate: Number(process.env.MOCK_UNSTABLE_HTTP_500_RATE || 5),

  unstableHttp503Rate: Number(process.env.MOCK_UNSTABLE_HTTP_503_RATE || 5),

  unstableAckFailureRate: Number(process.env.MOCK_UNSTABLE_ACK_FAILURE_RATE || 5),

  unstableFinalFailureRate: Number(
    process.env.MOCK_UNSTABLE_FINAL_FAILURE_RATE || 10,
  ),

  unstableNoCallbackRate: Number(process.env.MOCK_UNSTABLE_NO_CALLBACK_RATE || 5),

  unstableCallbackRetryRate: Number(
    process.env.MOCK_UNSTABLE_CALLBACK_RETRY_RATE || 15,
  ),

  unstableMinLatencyMs: Number(process.env.MOCK_UNSTABLE_MIN_LATENCY_MS || 500),

  unstableMaxLatencyMs: Number(process.env.MOCK_UNSTABLE_MAX_LATENCY_MS || 8000),

  validateCallbackAck:
    process.env.MOCK_VALIDATE_CALLBACK_ACK !== 'false',

  validateCallbackAckSignature:
    process.env.MOCK_VALIDATE_CALLBACK_ACK_SIGNATURE === 'true',

  callbackAckSuccessCodes: String(
    process.env.MOCK_CALLBACK_ACK_SUCCESS_CODES || 'TIRA001,ACK001,200',
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  allowRawCallbackAck:
    process.env.MOCK_ALLOW_RAW_CALLBACK_ACK !== 'false',

  trackingLimit: Number(process.env.MOCK_TRACKING_LIMIT || 1000),

  duplicateDetectionEnabled:
    process.env.MOCK_DUPLICATE_DETECTION_ENABLED !== 'false',

  duplicateResponseCode:
    process.env.MOCK_DUPLICATE_RESPONSE_CODE || 'TIRA007',

  duplicateCompareRequestId:
    process.env.MOCK_DUPLICATE_COMPARE_REQUEST_ID !== 'false',

  duplicateCompareBusinessReference:
    process.env.MOCK_DUPLICATE_COMPARE_BUSINESS_REFERENCE !== 'false',

  duplicateWindowMinutes: Number(
    process.env.MOCK_DUPLICATE_WINDOW_MINUTES || 1440,
  ),

  duplicateIncludeFailed:
    process.env.MOCK_DUPLICATE_INCLUDE_FAILED === 'true',

  trackingPersistEnabled:
    process.env.MOCK_TRACKING_PERSIST_ENABLED !== 'false',

  trackingStoragePath:
    process.env.MOCK_TRACKING_STORAGE_PATH || 'data/mock-requests.json',

  trackingPersistXml:
    process.env.MOCK_TRACKING_PERSIST_XML !== 'false',

  trackingSaveDebounceMs: Number(
    process.env.MOCK_TRACKING_SAVE_DEBOUNCE_MS || 500,
  ),

  trackingBackupEnabled:
    process.env.MOCK_TRACKING_BACKUP_ENABLED !== 'false',

  trackingBackupDir:
    process.env.MOCK_TRACKING_BACKUP_DIR || 'data/backups',

  signatureXmlMode: process.env.SIGNATURE_XML_MODE || 'preserve',

  allowUnsignedRequests: process.env.MOCK_ALLOW_UNSIGNED_REQUESTS === 'true',

  debugSignature: process.env.MOCK_DEBUG_SIGNATURE === 'true',

  responseUseRequestId:
    process.env.MOCK_RESPONSE_USE_REQUEST_ID !== 'false',

  // No hardcoded fallback here on purpose: leaving this unset lets
  // resolveMockResponseData() generate a unique per-request reference
  // (same "NNNNN-NNNNN-NNNNN" pattern real TIRA uses) instead of every
  // submission colliding on the same static value. Set this env var only
  // if a test genuinely needs a fixed, repeatable reference number.
  defaultCoverNoteReferenceNumber:
    process.env.MOCK_DEFAULT_COVER_NOTE_REFERENCE_NUMBER || null,

  defaultMotorCoverNoteReferenceNumber:
    process.env.MOCK_DEFAULT_MOTOR_COVER_NOTE_REFERENCE_NUMBER ||
    process.env.MOCK_DEFAULT_COVER_NOTE_REFERENCE_NUMBER ||
    null,

  defaultStickerNumber: process.env.MOCK_DEFAULT_STICKER_NUMBER || null,

  coverNoteRefPrefix: process.env.MOCK_COVER_NOTE_REF_PREFIX || 'CN',

  motorCoverNoteRefPrefix:
    process.env.MOCK_MOTOR_COVER_NOTE_REF_PREFIX || 'MCN',

  stickerPrefix: process.env.MOCK_STICKER_PREFIX || 'STK',

  policyRefPrefix: process.env.MOCK_POLICY_REF_PREFIX || 'POL',

  reinsuranceRefPrefix: process.env.MOCK_REINSURANCE_REF_PREFIX || 'RE',

  claimRefPrefix: process.env.MOCK_CLAIM_REF_PREFIX || 'CLM',

  verificationStatus: process.env.MOCK_VERIFICATION_STATUS || 'VALID',

  verificationMessage:
    process.env.MOCK_VERIFICATION_MESSAGE || 'Verified successfully',

  verificationFullName:
    process.env.MOCK_VERIFICATION_FULL_NAME || 'Mock NIN Holder',

  verificationCompanyName:
    process.env.MOCK_VERIFICATION_COMPANY_NAME || 'Mock Company Limited',

  allowResponseOverrides:
    process.env.MOCK_ALLOW_RESPONSE_OVERRIDES !== 'false',

  loadTestEnabled: process.env.MOCK_LOAD_TEST_ENABLED !== 'false',

  loadTestMaxRequests: Number(process.env.MOCK_LOAD_TEST_MAX_REQUESTS || 500),

  loadTestDefaultConcurrency: Number(
    process.env.MOCK_LOAD_TEST_DEFAULT_CONCURRENCY || 5,
  ),

  loadTestDefaultCallbackUrl:
    process.env.MOCK_LOAD_TEST_DEFAULT_CALLBACK_URL ||
    `http://localhost:${process.env.PORT || 5050}/tiramis/mock/callback-receiver`,

  tiraPfxPath:
    process.env.MOCK_TIRA_PFX_PATH ||
    process.env.TIRA_PFX_PATH ||
    process.env.TIRA_CERT_PFX_PATH ||
    'certs/tira/tira.pfx',

  tiraPfxPassword:
    process.env.MOCK_TIRA_PFX_PASSWORD ||
    process.env.TIRA_PFX_PASSWORD ||
    process.env.TIRA_CERT_PASSWORD ||
    '',

  tiraPrivateKeyPath:
    process.env.MOCK_TIRA_PRIVATE_KEY_PATH ||
    process.env.TIRA_PRIVATE_KEY_PATH ||
    '',

  tiraCertificatePath:
    process.env.MOCK_TIRA_CERTIFICATE_PATH ||
    process.env.TIRA_CERTIFICATE_PATH ||
    process.env.TIRA_PUBLIC_CERT_PATH ||
    '',

  clientCertificatePath:
    process.env.MOCK_CLIENT_CERTIFICATE_PATH ||
    process.env.CLIENT_CERTIFICATE_PATH ||
    process.env.CLIENT_PUBLIC_CERT_PATH ||
    'certs/client/client.crt',

  clientPfxPath:
    process.env.MOCK_CLIENT_PFX_PATH ||
    process.env.CLIENT_PFX_PATH ||
    '',

  clientPfxPassword:
    process.env.MOCK_CLIENT_PFX_PASSWORD ||
    process.env.CLIENT_PFX_PASSWORD ||
    '',

  clientPrivateKeyPath:
    process.env.MOCK_CLIENT_PRIVATE_KEY_PATH ||
    process.env.CLIENT_PRIVATE_KEY_PATH ||
    '',

  requireSignature:
    process.env.MOCK_REQUIRE_SIGNATURE !== 'false',

  clientPublicCertPath:
    process.env.CLIENT_PUBLIC_CERT_PATH ||
    './certs/client/tiramisclientpublic.pfx',
  clientPublicCertPassword:
    process.env.CLIENT_PUBLIC_CERT_PASSWORD ||
    process.env.CLIENT_PFX_PASSWORD ||
    'password',

  clientPrivatePfxPath:
    process.env.CLIENT_PRIVATE_PFX_PATH ||
    './certs/client/tiramisclientprivate.pfx',
  clientPrivatePfxPassword:
    process.env.CLIENT_PRIVATE_PFX_PASSWORD ||
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
    process.env.TIRA_PUBLIC_CERT_PATH || './certs/tira/mock-tira-public.pfx',
  tiraPublicCertPassword:
    process.env.TIRA_PUBLIC_CERT_PASSWORD ||
    process.env.TIRA_PRIVATE_PFX_PASSWORD ||
    process.env.TIRA_PFX_PASSWORD ||
    'password',
};

module.exports = {
  CONFIG,
};
