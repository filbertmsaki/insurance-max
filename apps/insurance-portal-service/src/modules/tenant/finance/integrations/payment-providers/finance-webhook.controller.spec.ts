import { BadRequestException } from '@nestjs/common';
import { FinanceWebhookController } from './finance-webhook.controller';

describe('FinanceWebhookController raw-body boundary', () => {
  it('rejects requests without the original bytes', () => {
    const service = { process: jest.fn() };
    const controller = new FinanceWebhookController(service as never);
    expect(() =>
      controller.providerWebhook('TEST', {}, { body: {} } as never),
    ).toThrow(BadRequestException);
    expect(service.process).not.toHaveBeenCalled();
  });
  it('passes the exact original bytes to signature verification', () => {
    const service = { process: jest.fn() };
    const controller = new FinanceWebhookController(service as never);
    const rawBody = Buffer.from('{ "amount": 1 }');
    controller.providerWebhook('TEST', {}, { rawBody } as never);
    expect(service.process).toHaveBeenCalledWith('TEST', {}, rawBody);
  });
});
