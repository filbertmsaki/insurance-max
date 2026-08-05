import type { AuthorizationContext } from '@insurance-max/contracts';

import { apiClient } from '@/modules/shared/api/client';

export const authorizationApi = {
  getContext: () =>
    apiClient
      .get<AuthorizationContext>('/auth/authorization-context')
      .then((response) => response.data),
};
