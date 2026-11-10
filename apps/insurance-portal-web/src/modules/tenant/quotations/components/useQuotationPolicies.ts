import { useQuery } from '@tanstack/react-query';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { motorInsurancePaths } from '@/modules/tenant/motor-insurance/paths';

/** Policies issued from a quotation (existing policy list API, filtered by quotation). */
export function useQuotationPolicies(
  quotationId: string,
  line: UnderwriteLineSlug,
  issuanceStatus?: string,
) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canView =
    hasPermission('policies:read') &&
    hasPermission(`underwrite.${line}.policies.view`);
  const query = useQuery({
    queryKey: ['quotation-issued-policies', line, quotationId, issuanceStatus],
    queryFn: ({ signal }) =>
      underwriteApi.getPolicies(
        line,
        { quotation_id: quotationId, limit: 100 },
        signal,
      ),
    enabled: canView && Boolean(quotationId),
    // A final callback updates quotation status before the issuance transaction
    // finishes. Keep polling until that policy becomes available.
    refetchInterval: (q) =>
      issuanceStatus === 'SUCCESS' &&
      q.state.status !== 'error' &&
      !q.state.data?.data.length
        ? 5000
        : false,
  });
  const policyHref = (id: string) =>
    line === 'motor' || line === 'fleet'
      ? motorInsurancePaths.policyDetail(id)
      : underwritePaths.policyDetail(line, id);
  return { canView, query, policies: query.data?.data, policyHref };
}
