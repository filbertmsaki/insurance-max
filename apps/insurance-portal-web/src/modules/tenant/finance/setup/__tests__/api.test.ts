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
  it('activates only the selected book and exact setup and release versions', async () => {
    const final = {
      id: uuid(54),
      step: 'G04-10',
      version: 1,
      subjectHash: 'a'.repeat(64),
      state: 'REVIEWED_INACTIVE' as const,
      makerSubjectId: uuid(51),
      makerNaturalPersonId: uuid(52),
    };
    const release = { id: uuid(55), hash: 'b'.repeat(64) };
    await setupApi.activateBook(scope, final, release, 'Approved cutover');
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/setup/operating/activate',
      {
        scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
        setupId: final.id,
        setupHash: final.subjectHash,
        releaseId: release.id,
        releaseHash: release.hash,
        reason: 'Approved cutover',
      },
    );
  });
  it('preserves product category information in the scoped overview', async () => {
    const data = makeOverview();
    const category = {
      product_id: uuid(51),
      category_id: uuid(52),
      category_name: 'Motor',
    };
    get.mockResolvedValueOnce({
      data: {
        ...data,
        inventory: { ...data.inventory, productCategories: [category] },
      },
    });
    const overview = await setupApi.overview(scope);
    expect(overview.inventory.productCategories).toEqual([category]);
  });
  it('rejects allocation evidence from another book or with posting enabled', async () => {
    const preview = {
      id: uuid(80),
      subject_hash: 'a'.repeat(64),
      occurrence_date: '2026-11-15',
      review_id: null,
      payload: {
        ...scope,
        postingAuthorized: false,
        amountMinor: '100',
        currency: 'USD',
        decimalScale: 2,
        lines: [],
      },
    };
    get.mockResolvedValueOnce({
      data: { postingAuthorized: false, previews: [preview] },
    });
    await expect(setupApi.allocationPreviews(scope)).resolves.toHaveLength(1);
    get.mockResolvedValueOnce({
      data: {
        postingAuthorized: false,
        previews: [
          { ...preview, payload: { ...preview.payload, bookId: uuid(99) } },
        ],
      },
    });
    await expect(setupApi.allocationPreviews(scope)).rejects.toThrow(
      'selected book',
    );
    get.mockResolvedValueOnce({
      data: { postingAuthorized: true, previews: [] },
    });
    await expect(setupApi.allocationPreviews(scope)).rejects.toThrow();
  });
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
