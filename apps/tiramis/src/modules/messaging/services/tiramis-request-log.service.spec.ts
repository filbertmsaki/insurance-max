import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TiramisRequestLogService } from './tiramis-request-log.service';

describe('TiramisRequestLogService', () => {
  let root: string;
  let directory: string;
  let service: TiramisRequestLogService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tiramis-request-log-'));
    directory = join(root, 'requests');
    service = new TiramisRequestLogService(
      new ConfigService({
        tiramisService: { requestLogDir: directory, requestLogEnabled: true },
      }),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('appends complete XML lifecycle entries to the same request file', async () => {
    const xml = '<TiraMsg>\n<RequestId>Aiic</RequestId>\n</TiraMsg>';
    await service.append('Aiic', { event: 'tira.request.sent', xml });
    await service.append('Aiic', { event: 'tira.callback.received', xml });
    const entries = (await readFile(join(directory, 'Aiic.log'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        requestId: 'Aiic',
        xml,
        event: 'tira.request.sent',
      }),
    );
    expect(entries[1].event).toBe('tira.callback.received');
    expect(Number.isNaN(Date.parse(entries[0].timestamp))).toBe(false);
    if (process.platform !== 'win32') {
      expect((await stat(join(directory, 'Aiic.log'))).mode & 0o777).toBe(
        0o600,
      );
    }
  });

  it('keeps concurrent large writes intact and separates request IDs', async () => {
    const xml = 'x'.repeat(200000);
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.append('AIC-1', { index, xml }),
      ),
    );
    await service.append('AIC-2', { event: 'separate' });
    const entries = (await readFile(join(directory, 'AIC-1.log'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(entries.map((entry) => entry.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(entries.every((entry) => entry.xml === xml)).toBe(true);
    expect(await readdir(directory)).toEqual(['AIC-1.log', 'AIC-2.log']);
  });

  it('contains unsafe IDs within the log directory without filename collisions', async () => {
    const ids = ['../../outside', 'a/b', 'a_b', 'CON', 'x'.repeat(300)];
    for (const id of ids) await service.append(id, { event: 'received' });
    const files = await readdir(directory);
    expect(files).toHaveLength(ids.length);
    expect(await readdir(root)).toEqual(['requests']);
    const loggedIds = await Promise.all(
      files.map(
        async (file) =>
          JSON.parse(await readFile(join(directory, file), 'utf8')).requestId,
      ),
    );
    expect(loggedIds.sort()).toEqual(ids.sort());
  });

  it('does not create files when disabled', async () => {
    const disabled = new TiramisRequestLogService(
      new ConfigService({
        tiramisService: { requestLogDir: directory, requestLogEnabled: false },
      }),
    );
    await disabled.append('Aiic', { xml: 'private' });
    expect(await readdir(root)).toEqual([]);
  });

  it('redacts sensitive XML fields while storing the original payload hash', async () => {
    const xml =
      '<TiraMsg><RequestId>Aiic</RequestId><MsgSignature>secret</MsgSignature></TiraMsg>';

    await service.append('Aiic', { event: 'received', xml });

    const [entry] = (await readFile(join(directory, 'Aiic.log'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(entry.xml).toBe(
      '<TiraMsg><RequestId>Aiic</RequestId><MsgSignature>[redacted]</MsgSignature></TiraMsg>',
    );
    expect(entry.xmlSha256).toBe(
      createHash('sha256').update(xml, 'utf8').digest('hex'),
    );
  });

  it('reports filesystem errors without interrupting request processing', async () => {
    await writeFile(directory, 'not a directory');
    const warning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await expect(
      service.append('Aiic', { xml: 'private' }),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalled();
    expect(warning.mock.calls.flat().join(' ')).not.toContain('private');
  });
});
