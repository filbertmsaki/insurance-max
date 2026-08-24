const { CONFIG } = require('../config/mock-config');
const { MOCK_SCENARIOS } = require('../constants/mock-scenarios.constant');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const {
  ASYNC_RESPONSE_ROOTS,
  SYNC_RESPONSE_ROOTS,
} = require('../constants/tiramis-roots.constant');

const { getRoot, getTag, extractContentXml } = require('../utils/xml.util');
const { getDelayMs } = require('../utils/time.util');
const { sendXml } = require('../utils/http-response.util');

const {
  createTrackingRecord,
  updateTracking,
} = require('../store/mock-request.store');

const {
  resolveScenario,
  scenarioToHttpFailure,
  scenarioToAckFailure,
  getScenarioAckDelay,
  getScenarioCallbackDelay,
  getScenarioFinalStatus,
} = require('./scenario.service');
const {
  extractDuplicateIdentity,
  checkDuplicateRequest,
  buildDuplicateKey,
} = require('./duplicate.service');
const {
  resolveMockResponseData,
} = require('./mock-response-data.service');
const { resolveChaosDecision } = require('./chaos.service');

const {
  validateBusinessXml,
  buildValidationFailureDescription,
} = require('./validation.service');

const {
  buildTiraMessage,
  buildRawTiraMessage,
  buildAcknowledgementContent,
  buildAsyncFinalResponseContent,
  buildSyncResponseContent,
  buildFailureReply,
} = require('./response-builder.service');

const { sendCallbackWithRetry } = require('./callback.service');

function isCoverCancellationEndorsement(xml) {
  const coverNoteType = String(getTag(xml, 'CoverNoteType') || '').trim();
  const endorsementType = String(getTag(xml, 'EndorsementType') || '').trim();

  return coverNoteType === '3' && endorsementType === '4';
}

function resolveFinalResponseStatus({ xml, finalStatus }) {
  if (!finalStatus || String(finalStatus.code || '').trim() !== 'TIRA001') {
    return finalStatus;
  }

  if (isCoverCancellationEndorsement(xml)) {
    return {
      ...finalStatus,
      desc: 'Transaction successfully cancelled',
    };
  }

  return finalStatus;
}

function resolveFinalStatus({ scenario, contentXml }) {
  return resolveFinalResponseStatus({
    xml: contentXml,
    finalStatus: getScenarioFinalStatus(scenario),
  });
}

function createTiramisRequestHandler(deps) {
  const validateHeaders = deps.validateHeaders;
  const verifyClientRequestSignature = deps.verifyClientRequestSignature;

  const wrapTiraMessage =
    deps.wrapTiraMessage ||
    ((contentXml) => buildTiraMessage(contentXml, deps.signResponseContent));
  const wrapFinalTiraMessage =
    deps.wrapFinalTiraMessage ||
    ((contentXml) =>
      buildRawTiraMessage(contentXml, deps.signResponseContent));

  if (!validateHeaders) {
    throw new Error('validateHeaders dependency is required');
  }

  if (!verifyClientRequestSignature) {
    throw new Error('verifyClientRequestSignature dependency is required');
  }

  async function handleTiramisRequest(req, res, endpointDefinition) {
    req.mockEndpointDefinition = endpointDefinition;

    const xml = req.body || '';
    const root = getRoot(xml);
    const requestId = getTag(xml, 'RequestId') || `REQ-${Date.now()}`;
    const callbackUrl = getTag(xml, 'CallBackUrl');
    const contentXml = extractContentXml(xml);
    let scenario = resolveScenario(req, contentXml || xml, root);
    const chaosDecision = resolveChaosDecision({
      req,
      root,
      endpointDefinition,
      scenario,
      xml: contentXml || xml,
    });

    if (chaosDecision.scenarioOverride) {
      scenario = chaosDecision.scenarioOverride;
    }

    const ackDelayMs =
      getScenarioAckDelay(req, scenario) +
      Number(chaosDecision.ackDelayMs || 0);
    const callbackExtraDelayMs = Number(chaosDecision.callbackDelayMs || 0);
    const duplicateIdentity = extractDuplicateIdentity(
      root,
      contentXml || xml,
      endpointDefinition,
    );
    const responseData = resolveMockResponseData({
      req,
      root,
      requestId,
      xml: contentXml || xml,
    });

    const tracking = createTrackingRecord({
      requestId,
      root,
      serviceType: endpointDefinition.serviceType,
      endpoint: endpointDefinition.endpointUrl,
      mode: endpointDefinition.mode,
      scenario,
      callbackUrl,
      companyCode: duplicateIdentity.companyCode,
      insurerCompanyCode: duplicateIdentity.insurerCompanyCode,
      businessReference: duplicateIdentity.businessReference,
      duplicateKey: buildDuplicateKey(duplicateIdentity),
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

    updateTracking(tracking, {
      chaosDecision,
      responseData,
    });

    console.log('\n========== MOCK TIRA REQUEST ==========');
    console.log('Endpoint:', endpointDefinition.endpointUrl);
    console.log('ServiceType:', endpointDefinition.serviceType);
    console.log('Mode:', endpointDefinition.mode);
    console.log('Root:', root || 'UNKNOWN');
    console.log('RequestId:', requestId);
    console.log('Scenario:', scenario);
    console.log('CallbackUrl:', callbackUrl || 'N/A');

    const httpFailure = chaosDecision.httpFailure || scenarioToHttpFailure(scenario);

    if (httpFailure) {
      updateTracking(tracking, {
        status: `HTTP_${httpFailure.status}`,
        lastError: httpFailure.body,
      });

      return res.status(httpFailure.status).send(httpFailure.body);
    }

    if (
      chaosDecision.timeoutBeforeAck ||
      scenario === MOCK_SCENARIOS.TIMEOUT_BEFORE_ACK
    ) {
      const delayMs =
        chaosDecision.timeoutDelayMs ||
        getDelayMs(
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
        'Unable to detect XML request root',
      );

      const responseXml = wrapTiraMessage(content);

      updateTracking(tracking, {
        status: 'UNKNOWN_ROOT',
        ackCode: 'TIRA005',
        ackXml: responseXml,
      });

      return sendXml(res, responseXml);
    }

    if (!isRootAllowedForEndpoint(endpointDefinition, root)) {
      const content = buildFailureReply(
        root,
        requestId,
        'TIRA005',
        `Unsupported request root ${root} for endpoint ${endpointDefinition.endpointUrl}`,
        xml,
      );

      const responseXml = wrapTiraMessage(content);

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

      const responseXml = wrapTiraMessage(content);

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
        ackDelayMs,
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

      const responseXml = wrapTiraMessage(content);

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

      const responseXml = wrapTiraMessage(content);

      updateTracking(tracking, {
        status: 'SIGNATURE_VALIDATION_FAILED',
        ackCode: signatureValidation.code,
        ackXml: responseXml,
        validations: [signatureValidation.desc],
      });

      return sendXml(res, responseXml);
    }

    const duplicateCheck = checkDuplicateRequest({
      root,
      xml: contentXml || xml,
      endpointDefinition,
      identity: duplicateIdentity,
      currentTrackingId: tracking.id,
      currentRequestId: requestId,
    });

    updateTracking(tracking, {
      duplicateCheck,
    });

    if (duplicateCheck.isDuplicate) {
      const content = buildFailureReply(
        root,
        requestId,
        duplicateCheck.code || 'TIRA007',
        duplicateCheck.desc || RESPONSE_CODES.TIRA007,
        xml,
      );

      const responseXml = wrapTiraMessage(content);

      updateTracking(tracking, {
        status: 'DUPLICATE_REQUEST',
        ackCode: duplicateCheck.code || 'TIRA007',
        ackXml: responseXml,
        duplicateOfRequestId: duplicateCheck.duplicateOfRequestId,
        duplicateOfTrackingId: duplicateCheck.duplicateOfTrackingId,
        duplicateReason: duplicateCheck.reason,
        validations: [duplicateCheck.reason],
      });

      return sendXml(
        res,
        responseXml,
        200,
        ackDelayMs,
      );
    }

    const businessValidation = validateBusinessXml(
      root,
      contentXml || xml,
      endpointDefinition,
    );

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

      const responseXml = wrapTiraMessage(content);

      updateTracking(tracking, {
        status: 'BUSINESS_VALIDATION_FAILED',
        ackCode: 'TIRA005',
        ackXml: responseXml,
      });

      return sendXml(
        res,
        responseXml,
        200,
        ackDelayMs,
      );
    }

    if (isSyncRequest(endpointDefinition, root)) {
      const content = buildSyncResponseContent(
        root,
        requestId,
        'TIRA001',
        RESPONSE_CODES.TIRA001,
        contentXml || xml,
        {
          responseData,
        },
      );

      const responseXml = wrapTiraMessage(content);

      updateTracking(tracking, {
        status: 'SYNC_RESPONSE_SENT',
        finalCode: 'TIRA001',
        finalXml: responseXml,
      });

      return sendXml(
        res,
        responseXml,
        200,
        ackDelayMs,
      );
    }

    if (!ASYNC_RESPONSE_ROOTS[root]) {
      const content = buildAcknowledgementContent(
        root,
        requestId,
        'TIRA005',
        `Unsupported async request root: ${root}`,
      );

      const responseXml = wrapTiraMessage(content);

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

      const responseXml = wrapTiraMessage(content);

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

    const ackXml = wrapTiraMessage(ackContent);

    updateTracking(tracking, {
      status: 'ACK_SENT',
      ackCode: 'TIRA001',
      ackXml,
    });

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

    const finalStatus = resolveFinalStatus({
      scenario,
      contentXml: contentXml || xml,
    });

    const finalContent = buildAsyncFinalResponseContent(
      root,
      requestId,
      finalStatus.code,
      finalStatus.desc,
      {
        responseData,
      },
    );

    const finalResponseXml = wrapFinalTiraMessage(finalContent);
    const callbackDelayMs =
      getScenarioCallbackDelay(req, scenario) + callbackExtraDelayMs;
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

  return handleTiramisRequest;
}

function resolveFinalStatus({ scenario, contentXml }) {
  const scenarioStatus = getScenarioFinalStatus(scenario);

  // CoverNoteType 3 is an endorsement; only endorsement type 4 is a
  // cancellation. Other endorsements retain the normal scenario response.
  if (
    getTag(contentXml, 'CoverNoteType') === '3' &&
    getTag(contentXml, 'EndorsementType') === '4'
  ) {
    return {
      code: 'TIRA001',
      desc: 'Transaction successfully cancelled',
    };
  }

  return scenarioStatus;
}

function isRootAllowedForEndpoint(endpointDefinition, root) {
  if (!endpointDefinition?.requestRoots?.length) {
    return true;
  }

  return endpointDefinition.requestRoots.includes(root);
}

function isSyncRequest(endpointDefinition, root) {
  if (endpointDefinition?.mode === 'sync') {
    return true;
  }

  if (endpointDefinition?.mode === 'mixed' && SYNC_RESPONSE_ROOTS[root]) {
    return true;
  }

  return !!SYNC_RESPONSE_ROOTS[root];
}

module.exports = {
  createTiramisRequestHandler,
  isRootAllowedForEndpoint,
  isSyncRequest,
  isCoverCancellationEndorsement,
  resolveFinalResponseStatus,
  resolveFinalStatus,
};
