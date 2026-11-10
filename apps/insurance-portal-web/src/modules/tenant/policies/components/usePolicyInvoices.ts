import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { financeTableApi } from '@/modules/tenant/finance/api';

/** Invoices raised for a policy (finance list filtered by policy_id). */
export function usePolicyInvoices(policyId: string) {
  const canRead = useAuthStore((s) => s.hasPermission('invoices:read'));
  const query = useQuery({
    queryKey: ['finance', 'invoices', 'policy', policyId],
    queryFn: ({ signal }) =>
      financeTableApi.invoices({ policy_id: policyId, limit: 20 }, signal),
    enabled: canRead && Boolean(policyId),
    staleTime: 30_000,
  });
  return { canRead, invoices: query.data?.data ?? [], query };
}
