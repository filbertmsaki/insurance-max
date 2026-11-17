import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi } from '../api';
import { scope, summary, document, uuid } from './fixtures';

vi.mock('@/modules/shared/api/client', () => ({ apiClient: { get: vi.fn() } }));
const get = vi.mocked(apiClient.get);
beforeEach(() => vi.clearAllMocks());

describe('Finance foundation read adapter', () => {
  it('requires a date-range export to match the selected book', async () => {
    const query = {
      mode: 'VALIDATION' as const,
      from: '2026-01-01',
      to: '2026-12-31',
    };
    const evidence = {
      schema: 'FINANCE_JOURNAL_EXPORT_V1',
      tenantId: scope.tenantId,
      legalEntityId: scope.legalEntityId,
      bookId: scope.bookId,
      ...query,
      journals: [],
      evidenceHash: 'a'.repeat(64),
    };
    get
      .mockResolvedValueOnce({ data: evidence })
      .mockResolvedValueOnce({ data: { ...evidence, bookId: uuid(99) } });
    await expect(
      foundationReadApi.exportJournals(scope, query),
    ).resolves.toEqual(evidence);
    await expect(
      foundationReadApi.exportJournals(scope, query),
    ).rejects.toThrow('does not match');
  });
  it('rejects journal results from the wrong population and invalid cursors', async () => {
    const search = {
      mode: 'VALIDATION' as const,
      from: '2026-01-01',
      to: '2026-12-31',
    };
    const journal = {
      id: uuid(12),
      accountingDate: '2026-02-01',
      transactionDate: '2026-02-01',
      transactionCurrency: 'USD',
      functionalCurrency: 'TZS',
      kind: 'ORIGINAL',
      reversalOf: null,
      subjectHash: 'a'.repeat(64),
      financialEffects: 0,
    };
    get
      .mockResolvedValueOnce({
        data: {
          journals: [journal],
          mode: 'VALIDATION',
          hasMore: false,
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          journals: [{ ...journal, financialEffects: 1 }],
          mode: 'VALIDATION',
          hasMore: false,
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          journals: [],
          mode: 'VALIDATION',
          hasMore: true,
          nextCursor: null,
        },
      });
    await expect(
      foundationReadApi.journals(scope, search),
    ).resolves.toMatchObject({ journals: [journal] });
    await expect(foundationReadApi.journals(scope, search)).rejects.toThrow();
    await expect(foundationReadApi.journals(scope, search)).rejects.toThrow();
    expect(get.mock.calls[0][1]?.params).toMatchObject({
      legalEntityId: scope.legalEntityId,
      bookId: scope.bookId,
      limit: 50,
    });
  });
  it('validates readiness scope and exact reviewed context', async () => {
    const reviewed = { ...summary, state: 'REVIEWED' as const };
    const response = {
      scope: {
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        bookId: scope.bookId,
      },
      contextId: reviewed.id,
      contextHash: reviewed.subject_hash,
      acceptanceScope: 'FOUNDATION_ONLY',
      overallFinanceProductionAccepted: false,
      technicalAcceptance: false,
      productionEligible: false,
      blockers: ['HELD'],
      policyActivation: false,
      financialEffects: 0,
    };
    get.mockResolvedValueOnce({ data: response }).mockResolvedValueOnce({
      data: { ...response, scope: { ...response.scope, bookId: uuid(99) } },
    });
    await expect(foundationReadApi.readiness(scope, reviewed)).resolves.toEqual(
      response,
    );
    await expect(foundationReadApi.readiness(scope, reviewed)).rejects.toThrow(
      'does not match',
    );
    await expect(foundationReadApi.readiness(scope, summary)).rejects.toThrow(
      'reviewed currency context',
    );
  });
  it('rejects contradictory readiness results', async () => {
    const reviewed = { ...summary, state: 'REVIEWED' as const };
    get.mockResolvedValue({
      data: {
        scope: {
          tenantId: scope.tenantId,
          legalEntityId: scope.legalEntityId,
          bookId: scope.bookId,
        },
        contextId: reviewed.id,
        contextHash: reviewed.subject_hash,
        acceptanceScope: 'FOUNDATION_ONLY',
        overallFinanceProductionAccepted: false,
        technicalAcceptance: false,
        productionEligible: true,
        blockers: ['BLOCKED'],
        policyActivation: false,
        financialEffects: 0,
      },
    });
    await expect(foundationReadApi.readiness(scope, reviewed)).rejects.toThrow(
      'inconsistent',
    );
  });
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
