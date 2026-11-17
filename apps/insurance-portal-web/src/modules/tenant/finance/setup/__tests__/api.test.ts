import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { setupApi } from '../api';
import { makeOverview, scope, summary, detail, uuid } from './fixtures';
vi.mock('@/modules/shared/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
const get = vi.mocked(apiClient.get),
  post = vi.mocked(apiClient.post);
beforeEach(() => vi.resetAllMocks());
describe('Exact setup book and version adapter', () => {
  it('uses scoped cancellable reads and rejects a different tenant in the response', async () => {
    const signal = new AbortController().signal;
    get.mockResolvedValueOnce({ data: makeOverview() });
    await expect(setupApi.overview(scope, signal)).resolves.toEqual(
      makeOverview(),
    );
    expect(get).toHaveBeenCalledWith('/tenant/finance/setup', {
      params: { legalEntityId: scope.legalEntityId, bookId: scope.bookId },
      signal,
    });
    get.mockResolvedValueOnce({
      data: {
        ...makeOverview(),
        scope: {
          tenantId: uuid(99),
          legalEntityId: scope.legalEntityId,
          bookId: scope.bookId,
        },
      },
    });
    await expect(setupApi.overview(scope)).rejects.toThrow(
      'selected accounting book',
    );
  });
  it('rejects an incomplete server coverage response rather than claiming setup completion', async () => {
    get.mockResolvedValue({ data: { ...makeOverview(), steps: [] } });
    await expect(setupApi.overview(scope)).rejects.toThrow();
  });
  it('checks document identity, immutable hash and accounting scope', async () => {
    const value = {
      ...detail,
      subject: {
        ...detail.subject,
        scope: {
          tenantId: scope.tenantId,
          legalEntityId: scope.legalEntityId,
          bookId: scope.bookId,
        },
      },
    };
    get.mockResolvedValueOnce({ data: value });
    await expect(setupApi.detail(scope, summary)).resolves.toMatchObject({
      id: summary.id,
    });
    get.mockResolvedValueOnce({
      data: { ...value, subject_hash: 'b'.repeat(64) },
    });
    await expect(setupApi.detail(scope, summary)).rejects.toThrow(
      'version or accounting book changed',
    );
  });
  it('sends only the exact scoped setup review and never an activation action', async () => {
    post.mockResolvedValue({ data: {} });
    await setupApi.decide(
      scope,
      summary,
      'REVIEW_INACTIVE',
      'Independent test review',
    );
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/setup/versions/' + summary.id + '/review',
      {
        scope: { legalEntityId: scope.legalEntityId, bookId: scope.bookId },
        subjectHash: summary.subjectHash,
        decision: 'REVIEW_INACTIVE',
        reason: 'Independent test review',
      },
    );
  });
});
