import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { TiramisTcpGatewayController } from './tiramis-tcp-gateway.controller';

describe('TiramisTcpGatewayController transport errors', () => {
  let controller: TiramisTcpGatewayController;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new TiramisTcpGatewayController({} as any, {} as any);
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => loggerSpy.mockRestore());

  it('does not echo upstream payloads or raw messages over TCP', async () => {
    let rpcError: RpcException | undefined;
    try {
      await (controller as any).handleSubmit(
        'tiramis.motor_fleet.submit',
        { requestType: 'MOTOR_FLEET' },
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
    expect(loggerSpy).toHaveBeenCalledWith(
      'MOTOR_FLEET submission failed (Error)',
    );
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain('customer');
    expect(JSON.stringify(rpcError?.getError())).not.toContain('secret');
  });
});
