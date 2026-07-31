import { describe, expect, it, vi } from 'vitest';

const { post, get } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/modules/shared/api/client', () => ({
  apiClient: {
    post,
    get,
  },
}));

import { pricingApi } from './pricing';

describe('pricingApi', () => {
  it('posts single-risk calculation requests to the pricing endpoint', async () => {
    post.mockResolvedValueOnce({
      data: { pricing_quote_id: 'PQ-2026-00000100' },
    });

    const payload = {
      risk_id: 'risk-1',
      sum_insured: 1000000,
      factors: { vehicle_type: 'PRIVATE' },
    };

    const result = await pricingApi.calculateSingle(payload);

    expect(post).toHaveBeenCalledWith('/premium-calculation/single', payload);
    expect(result).toEqual({ pricing_quote_id: 'PQ-2026-00000100' });
  });

  it('posts multi-risk fleet calculation requests to the batch endpoint', async () => {
    post.mockResolvedValueOnce({
      data: { pricing_quote_id: 'PQ-2026-00000101', risks: [] },
    });

    const payload = {
      quotation_type: 'MOTOR',
      currency_code: 'TZS',
      risks: [
        {
          client_reference: 'VEHICLE-001',
          risk_id: 'risk-1',
          sum_insured: 1000000,
          factors: { seating_capacity: 14 },
        },
      ],
    };

    const result = await pricingApi.calculateMulti(payload);

    expect(post).toHaveBeenCalledWith('/premium-calculation/multi', payload);
    expect(result).toEqual({ pricing_quote_id: 'PQ-2026-00000101', risks: [] });
  });

  it('requests pricing explanations from the explain endpoint', async () => {
    get.mockResolvedValueOnce({
      data: { rule_id: 'rule-1', rule_name: 'Base rate' },
    });

    const result = await pricingApi.explainRisk('risk-77');

    expect(get).toHaveBeenCalledWith('/premium-calculation/explain/risk-77');
    expect(result).toEqual({ rule_id: 'rule-1', rule_name: 'Base rate' });
  });
});
