import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { companiesKeys } from './query-keys';

export function useNumberFormatSettings() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: companiesKeys.numberFormat(),
    queryFn: companiesApi.getMyNumberFormat,
    enabled: user?.scope === 'company',
    staleTime: 5 * 60_000,
  });
}
