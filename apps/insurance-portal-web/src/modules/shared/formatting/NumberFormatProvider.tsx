import { type ReactNode, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { companiesApi } from '@/modules/platform/companies/api/companies';
import { companiesKeys } from '@/modules/platform/companies/hooks/query-keys';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  normalizeNumberFormatSettings,
  setActiveNumberFormatSettings,
} from './number-format';
import { NumberFormatContext } from './number-format-context';

export function NumberFormatProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const enabled = user?.scope === 'company';

  const query = useQuery({
    queryKey: companiesKeys.numberFormat(),
    queryFn: companiesApi.getMyNumberFormat,
    enabled,
    staleTime: 5 * 60_000,
  });

  const settings = useMemo(
    () =>
      enabled
        ? normalizeNumberFormatSettings(query.data)
        : DEFAULT_NUMBER_FORMAT_SETTINGS,
    [enabled, query.data],
  );

  useEffect(() => {
    setActiveNumberFormatSettings(settings);
  }, [settings]);

  return (
    <NumberFormatContext.Provider value={settings}>
      {children}
    </NumberFormatContext.Provider>
  );
}
