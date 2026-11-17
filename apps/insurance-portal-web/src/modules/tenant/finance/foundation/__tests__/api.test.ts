import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi } from '../api';
import { scope, summary, document, uuid } from './fixtures';

vi.mock('@/modules/shared/api/client', () => ({ apiClient: { get: vi.fn() } }));
const get = vi.mocked(apiClient.get);
beforeEach(() => vi.clearAllMocks());

describe('Finance foundation read adapter', () => {
  it('uses only scoped GETs with exact version evidence and abort signals', async () => {
    const signal = new AbortController().signal;
    get
      .mockResolvedValueOnce({ data: [scope] })
      .mockResolvedValueOnce({ data: [summary] })
      .mockResolvedValueOnce({ data: document });
    await expect(foundationReadApi.scopes(signal)).resolves.toEqual([scope]);
    await expect(
      foundationReadApi.documents(scope, 'CURRENCY_CONTEXT', signal),
    ).resolves.toEqual([summary]);
    await expect(
      foundationReadApi.document(scope, summary, signal),
    ).resolves.toEqual(document);
    expect(get.mock.calls).toEqual([
      ['/tenant/finance/foundation/scopes', { signal }],
      [
        '/tenant/finance/foundation/documents',
        {
          params: {
            legalEntityId: scope.legalEntityId,
            bookId: scope.bookId,
            kind: 'CURRENCY_CONTEXT',
            limit: 50,
          },
          signal,
        },
      ],
      [
        `/tenant/finance/foundation/documents/${summary.id}`,
        {
          params: {
            legalEntityId: scope.legalEntityId,
            bookId: scope.bookId,
            subjectHash: summary.subject_hash,
          },
          signal,
        },
      ],
    ]);
  });
  it.each([
    'tenant_id',
    'legal_entity_id',
    'book_id',
    'id',
    'subject_hash',
  ] as const)('rejects a detail response with mismatched %s', async (field) => {
    get.mockResolvedValue({
      data: {
        ...document,
        [field]: field === 'subject_hash' ? 'b'.repeat(64) : uuid(99),
      },
    });
    await expect(foundationReadApi.document(scope, summary)).rejects.toThrow(
      'does not match',
    );
  });
  it.each([null, {}, [{ ...scope, state: 'DISABLED' }]])(
    'does not turn a malformed scope response into an empty book',
    async (data) => {
      get.mockResolvedValue({ data });
      await expect(foundationReadApi.scopes()).rejects.toThrow();
    },
  );
  it('propagates denied requests instead of substituting empty financial data', async () => {
    const error = { response: { status: 403 } };
    get.mockRejectedValue(error);
    await expect(foundationReadApi.documents(scope)).rejects.toBe(error);
  });
});
