const express = require('express');

const {
  getLoadTestServiceTypes,
  buildSampleContentXml,
  buildCallbackAckForFinalResponse,
  runLoadTest,
} = require('../services/load-test.service');
const {
  extractContentXml,
  getRoot,
  getTag,
} = require('../utils/xml.util');

function registerLoadTestRoutes(app) {
  app.get('/tiramis/mock/load/service-types', (req, res) => {
    res.json({
      success: true,
      serviceTypes: getLoadTestServiceTypes(),
    });
  });

  app.get('/tiramis/mock/load/sample-xml', (req, res) => {
    try {
      const xml = buildSampleContentXml({
        serviceType: req.query?.serviceType || 'POLICY',
        root: req.query?.root || null,
        requestId: req.query?.requestId || 'REQ-SAMPLE-001',
        callbackUrl:
          req.query?.callbackUrl ||
          'http://localhost:5050/tiramis/mock/callback-receiver',
      });

      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || String(error),
      });
    }
  });

  app.post('/tiramis/mock/load/run', express.json(), async (req, res) => {
    try {
      const result = await runLoadTest(req.body || {});

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || String(error),
      });
    }
  });

  app.post('/tiramis/mock/callback-receiver', (req, res) => {
    try {
      const finalResponseXml = req.body || '';
      const ackXml = buildCallbackAckForFinalResponse(finalResponseXml);
      const contentXml = extractContentXml(finalResponseXml);

      console.log('[load-callback-receiver]', {
        finalRoot: getRoot(contentXml || finalResponseXml),
        requestId: getTag(contentXml || finalResponseXml, 'RequestId'),
        responseCode:
          getTag(contentXml || finalResponseXml, 'ResponseStatusCode') ||
          getTag(contentXml || finalResponseXml, 'StatusCode'),
      });

      res.set('Content-Type', 'application/xml');
      res.status(200).send(ackXml);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || String(error),
      });
    }
  });

  app.get('/tiramis/mock/load/help', (req, res) => {
    res.json({
      success: true,
      description:
        'Load testing helper for submitting many mock TIRA requests with concurrency.',
      endpoints: {
        serviceTypes: 'GET /tiramis/mock/load/service-types',
        sampleXml:
          'GET /tiramis/mock/load/sample-xml?serviceType=POLICY&requestId=REQ-001',
        runLoadTest: 'POST /tiramis/mock/load/run',
        callbackReceiver: 'POST /tiramis/mock/callback-receiver',
      },
      exampleBody: {
        serviceType: 'POLICY',
        count: 20,
        concurrency: 5,
        scenario: 'success',
        signed: false,
        callbackUrl: 'http://localhost:5050/tiramis/mock/callback-receiver',
      },
      scenarios: [
        'success',
        'unstable_network',
        'final_failure',
        'callback_retry',
        'no_callback',
        'http_500',
        'http_503',
        'timeout_before_ack',
      ],
    });
  });
}

module.exports = {
  registerLoadTestRoutes,
};
