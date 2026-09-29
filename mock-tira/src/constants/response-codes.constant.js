const RESPONSE_CODES = {
  TIRA001: 'Successful',
  TIRA002: 'Failure',
  TIRA003: 'Invalid client key',
  TIRA004: 'An error occurred while processing',
  TIRA005: 'Invalid or incomplete request data',
  TIRA006: 'Request could not be processed. Try again later',
  TIRA007: 'Requested data could not be found',
  TIRA008: 'Required request header information not provided',
  TIRA009: 'Request header information mismatch client identification parameters',
  TIRA010: 'Server internal communication failure',
  TIRA011: 'Client system configuration not found',
  TIRA012: 'Inactive or disabled client system configuration',
  TIRA013: 'Inactive or invalid client',
  TIRA014: 'Client PKI certificate file not found in specified path',
  TIRA015: 'Bad or missing Client PKI configurations',
  TIRA016: 'Invalid request signature',
  TIRA017: 'Invalid client system call back url',
  TIRA214: 'Transaction successfully cancelled',
};

module.exports = {
  RESPONSE_CODES,
};
