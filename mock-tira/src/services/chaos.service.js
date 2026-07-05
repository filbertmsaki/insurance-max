const { CONFIG } = require('../config/mock-config');
const { MOCK_SCENARIOS } = require('../constants/mock-scenarios.constant');

function clampRate(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 100);
}

function randomInt(min, max) {
  const safeMin = Math.max(Number(min || 0), 0);
  const safeMax = Math.max(Number(max || 0), safeMin);

  if (safeMax <= safeMin) {
    return safeMin;
  }

  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function roll(rate) {
  const safeRate = clampRate(rate);
  const value = Math.random() * 100;

  return {
    triggered: value < safeRate,
    rate: safeRate,
    roll: Number(value.toFixed(2)),
  };
}

function isChaosScenario(scenario) {
  return (
    scenario === MOCK_SCENARIOS.UNSTABLE_NETWORK ||
    scenario === MOCK_SCENARIOS.RANDOM_FAILURE
  );
}

function isChaosActive(scenario) {
  return CONFIG.chaosEnabled || isChaosScenario(scenario);
}

function getChaosRates(scenario) {
  if (scenario === MOCK_SCENARIOS.UNSTABLE_NETWORK) {
    return {
      timeoutRate: CONFIG.unstableTimeoutRate,
      http500Rate: CONFIG.unstableHttp500Rate,
      http503Rate: CONFIG.unstableHttp503Rate,
      ackFailureRate: CONFIG.unstableAckFailureRate,
      finalFailureRate: CONFIG.unstableFinalFailureRate,
      noCallbackRate: CONFIG.unstableNoCallbackRate,
      callbackRetryRate: CONFIG.unstableCallbackRetryRate,
      minLatencyMs: CONFIG.unstableMinLatencyMs,
      maxLatencyMs: CONFIG.unstableMaxLatencyMs,
    };
  }

  return {
    timeoutRate: CONFIG.randomTimeoutRate,
    http500Rate: CONFIG.randomHttp500Rate,
    http503Rate: CONFIG.randomHttp503Rate,
    ackFailureRate: CONFIG.randomAckFailureRate,
    finalFailureRate: CONFIG.randomFinalFailureRate,
    noCallbackRate: CONFIG.randomNoCallbackRate,
    callbackRetryRate: CONFIG.randomCallbackRetryRate,
    minLatencyMs: CONFIG.chaosMinLatencyMs,
    maxLatencyMs: CONFIG.chaosMaxLatencyMs,
  };
}

function resolveChaosDecision(params) {
  const scenario = params.scenario;

  if (!isChaosActive(scenario)) {
    return {
      enabled: false,
      applied: false,
      scenario,
      reason: 'chaos_disabled',
    };
  }

  const rates = getChaosRates(scenario);

  const decision = {
    enabled: true,
    applied: false,
    originalScenario: scenario,
    scenarioOverride: null,
    httpFailure: null,
    timeoutBeforeAck: false,
    timeoutDelayMs: null,
    ackDelayMs: randomInt(rates.minLatencyMs, rates.maxLatencyMs),
    callbackDelayMs: randomInt(rates.minLatencyMs, rates.maxLatencyMs),
    rolls: {},
    reason: null,
  };

  decision.rolls.timeout = roll(rates.timeoutRate);

  if (decision.rolls.timeout.triggered) {
    decision.applied = true;
    decision.timeoutBeforeAck = true;
    decision.timeoutDelayMs = CONFIG.timeoutBeforeAckMs;
    decision.reason = 'random_timeout_before_ack';
    return decision;
  }

  decision.rolls.http503 = roll(rates.http503Rate);

  if (decision.rolls.http503.triggered) {
    decision.applied = true;
    decision.httpFailure = {
      status: 503,
      body: 'Mock chaos HTTP 503 Service Unavailable',
    };
    decision.reason = 'random_http_503';
    return decision;
  }

  decision.rolls.http500 = roll(rates.http500Rate);

  if (decision.rolls.http500.triggered) {
    decision.applied = true;
    decision.httpFailure = {
      status: 500,
      body: 'Mock chaos HTTP 500 Internal Server Error',
    };
    decision.reason = 'random_http_500';
    return decision;
  }

  decision.rolls.ackFailure = roll(rates.ackFailureRate);

  if (decision.rolls.ackFailure.triggered) {
    decision.applied = true;
    decision.scenarioOverride = MOCK_SCENARIOS.ACK_FAILURE;
    decision.reason = 'random_ack_failure';
    return decision;
  }

  decision.rolls.noCallback = roll(rates.noCallbackRate);

  if (decision.rolls.noCallback.triggered) {
    decision.applied = true;
    decision.scenarioOverride = MOCK_SCENARIOS.NO_CALLBACK;
    decision.reason = 'random_no_callback';
    return decision;
  }

  decision.rolls.finalFailure = roll(rates.finalFailureRate);

  if (decision.rolls.finalFailure.triggered) {
    decision.applied = true;
    decision.scenarioOverride = MOCK_SCENARIOS.FINAL_FAILURE;
    decision.reason = 'random_final_failure';
    return decision;
  }

  decision.rolls.callbackRetry = roll(rates.callbackRetryRate);

  if (decision.rolls.callbackRetry.triggered) {
    decision.applied = true;
    decision.scenarioOverride = MOCK_SCENARIOS.CALLBACK_RETRY;
    decision.reason = 'random_callback_retry';
    return decision;
  }

  decision.reason = 'latency_only';

  if (decision.ackDelayMs > 0 || decision.callbackDelayMs > 0) {
    decision.applied = true;
  }

  return decision;
}

function getChaosConfig() {
  return {
    enabled: CONFIG.chaosEnabled,
    global: {
      minLatencyMs: CONFIG.chaosMinLatencyMs,
      maxLatencyMs: CONFIG.chaosMaxLatencyMs,
      timeoutRate: CONFIG.randomTimeoutRate,
      http500Rate: CONFIG.randomHttp500Rate,
      http503Rate: CONFIG.randomHttp503Rate,
      ackFailureRate: CONFIG.randomAckFailureRate,
      finalFailureRate: CONFIG.randomFinalFailureRate,
      noCallbackRate: CONFIG.randomNoCallbackRate,
      callbackRetryRate: CONFIG.randomCallbackRetryRate,
    },
    unstableNetworkScenario: {
      scenario: MOCK_SCENARIOS.UNSTABLE_NETWORK,
      minLatencyMs: CONFIG.unstableMinLatencyMs,
      maxLatencyMs: CONFIG.unstableMaxLatencyMs,
      timeoutRate: CONFIG.unstableTimeoutRate,
      http500Rate: CONFIG.unstableHttp500Rate,
      http503Rate: CONFIG.unstableHttp503Rate,
      ackFailureRate: CONFIG.unstableAckFailureRate,
      finalFailureRate: CONFIG.unstableFinalFailureRate,
      noCallbackRate: CONFIG.unstableNoCallbackRate,
      callbackRetryRate: CONFIG.unstableCallbackRetryRate,
    },
  };
}

module.exports = {
  resolveChaosDecision,
  getChaosConfig,
};
