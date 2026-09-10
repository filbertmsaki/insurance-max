import { useQuery } from '@tanstack/react-query';
import { taxesApi } from '@/modules/tenant/taxes/api';
import type { ActiveTaxRule } from '../utils/taxOptions';

// Compatibility adapter for the add-on tax selector. Definitions come only
// from the tax catalogue; no product tax rules participate in selection.
export function useActiveTaxRules(companyId: string | undefined) {
  return useQuery({
    queryKey: ['taxes', companyId, 'addon-options'],
    queryFn: async (): Promise<ActiveTaxRule[]> =>
      (await taxesApi.active()).map((tax) => ({
        ...tax,
        charge_category: 'TAX',
        tax_type: 'PERCENTAGE',
        category_id: null,
        product_id: null,
        risk_id: null,
        effective_from: '0001-01-01',
        effective_to: '9999-12-31',
      })),
    enabled: !!companyId,
    staleTime: 30_000,
  });
}
