import { type ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { companiesApi } from '@/modules/platform/companies/api/companies';
import { companiesKeys } from '@/modules/platform/companies/hooks/query-keys';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  setActiveNumberFormatSettings,
} from './number-format';

export function NumberFormatProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const enabled = user?.scope === 'company';

  const query = useQuery({
    queryKey: companiesKeys.numberFormat(),
    queryFn: companiesApi.getMyNumberFormat,
    enabled,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!enabled) {
      setActiveNumberFormatSettings(DEFAULT_NUMBER_FORMAT_SETTINGS);
      return;
    }

    if (query.data) {
      setActiveNumberFormatSettings(query.data);
    }
  }, [enabled, query.data]);

  return <>{children}</>;
}
