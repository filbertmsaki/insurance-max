const { CONFIG } = require('../config/mock-config');
const { MOCK_SCENARIOS } = require('../constants/mock-scenarios.constant');
const { getRoot, getTag } = require('../utils/xml.util');
const { addCallbackAttempt, updateTracking } = require('../store/mock-request.store');

async function sendCallbackWithRetry(callbackUrl, finalResponseXml, context = {}) {
  const requestId = context.requestId;
  const trackingId = context.trackingId || requestId;
  const scenario = context.scenario || MOCK_SCENARIOS.SUCCESS;

  const maxAttempts = Number(CONFIG.callbackRetries || 3);
  const retryDelayMs = Number(CONFIG.callbackRetryDelayMs || 5000);

  let attempt = 0;
  let accepted = false;
  let lastError = null;

  while (attempt < maxAttempts && !accepted) {
    attempt += 1;

    const shouldForceFail =
      scenario === MOCK_SCENARIOS.CALLBACK_RETRY &&
      attempt <= Number(CONFIG.callbackFailFirstAttempts || 1);

    try {
      if (shouldForceFail) {
        throw new Error(
          `Mock callback_retry forced failure for attempt ${attempt}`,
        );
      }

      console.log(
        `[callback] Attempt ${attempt}/${maxAttempts} for RequestId ${requestId}`,
      );
      console.log(`[callback] URL: ${callbackUrl}`);

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'X-Mock-Tira-Callback': 'true',
          'X-Mock-Request-Id': requestId || '',
          'X-Mock-Scenario': scenario,
        },
        body: finalResponseXml,
      });

      const responseText = await response.text();

      const ackRoot = getRoot(responseText);
      const ackRequestId = getTag(responseText, 'RequestId');
      const ackCode =
        getTag(responseText, 'AckStatusCode') ||
        getTag(responseText, 'AcknowledgementStatusCode') ||
        getTag(responseText, 'ResponseStatusCode') ||
        getTag(responseText, 'StatusCode');

      addCallbackAttempt(trackingId, {
        attempt,
        success: response.ok,
        httpStatus: response.status,
        ackRoot,
        ackRequestId,
        ackCode,
        responseBodyPreview: responseText.slice(0, 1000),
      });

      if (!response.ok) {
        throw new Error(`Callback returned HTTP ${response.status}`);
      }

      accepted = true;

      updateTracking(trackingId, {
        status: 'CALLBACK_ACCEPTED',
        callbackAcceptedAt: new Date().toISOString(),
        lastCallbackHttpStatus: response.status,
      });

      console.log(
        `[callback] Callback accepted for RequestId ${requestId}, HTTP ${response.status}`,
      );

      return true;
    } catch (error) {
      lastError = error;

      addCallbackAttempt(trackingId, {
        attempt,
        success: false,
        error: error.message || String(error),
      });

      updateTracking(trackingId, {
        status:
          attempt >= maxAttempts
            ? 'CALLBACK_FAILED'
            : 'CALLBACK_RETRY_PENDING',
        lastCallbackError: error.message || String(error),
      });

      console.warn(
        `[callback] Attempt ${attempt} failed for RequestId ${requestId}: ${
          error.message || error
        }`,
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  updateTracking(trackingId, {
    status: 'CALLBACK_FAILED',
    lastCallbackError: lastError?.message || String(lastError || ''),
  });

  return false;
}

module.exports = {
  sendCallbackWithRetry,
};
