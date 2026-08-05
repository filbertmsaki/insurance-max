import { apiClient } from '@/modules/shared/api/client';
import type { OrganizationContext } from '../types';

export const organizationApi = {
  getContext: () =>
    apiClient
      .get<OrganizationContext>('/organization/context')
      .then((r) => r.data),

  getTiramisReadiness: () =>
    apiClient
      .get<{
        ready: boolean;
        missingRequirements: string[];
      }>('/organization/tiramis-readiness')
      .then((r) => r.data),
};
