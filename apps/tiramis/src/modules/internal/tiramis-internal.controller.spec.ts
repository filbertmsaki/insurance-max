import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { TiramisInternalController } from './tiramis-internal.controller';

describe('TiramisInternalController transport errors', () => {
  let controller: TiramisInternalController;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new TiramisInternalController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => loggerSpy.mockRestore());

  it('does not echo upstream payloads or raw messages over RPC', async () => {
    let rpcError: RpcException | undefined;
    try {
      await (controller as any).executeSubmit(
        { requestType: 'POLICY', payload: {} },
        'POLICY',
        async () => {
          throw Object.assign(
            new Error('private customer data and api-key secret'),
            { response: { rawXml: '<secret>customer</secret>' } },
          );
        },
      );
    } catch (error) {
      rpcError = error as RpcException;
    }

    expect(rpcError).toBeInstanceOf(RpcException);
    expect(rpcError?.getError()).toEqual({
      ok: false,
      code: 'TIRAMIS_SUBMISSION_FAILED',
      message:
        'TIRAMIS submission failed; use the authorized submission trace for details.',
    });
    expect(loggerSpy).toHaveBeenCalledWith('POLICY submission failed (Error)');
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain('customer');
    expect(JSON.stringify(rpcError?.getError())).not.toContain('secret');
  });
});
