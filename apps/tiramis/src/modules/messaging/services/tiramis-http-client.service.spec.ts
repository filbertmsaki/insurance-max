import { RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TiramisHttpClientService } from './tiramis-http-client.service';

describe('TiramisHttpClientService request logs', () => {
  const request = {
    requestId: 'AICCNRR19070658',
    url: 'https://tira.example.test/submit',
    xml: '<TiraMsg><RequestId>AICCNRR19070658</RequestId></TiraMsg>',
    headers: {
      'Content-Type': 'application/xml',
      ClientCode: 'ICC110',
      ClientKey: 'secret-client-key',
    },
  };

  function createClient() {
    const http = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ status: 200, statusText: 'OK', data: '<Ack/>', headers: {} }),
        ),
    };
    const log = { append: jest.fn().mockResolvedValue(undefined) };
    const service = new TiramisHttpClientService(
      http as any,
      new ConfigService(),
      { getRequestId: () => 'http-correlation-id' } as any,
      log as any,
    );
    return { service, http, log };
  }

  it('logs full XML using the business ID, without authentication headers', async () => {
    const { service, log } = createClient();
    await service.postXml(request);
    expect(log.append).toHaveBeenNthCalledWith(
      1,
      request.requestId,
      expect.objectContaining({ event: 'tira.request.sent', xml: request.xml }),
    );
    expect(log.append).toHaveBeenNthCalledWith(
      2,
      request.requestId,
      expect.objectContaining({
        event: 'tira.response.received',
        statusCode: 200,
        xml: '<Ack/>',
      }),
    );
    expect(JSON.stringify(log.append.mock.calls)).not.toContain(
      'secret-client-key',
    );
  });

  it('logs timeout errors while keeping the original HTTP error behavior', async () => {
    const { service, http, log } = createClient();
    http.post.mockReturnValue(
      throwError(() =>
        Object.assign(new Error('Timed out'), { code: 'ECONNABORTED' }),
      ),
    );
    await expect(service.postXml(request)).rejects.toBeInstanceOf(
      RequestTimeoutException,
    );
    expect(log.append).toHaveBeenLastCalledWith(
      request.requestId,
      expect.objectContaining({
        event: 'tira.request.failed',
        code: 'ECONNABORTED',
      }),
    );
  });

  it('keeps the response body when TIRA returns an HTTP error', async () => {
    const { service, http, log } = createClient();
    http.post.mockReturnValue(
      of({ status: 500, statusText: 'Error', data: '<Error/>', headers: {} }),
    );
    expect((await service.postXml(request)).statusCode).toBe(500);
    expect(log.append).toHaveBeenLastCalledWith(
      request.requestId,
      expect.objectContaining({ statusCode: 500, xml: '<Error/>' }),
    );
  });

  it('skips the request log when logRequest is false', async () => {
    const { service, http, log } = createClient();
    await service.postXml({ ...request, logRequest: false });
    http.post.mockReturnValue(throwError(() => new Error('Network down')));
    await expect(
      service.postXml({ ...request, logRequest: false }),
    ).rejects.toThrow();
    expect(log.append).not.toHaveBeenCalled();
  });
});
