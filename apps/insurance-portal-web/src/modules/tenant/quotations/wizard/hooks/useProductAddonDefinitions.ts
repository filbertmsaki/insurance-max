import { useQuery } from '@tanstack/react-query';
import { productDefinitionsApi } from '@/modules/tenant/product-engine/api/product-definitions';

/**
 * Real, product-configured add-on covers (e.g. windscreen, radio) for the
 * quotation's selected product — sourced from the same published product
 * definition the admin Product Detail page uses, gated by
 * product-definitions:use (already granted to quotation-issuing roles).
 */
export function useProductAddonDefinitions(productId: string | undefined) {
  return useQuery({
    queryKey: ['quotations', 'product-addon-definitions', productId || 'none'],
    queryFn: () => productDefinitionsApi.publishedDefinition(productId!),
    select: (data) => data.addons,
    enabled: !!productId,
    staleTime: 60_000,
  });
}
