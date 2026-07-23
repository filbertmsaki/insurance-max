const express = require('express');

const { CONFIG } = require('../config/mock-config');
const { MOCK_SCENARIOS } = require('../constants/mock-scenarios.constant');
const {
  CANONICAL_SERVICE_ENDPOINTS,
  SEEDED_SERVICE_ENDPOINTS,
  LEGACY_MOCK_ENDPOINT,
} = require('../constants/tiramis-endpoints.constant');
const { getRoot, getTag, extractContentXml } = require('../utils/xml.util');
const {
  listTrackingRecords,
  getPublicTrackingRecord,
  getTrackingRecord,
  clearTrackingRecords,
  getMockStatistics,
  updateTracking,
  getStorageState,
  persistTrackingStoreNow,
  backupTrackingStore,
  importTrackingRecords,
  exportTrackingRecords,
} = require('../store/mock-request.store');
const { queueScenario, listQueuedScenarios } = require('../services/scenario.service');
const { validateBusinessXml } = require('../services/validation.service');
const { buildAsyncFinalResponseContent } = require('../services/response-builder.service');
const { sendCallbackWithRetry } = require('../services/callback.service');
const {
  extractDuplicateIdentity,
  checkDuplicateRequest,
  getDuplicateConfiguration,
} = require('../services/duplicate.service');
const {
  getChaosConfig,
  resolveChaosDecision,
} = require('../services/chaos.service');
const {
  resolveMockResponseData,
  getRuntimeResponseConfig,
  updateRuntimeResponseConfig,
  resetRuntimeResponseConfig,
} = require('../services/mock-response-data.service');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');

function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === 'object') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

function registerMockAdminRoutes(app, deps = {}) {
  const wrapTiraMessage = deps.wrapTiraMessage;

  app.get('/tiramis/mock/requests', (req, res) => {
    const includeXml =
      String(req.query?.includeXml || '').toLowerCase() === 'true';

    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 1000);
    const records = listTrackingRecords().slice(0, limit);

    res.json({
      success: true,
      total: records.length,
      returned: records.length,
      items: includeXml
        ? records
        : records.map((record) => getPublicTrackingRecord(record)),
    });
  });

  app.get('/tiramis/mock/requests/:requestId', (req, res) => {
    const record = getTrackingRecord(req.params.requestId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Mock request not found',
      });
    }

    const includeXml =
      String(req.query?.includeXml || '').toLowerCase() === 'true';

    res.json({
      success: true,
      item: includeXml ? record : getPublicTrackingRecord(record),
    });
  });

  app.delete('/tiramis/mock/requests', (req, res) => {
    const backup =
      String(req.query?.backup || 'true').toLowerCase() !== 'false';
    const count = clearTrackingRecords({
      backup,
    });

    res.json({
      success: true,
      deleted: count,
      backup,
    });
  });

  app.get('/tiramis/mock/statistics', (req, res) => {
    res.json({
      success: true,
      statistics: getMockStatistics(),
    });
  });

  app.get('/tiramis/mock/storage', (req, res) => {
    res.json({
      success: true,
      storage: getStorageState(),
    });
  });

  app.post('/tiramis/mock/storage/save', (req, res) => {
    try {
      res.json(persistTrackingStoreNow());
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || String(error),
      });
    }
  });

  app.post('/tiramis/mock/storage/backup', (req, res) => {
    try {
      res.json(backupTrackingStore('manual'));
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || String(error),
      });
    }
  });

  app.get('/tiramis/mock/storage/export', (req, res) => {
    const includeXml =
      String(req.query?.includeXml || 'true').toLowerCase() !== 'false';
    const payload = exportTrackingRecords({
      includeXml,
    });

    res.set('Content-Type', 'application/json');
    res.set(
      'Content-Disposition',
      `attachment; filename="mock-requests-export-${Date.now()}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  });

  app.post(
    '/tiramis/mock/storage/import',
    express.text({
      type: '*/*',
      limit: '50mb',
    }),
    (req, res) => {
      try {
        const body = parseJsonBody(req.body);

        const result = importTrackingRecords({
          records: body.records || body,
          mode: body.mode || req.query?.mode || 'merge',
        });

        res.json(result);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: error.message || String(error),
        });
      }
    },
  );

  app.get('/tiramis/mock/scenarios', (req, res) => {
    res.json({
      success: true,
      defaultScenario: CONFIG.defaultScenario,
      supportedScenarios: Object.values(MOCK_SCENARIOS),
      pendingScenarios: listQueuedScenarios(),
      usage: {
        header: 'X-Mock-Scenario: final_failure',
        query: '?scenario=final_failure',
        xml: '<MockScenario>final_failure</MockScenario>',
      },
    });
  });

  app.get('/tiramis/mock/duplicates/config', (req, res) => {
    res.json({
      success: true,
      duplicateConfig: getDuplicateConfiguration(),
    });
  });

  app.post('/tiramis/mock/duplicates/check', (req, res) => {
    const xml = req.body || '';
    const contentXml = extractContentXml(xml);
    const root = getRoot(contentXml || xml);

    const endpointDefinition = {
      serviceType: req.query?.serviceType || null,
      endpointUrl: req.query?.endpointUrl || null,
    };

    const identity = extractDuplicateIdentity(
      root,
      contentXml || xml,
      endpointDefinition,
    );

    const duplicateCheck = checkDuplicateRequest({
      root,
      xml: contentXml || xml,
      endpointDefinition,
      identity,
      currentTrackingId: req.query?.currentTrackingId || null,
      currentRequestId: identity.requestId,
    });

    res.json({
      success: true,
      identity,
      duplicateCheck,
    });
  });

  app.get('/tiramis/mock/chaos/config', (req, res) => {
    res.json({
      success: true,
      chaos: getChaosConfig(),
    });
  });

  app.get('/tiramis/mock/chaos/test-roll', (req, res) => {
    const scenario = req.query?.scenario || 'unstable_network';

    const decision = resolveChaosDecision({
      req,
      root: req.query?.root || 'PolicyReq',
      endpointDefinition: {
        serviceType: req.query?.serviceType || 'POLICY',
        endpointUrl:
          req.query?.endpointUrl || '/ecovernote/api/policy/v1/request',
      },
      scenario,
      xml: '',
    });

    res.json({
      success: true,
      scenario,
      decision,
    });
  });

  app.get('/tiramis/mock/chaos/help', (req, res) => {
    res.json({
      success: true,
      description:
        'Chaos mode simulates slow TIRA, timeout, HTTP 500/503, ACK failure, final failure, no callback, and callback retry.',
      howToUse: {
        globalChaos:
          'Set MOCK_CHAOS_ENABLED=true and configure MOCK_RANDOM_* rates.',
        perRequest:
          'Use X-Mock-Scenario: unstable_network or ?scenario=unstable_network.',
        forceSpecific:
          'Use scenarios like timeout_before_ack, http_500, http_503, final_failure, no_callback, callback_retry.',
      },
      examples: [
        {
          name: 'Unstable network per request',
          curl:
            'curl -X POST "http://localhost:5050/ecovernote/api/policy/v1/request?scenario=unstable_network" -H "Content-Type: application/xml" -H "ClientCode: TEST_CLIENT_CODE" -H "ClientKey: TEST_CLIENT_KEY" --data-binary @policy.xml',
        },
        {
          name: 'Force timeout',
          curl:
            'curl -X POST "http://localhost:5050/ecovernote/api/policy/v1/request?scenario=timeout_before_ack" -H "Content-Type: application/xml" -H "ClientCode: TEST_CLIENT_CODE" -H "ClientKey: TEST_CLIENT_KEY" --data-binary @policy.xml',
        },
        {
          name: 'Force HTTP 503',
          curl:
            'curl -X POST "http://localhost:5050/ecovernote/api/policy/v1/request?scenario=http_503" -H "Content-Type: application/xml" -H "ClientCode: TEST_CLIENT_CODE" -H "ClientKey: TEST_CLIENT_KEY" --data-binary @policy.xml',
        },
      ],
    });
  });

  app.get('/tiramis/mock/response-config', (req, res) => {
    res.json({
      success: true,
      envDefaults: {
        responseUseRequestId: CONFIG.responseUseRequestId,
        defaultCoverNoteReferenceNumber:
          CONFIG.defaultCoverNoteReferenceNumber,
        defaultMotorCoverNoteReferenceNumber:
          CONFIG.defaultMotorCoverNoteReferenceNumber,
        defaultStickerNumber: CONFIG.defaultStickerNumber,
        coverNoteRefPrefix: CONFIG.coverNoteRefPrefix,
        motorCoverNoteRefPrefix: CONFIG.motorCoverNoteRefPrefix,
        stickerPrefix: CONFIG.stickerPrefix,
        policyRefPrefix: CONFIG.policyRefPrefix,
        reinsuranceRefPrefix: CONFIG.reinsuranceRefPrefix,
        claimRefPrefix: CONFIG.claimRefPrefix,
        verificationStatus: CONFIG.verificationStatus,
        verificationMessage: CONFIG.verificationMessage,
        verificationFullName: CONFIG.verificationFullName,
        verificationCompanyName: CONFIG.verificationCompanyName,
        allowResponseOverrides: CONFIG.allowResponseOverrides,
      },
      runtimeConfig: getRuntimeResponseConfig(),
      overrideMethods: {
        query: '?policyReferenceNumber=POL-123&verificationStatus=INVALID',
        headers: {
          'X-Mock-PolicyReferenceNumber': 'POL-123',
          'X-Mock-VerificationStatus': 'INVALID',
        },
        xml: [
          '<MockPolicyReferenceNumber>POL-123</MockPolicyReferenceNumber>',
          '<MockVerificationStatus>INVALID</MockVerificationStatus>',
        ],
      },
    });
  });

  app.post('/tiramis/mock/response-config', express.json(), (req, res) => {
    const updated = updateRuntimeResponseConfig(req.body || {});

    res.json({
      success: true,
      runtimeConfig: updated,
    });
  });

  app.delete('/tiramis/mock/response-config', (req, res) => {
    const reset = resetRuntimeResponseConfig();

    res.json({
      success: true,
      runtimeConfig: reset,
    });
  });

  app.post('/tiramis/mock/response-config/preview', (req, res) => {
    const xml = req.body || '';
    const contentXml = extractContentXml(xml);
    const root = getRoot(contentXml || xml) || req.query?.root || 'PolicyReq';
    const requestId =
      getTag(contentXml || xml, 'RequestId') ||
      req.query?.requestId ||
      'REQ-PREVIEW-001';

    const responseData = resolveMockResponseData({
      req,
      root,
      requestId,
      xml: contentXml || xml,
    });

    res.json({
      success: true,
      root,
      requestId,
      responseData,
    });
  });

  app.post('/tiramis/mock/scenarios/next', express.json(), (req, res) => {
    const body = req.body || {};

    const queued = queueScenario({
      scenario: body.scenario || req.query?.scenario,
      times: body.times || req.query?.times || 1,
      requestRoot: body.requestRoot || body.root || req.query?.requestRoot,
      serviceType: body.serviceType || req.query?.serviceType,
    });

    if (!queued) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing scenario',
        supportedScenarios: Object.values(MOCK_SCENARIOS),
      });
    }

    res.json({
      success: true,
      scenario: queued.scenario,
      times: queued.times,
      pendingScenarios: listQueuedScenarios(),
    });
  });

  app.post(
    '/tiramis/mock/requests/:requestId/callback/replay',
    async (req, res) => {
      const record = getTrackingRecord(req.params.requestId);

      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Mock request not found',
        });
      }

      if (!record.callbackUrl) {
        return res.status(400).json({
          success: false,
          message: 'This request has no callback URL',
        });
      }

      if (!record.finalXml) {
        return res.status(400).json({
          success: false,
          message: 'This request has no final XML to replay',
        });
      }

      const accepted = await sendCallbackWithRetry(
        record.callbackUrl,
        record.finalXml,
        {
          trackingId: record.id,
          serviceType: record.serviceType,
          endpointUrl: record.endpoint,
          root: record.root,
          requestId: record.requestId,
          scenario: req.query?.scenario || record.scenario,
        },
      );

      const updated = getTrackingRecord(record.requestId);

      res.json({
        success: accepted,
        requestId: record.requestId,
        trackingId: record.id,
        status: updated?.status,
        callbackAttempts: updated?.callbackAttempts || [],
      });
    },
  );

  app.post(
    '/tiramis/mock/requests/:requestId/final-failure',
    async (req, res) => {
      const record = getTrackingRecord(req.params.requestId);

      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Mock request not found',
        });
      }

      if (!record.callbackUrl) {
        return res.status(400).json({
          success: false,
          message: 'This request has no callback URL',
        });
      }

      const responseData = resolveMockResponseData({
        root: record.root,
        requestId: record.requestId,
        xml: record.contentXml || record.rawRequestXml || '',
      });

      const finalContent = buildAsyncFinalResponseContent(
        record.root,
        record.requestId,
        'TIRA002',
        'Manual mock final failure',
        {
          responseData,
        },
      );

      const finalXml = wrapTiraMessage(finalContent);

      updateTracking(record.id, {
        status: 'MANUAL_FINAL_FAILURE_SCHEDULED',
        finalCode: 'TIRA002',
        finalXml,
      });

      const accepted = await sendCallbackWithRetry(record.callbackUrl, finalXml, {
        trackingId: record.id,
        serviceType: record.serviceType,
        endpointUrl: record.endpoint,
        root: record.root,
        requestId: record.requestId,
        scenario: MOCK_SCENARIOS.FINAL_FAILURE,
      });

      res.json({
        success: accepted,
        requestId: record.requestId,
        status: getTrackingRecord(record.requestId)?.status,
      });
    },
  );

  app.post(
    '/tiramis/mock/requests/:requestId/mark-success',
    async (req, res) => {
      const record = getTrackingRecord(req.params.requestId);

      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Mock request not found',
        });
      }

      if (!record.callbackUrl) {
        return res.status(400).json({
          success: false,
          message: 'This request has no callback URL',
        });
      }

      const responseData = resolveMockResponseData({
        root: record.root,
        requestId: record.requestId,
        xml: record.contentXml || record.rawRequestXml || '',
      });

      const finalContent = buildAsyncFinalResponseContent(
        record.root,
        record.requestId,
        'TIRA001',
        RESPONSE_CODES.TIRA001,
        {
          responseData,
        },
      );

      const finalXml = wrapTiraMessage(finalContent);

      updateTracking(record.id, {
        status: 'MANUAL_FINAL_SUCCESS_SCHEDULED',
        finalCode: 'TIRA001',
        finalXml,
      });

      const accepted = await sendCallbackWithRetry(record.callbackUrl, finalXml, {
        trackingId: record.id,
        serviceType: record.serviceType,
        endpointUrl: record.endpoint,
        root: record.root,
        requestId: record.requestId,
        scenario: MOCK_SCENARIOS.SUCCESS,
      });

      res.json({
        success: accepted,
        requestId: record.requestId,
        status: getTrackingRecord(record.requestId)?.status,
      });
    },
  );

  app.post('/tiramis/mock/debug/xml', (req, res) => {
    const xml = req.body || '';
    const contentXml = extractContentXml(xml);
    const root = getRoot(contentXml || xml);

    res.json({
      success: true,
      root,
      requestId: getTag(contentXml || xml, 'RequestId'),
      callbackUrl: getTag(contentXml || xml, 'CallBackUrl'),
      companyCode: getTag(contentXml || xml, 'CompanyCode'),
      systemCode: getTag(contentXml || xml, 'SystemCode'),
      insurerCompanyCode: getTag(contentXml || xml, 'InsurerCompanyCode'),
      hasTiraMsg: xml.includes('<TiraMsg'),
      hasContent: xml.includes('<Content>'),
      hasMsgSignature: xml.includes('<MsgSignature>'),
      businessValidation: validateBusinessXml(root, contentXml || xml),
    });
  });

  app.get('/tiramis/mock/endpoints', (req, res) => {
    res.json({
      success: true,
      canonicalEndpoints: CANONICAL_SERVICE_ENDPOINTS.map((item) => ({
        serviceType: item.serviceType,
        endpointUrl: item.endpointUrl,
        aliases: item.aliases || [],
        requestRoots: item.requestRoots,
        mode: item.mode,
      })),
      registeredRoutes: SEEDED_SERVICE_ENDPOINTS.map((item) => ({
        serviceType: item.serviceType,
        endpointUrl: item.endpointUrl,
        canonicalEndpointUrl: item.canonicalEndpointUrl,
        isAlias: item.isAlias,
        aliasOf: item.aliasOf,
        requestRoots: item.requestRoots,
        mode: item.mode,
      })),
      legacyEndpoint: LEGACY_MOCK_ENDPOINT,
    });
  });
}

module.exports = {
  registerMockAdminRoutes,
};
