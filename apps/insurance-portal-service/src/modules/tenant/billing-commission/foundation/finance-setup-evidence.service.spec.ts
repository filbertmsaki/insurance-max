import { createHash } from 'node:crypto';
import { FinanceSetupEvidenceService } from './finance-setup-evidence.service';

describe('Finance setup evidence delivery', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const buffer = Buffer.from('Owned setup evidence');
  const evidence = {
    id,
    documentId: id,
    hash: createHash('sha256').update(buffer).digest('hex'),
    purpose: 'LEGAL',
  };
  function fixture(rows: unknown[], bytes = buffer) {
    const save = jest.fn(),
      query = jest.fn().mockResolvedValue(rows),
      read = jest.fn().mockResolvedValue(bytes);
    const manager = { query, getRepository: () => ({ save }) };
    const setup = {
      withAccess: jest.fn((_actor, _scope, _access, _permission, work) =>
        work(manager),
      ),
    };
    const service = new FinanceSetupEvidenceService(
      setup as never,
      { read } as never,
    );
    return { service, save, read, setup };
  }
  const file = {
    storage_key: 'owned/blob',
    original_file_name: 'Evidence.txt',
    file_size: buffer.length,
  };
  it('denies unrelated or unavailable versions before reading storage', async () => {
    const f = fixture([]);
    await expect(
      f.service.download(
        { sourceCompanyId: id } as never,
        {} as never,
        evidence,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.read).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('rejects changed bytes rather than serving evidence under a stale hash', async () => {
    const f = fixture([file], Buffer.from('Changed'));
    await expect(
      f.service.download(
        { sourceCompanyId: id } as never,
        {} as never,
        evidence,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.save).not.toHaveBeenCalled();
  });
  it('returns exact bytes and records native access evidence', async () => {
    const f = fixture([file]);
    await expect(
      f.service.download(
        { sourceCompanyId: id, sourceUserId: id } as never,
        {} as never,
        evidence,
      ),
    ).resolves.toEqual({ buffer, fileName: 'Evidence.txt' });
    expect(f.save).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: id,
        document_version_id: id,
        result: 'SUCCESS',
        access_channel: 'FINANCE_SETUP',
      }),
    );
  });
});
