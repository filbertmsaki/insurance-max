import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { companiesKeys } from './query-keys';

/** Fetches the authenticated user's company. Disabled for platform-scope (OWNER) users. */
export function useMyCompany() {
  const user = useAuthStore((s) => s.user);
  const isCompanyScoped = user?.scope === 'company';

  return useQuery({
    queryKey: companiesKeys.myCompany(),
    queryFn: companiesApi.getMyCompany,
    enabled: isCompanyScoped,
    staleTime: 60_000,
  });
}
