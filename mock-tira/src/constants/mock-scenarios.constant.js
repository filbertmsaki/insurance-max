const MOCK_SCENARIOS = {
  SUCCESS: 'success',
  ACK_FAILURE: 'ack_failure',
  FINAL_FAILURE: 'final_failure',
  VALIDATION_ERROR: 'validation_error',
  INVALID_SIGNATURE: 'invalid_signature',
  INVALID_CLIENT: 'invalid_client',
  INACTIVE_CLIENT: 'inactive_client',
  DUPLICATE_REQUEST: 'duplicate_request',
  HTTP_500: 'http_500',
  HTTP_503: 'http_503',
  SLOW_ACK: 'slow_ack',
  SLOW_CALLBACK: 'slow_callback',
  TIMEOUT_BEFORE_ACK: 'timeout_before_ack',
  NO_CALLBACK: 'no_callback',
  CALLBACK_RETRY: 'callback_retry',
  UNSTABLE_NETWORK: 'unstable_network',
  RANDOM_FAILURE: 'random_failure',
};

module.exports = {
  MOCK_SCENARIOS,
};
