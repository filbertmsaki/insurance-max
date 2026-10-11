import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked so the test never loads the persisted auth store (see handoff gotchas).
const calls: Array<{ method: string; url: string; body?: unknown }> = [];
vi.mock('@/modules/shared/api/client', () => {
  const record = (method: string) => (url: string, body?: unknown) => {
    calls.push({ method, url, body });
    return Promise.resolve({ data: { id: 'x' } });
  };
  return {
    apiClient: {
      get: record('get'),
      post: record('post'),
      put: record('put'),
      patch: record('patch'),
      delete: record('delete'),
    },
  };
});

const { buildUnderwriteTransactionScope } =
  await import('../transaction-scope');
const { underwriteSlugFromPath } = await import('../hooks');
const { legacyPolicyTransactionScope } =
  await import('@/modules/tenant/policies/transaction-scope');

describe('underwrite transaction scope', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('sends transaction writes to the line-scoped endpoints', async () => {
    const { api } = buildUnderwriteTransactionScope('fleet');

    await api.createEndorsement('p1', {} as never);
    await api.approveEndorsement('e1');
    await api.withdrawCancellation('c1', 'no longer needed');
    await api.acceptRenewal('r1');

    expect(calls.map((call) => call.url)).toEqual([
      '/tenant/underwrite/fleet/policies/p1/endorsements',
      '/tenant/underwrite/fleet/endorsements/e1/approve',
      '/tenant/underwrite/fleet/cancellations/c1/cancel',
      '/tenant/underwrite/fleet/renewals/r1/accept',
    ]);
    expect(calls[2].body).toEqual({ reason: 'no longer needed' });
  });

  it('keeps calls without a line endpoint on the legacy API', () => {
    const { api } = buildUnderwriteTransactionScope('motor');

    expect(api.getEndorsementTypes).toBe(
      legacyPolicyTransactionScope.api.getEndorsementTypes,
    );
    expect(api.reviewCancellationClaims).toBe(
      legacyPolicyTransactionScope.api.reviewCancellationClaims,
    );
  });

  it('links to the line routes', () => {
    const { paths } = buildUnderwriteTransactionScope('non-motor');

    expect(paths.policyDetail('p1')).toBe('/underwrite/non-motor/policies/p1');
    expect(paths.policyEndorsementEdit('p1', 'e1')).toBe(
      '/underwrite/non-motor/policies/p1/endorsements/e1',
    );
    expect(paths.quotationWizardEdit('q1')).toBe(
      '/underwrite/non-motor/quotations/q1/edit',
    );
  });

  it('defaults shared policy navigation to the Motor underwrite line', () => {
    expect(legacyPolicyTransactionScope.paths.policyDetail('p1')).toBe(
      '/underwrite/motor/policies/p1',
    );
  });

  it('reads the line from static routes that have no :line param', () => {
    expect(underwriteSlugFromPath('/underwrite/fleet/policies/p1')).toBe(
      'fleet',
    );
    expect(underwriteSlugFromPath('/underwrite/motor/policies/p1')).toBe(
      'motor',
    );
  });
});
