import { API_CONTRACT_VERSION } from '../interfaces/api-response.interface';

import { isApiSuccessResponse, unwrapApiResponse } from './api-response.util';

describe('API response utilities', () => {
  it('recognizes and unwraps a success response', () => {
    const response = {
      success: true as const,

      data: {
        id: 'record-1',
      },

      meta: {
        requestId: 'request-1',
        correlationId: 'request-1',
        timestamp: new Date().toISOString(),
        method: 'GET',
        path: '/records/1',
        statusCode: 200,
        contractVersion: API_CONTRACT_VERSION,
      },
    };

    expect(isApiSuccessResponse(response)).toBe(true);

    expect(unwrapApiResponse(response)).toEqual({
      id: 'record-1',
    });
  });
});
