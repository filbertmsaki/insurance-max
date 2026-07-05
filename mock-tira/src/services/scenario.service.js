const { CONFIG } = require('../config/mock-config');
const { MOCK_SCENARIOS } = require('../constants/mock-scenarios.constant');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const { getTag } = require('../utils/xml.util');
const { getDelayMs } = require('../utils/time.util');

const ONE_TIME_SCENARIOS = [];

function normalizeScenario(value) {
  const scenario = String(value || '').trim().toLowerCase();

  if (!scenario) {
    return null;
  }

  const allowed = Object.values(MOCK_SCENARIOS);

  return allowed.includes(scenario) ? scenario : null;
}

function resolveScenario(req, xml, root) {
  const endpointDefinition = req.mockEndpointDefinition || null;

  const fromOneTime = ONE_TIME_SCENARIOS.find((item) => {
    if (item.used >= item.times) {
      return false;
    }

    if (item.requestRoot && item.requestRoot !== root) {
      return false;
    }

    if (
      item.serviceType &&
      endpointDefinition?.serviceType &&
      item.serviceType !== endpointDefinition.serviceType
    ) {
      return false;
    }

    return true;
  });

  if (fromOneTime) {
    fromOneTime.used += 1;
    return fromOneTime.scenario;
  }

  return (
    normalizeScenario(req.header('X-Mock-Scenario')) ||
    normalizeScenario(req.query?.scenario) ||
    normalizeScenario(getTag(xml, 'MockScenario')) ||
    normalizeScenario(CONFIG.defaultScenario) ||
    MOCK_SCENARIOS.SUCCESS
  );
}

function scenarioToHttpFailure(scenario) {
  if (scenario === MOCK_SCENARIOS.HTTP_500) {
    return {
      status: 500,
      body: 'Mock TIRA HTTP 500 Internal Server Error',
    };
  }

  if (scenario === MOCK_SCENARIOS.HTTP_503) {
    return {
      status: 503,
      body: 'Mock TIRA HTTP 503 Service Unavailable',
    };
  }

  return null;
}

function scenarioToAckFailure(scenario) {
  if (scenario === MOCK_SCENARIOS.ACK_FAILURE) {
    return {
      code: 'TIRA002',
      desc: 'Mock TIRA acknowledgement failure',
    };
  }

  if (scenario === MOCK_SCENARIOS.VALIDATION_ERROR) {
    return {
      code: 'TIRA005',
      desc: RESPONSE_CODES.TIRA005,
    };
  }

  if (scenario === MOCK_SCENARIOS.INVALID_SIGNATURE) {
    return {
      code: 'TIRA016',
      desc: RESPONSE_CODES.TIRA016,
    };
  }

  if (scenario === MOCK_SCENARIOS.INVALID_CLIENT) {
    return {
      code: 'TIRA013',
      desc: RESPONSE_CODES.TIRA013,
    };
  }

  if (scenario === MOCK_SCENARIOS.INACTIVE_CLIENT) {
    return {
      code: 'TIRA012',
      desc: RESPONSE_CODES.TIRA012,
    };
  }

  if (scenario === MOCK_SCENARIOS.DUPLICATE_REQUEST) {
    return {
      code: 'TIRA007',
      desc: RESPONSE_CODES.TIRA007,
    };
  }

  return null;
}

function getScenarioAckDelay(req, scenario) {
  if (scenario === MOCK_SCENARIOS.SLOW_ACK) {
    return getDelayMs(
      req,
      'X-Mock-Ack-Delay-Ms',
      'ackDelayMs',
      CONFIG.slowAckDelayMs,
    );
  }

  return getDelayMs(
    req,
    'X-Mock-Ack-Delay-Ms',
    'ackDelayMs',
    CONFIG.ackDelayMs,
  );
}

function getScenarioCallbackDelay(req, scenario) {
  if (scenario === MOCK_SCENARIOS.SLOW_CALLBACK) {
    return getDelayMs(
      req,
      'X-Mock-Callback-Delay-Ms',
      'callbackDelayMs',
      CONFIG.slowCallbackDelayMs,
    );
  }

  return getDelayMs(
    req,
    'X-Mock-Callback-Delay-Ms',
    'callbackDelayMs',
    CONFIG.callbackDelayMs,
  );
}

function getScenarioFinalStatus(scenario) {
  if (scenario === MOCK_SCENARIOS.FINAL_FAILURE) {
    return {
      code: 'TIRA002',
      desc: 'Mock TIRA final response failure',
    };
  }

  return {
    code: 'TIRA001',
    desc: RESPONSE_CODES.TIRA001,
  };
}

function queueScenario(params) {
  const scenario = normalizeScenario(params.scenario);

  if (!scenario) {
    return null;
  }

  const times = Math.min(Math.max(Number(params.times || 1), 1), 100);

  const item = {
    scenario,
    requestRoot: params.requestRoot || params.root || null,
    serviceType: params.serviceType || null,
    times,
    used: 0,
    createdAt: new Date().toISOString(),
  };

  ONE_TIME_SCENARIOS.push(item);

  return item;
}

function listQueuedScenarios() {
  return ONE_TIME_SCENARIOS;
}

module.exports = {
  ONE_TIME_SCENARIOS,
  normalizeScenario,
  resolveScenario,
  scenarioToHttpFailure,
  scenarioToAckFailure,
  getScenarioAckDelay,
  getScenarioCallbackDelay,
  getScenarioFinalStatus,
  queueScenario,
  listQueuedScenarios,
};
