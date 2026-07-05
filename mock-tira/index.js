require('dotenv').config();

const express = require('express');

const { CONFIG } = require('./src/config/mock-config');

const {
  validateHeaders,
  verifyClientRequestSignature,
  verifyTiraResponseSignature,
  wrapTiraMessage,
  wrapClientTiraMessage,
  signClientContent,
  getCertificateHealth,
  clearCertificateCache,
} = require('./src/services/signature.service');

const {
  createTiramisRequestHandler,
} = require('./src/services/tiramis-handler.service');

const {
  registerMockAdminRoutes,
} = require('./src/routes/mock-admin.routes');

const {
  registerTiramisRoutes,
} = require('./src/routes/tiramis.routes');

const {
  registerLoadTestRoutes,
} = require('./src/routes/load-test.routes');

const {
  registerDashboardRoutes,
} = require('./src/routes/dashboard.routes');

const {
  initializeTrackingStore,
  flushTrackingStoreBeforeExit,
} = require('./src/store/mock-request.store');

const app = express();

app.disable('x-powered-by');

/**
 * JSON routes:
 * /tiramis/mock/scenarios/next
 * /tiramis/mock/load/run
 * /tiramis/mock/response-config
 */
app.use(
  express.json({
    limit: '50mb',
  }),
);

/**
 * XML/text routes:
 * TIRAMIS requests, callback receiver, debug XML, signing tools.
 *
 * Do not use a wildcard XML type here because it will consume JSON before express.json().
 */
app.use(
  express.text({
    type: [
      'application/xml',
      'text/xml',
      'application/*+xml',
      'text/plain',
    ],
    limit: '50mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
);

/**
 * Basic request logger.
 */
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    console.log(
      `[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${durationMs}ms`,
    );
  });

  next();
});

/**
 * Health endpoints.
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'UP',
    service: 'tiramis-mock-tira',
    port: CONFIG.port,
    time: new Date().toISOString(),
  });
});

app.get('/tiramis/mock/health', (req, res) => {
  res.json({
    success: true,
    status: 'UP',
    service: 'tiramis-mock-tira',
    port: CONFIG.port,
    dashboardEnabled: CONFIG.dashboardEnabled,
    defaultScenario: CONFIG.defaultScenario,
    businessValidation: CONFIG.enableBusinessValidation,
    signatureRequired: CONFIG.requireSignature,
    unsignedRequestsAllowed: CONFIG.allowUnsignedRequests,
    callbackAckValidation: CONFIG.validateCallbackAck,
    duplicateDetection: CONFIG.duplicateDetectionEnabled,
    chaosEnabled: CONFIG.chaosEnabled,
    trackingPersistence: CONFIG.trackingPersistEnabled,
    loadTestEnabled: CONFIG.loadTestEnabled,
    time: new Date().toISOString(),
  });
});

/**
 * Certificate health endpoints.
 */
app.get('/tiramis/mock/certificates', (req, res) => {
  res.json(getCertificateHealth());
});

app.get('/config-health', (req, res) => {
  res.json(getCertificateHealth());
});

app.post('/tiramis/mock/certificates/reload', (req, res) => {
  clearCertificateCache();

  res.json({
    success: true,
    message:
      'Certificate cache cleared. Certificates will reload on next request.',
    health: getCertificateHealth(),
  });
});

/**
 * Signature tool endpoints.
 */
app.post('/tiramis/mock/tools/sign-client-content', (req, res) => {
  try {
    const contentXml = req.body || '';
    const signature = signClientContent(contentXml);

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
    const tiraMsg = wrapClientTiraMessage(contentXml);

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
    verification: verifyTiraResponseSignature(xml),
  });
});

/**
 * Backward-compatible tool aliases.
 */
app.post('/tiramis/tools/sign-as-client', (req, res) => {
  try {
    const contentXml = req.body || '';
    const tiraMsg = wrapClientTiraMessage(contentXml);

    res.set('Content-Type', 'application/xml');
    res.send(tiraMsg);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || String(error),
    });
  }
});

app.post('/tiramis/tools/verify-tira-signature', (req, res) => {
  const xml = req.body || '';

  res.json({
    success: true,
    verification: verifyTiraResponseSignature(xml),
  });
});

/**
 * Initialize persistent tracking store.
 */
const trackingStoreInit = initializeTrackingStore();

console.log('[tracking-store]', trackingStoreInit);

/**
 * Main TIRAMIS request handler.
 */
const handleTiramisRequest = createTiramisRequestHandler({
  validateHeaders,
  verifyClientRequestSignature,
  wrapTiraMessage,
});

/**
 * Register routes.
 */
registerMockAdminRoutes(app, {
  wrapTiraMessage,
});

registerTiramisRoutes(app, handleTiramisRequest);

registerLoadTestRoutes(app);

registerDashboardRoutes(app);

/**
 * Optional browser root redirect.
 */
app.get('/', (req, res) => {
  res.redirect('/tiramis/mock/dashboard');
});

/**
 * 404 handler.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    method: req.method,
    path: req.originalUrl,
  });
});

/**
 * Global error handler.
 */
app.use((error, req, res, next) => {
  console.error('[server-error]', error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
});

/**
 * Graceful shutdown.
 */
function shutdown(signal) {
  console.log(`[server] Received ${signal}. Flushing mock tracking store...`);

  const result = flushTrackingStoreBeforeExit();

  console.log('[tracking-store] flush result:', result);

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Start server.
 */
app.listen(CONFIG.port, () => {
  console.log('=================================================');
  console.log(`Mock TIRA server running on port ${CONFIG.port}`);
  console.log(`Health:    http://localhost:${CONFIG.port}/tiramis/mock/health`);
  console.log(`Dashboard: http://localhost:${CONFIG.port}/tiramis/mock/dashboard`);
  console.log(`Endpoints: http://localhost:${CONFIG.port}/tiramis/mock/endpoints`);
  console.log('-------------------------------------------------');
  console.log(`Default scenario: ${CONFIG.defaultScenario}`);
  console.log(`Business validation: ${CONFIG.enableBusinessValidation}`);
  console.log(`Signature required: ${CONFIG.requireSignature}`);
  console.log(`Unsigned allowed: ${CONFIG.allowUnsignedRequests}`);
  console.log(`Callback ACK validation: ${CONFIG.validateCallbackAck}`);
  console.log(`Duplicate detection: ${CONFIG.duplicateDetectionEnabled}`);
  console.log(`Chaos enabled: ${CONFIG.chaosEnabled}`);
  console.log(`Tracking persistence: ${CONFIG.trackingPersistEnabled}`);
  console.log('=================================================');
});
