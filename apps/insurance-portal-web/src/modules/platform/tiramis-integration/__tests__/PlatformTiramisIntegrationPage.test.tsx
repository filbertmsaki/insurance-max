import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseApiError } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import { tiramisIntegrationApi, type TiramisIntegrationOverview } from '../api';
import { PlatformTiramisIntegrationPage } from '../pages/PlatformTiramisIntegrationPage';

const overview: TiramisIntegrationOverview = {
  activeEnvironment: 'uat',
  environmentSwitchedAt: null,
  integrationPermissions: ['submit'],
  environment: {
    name: 'uat',
    validationStatus: 'VALID',
    validatedAt: null,
    serviceApiKeyConfigured: true,
    pendingSubmissions: 4,
  },
  profile: { error: 'unavailable' },
  companies: { ACTIVE: 3, REVOKED: 1 },
};

function renderPage(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'owner-1',
      email: 'owner@example.com',
      scope: 'platform',
      userType: 'PLATFORM_USER',
      companyId: null,
      roles: ['OWNER'],
      permissions,
    },
    authorizationContext: null,
  } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlatformTiramisIntegrationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});

describe('PlatformTiramisIntegrationPage', () => {
  it('renders the overview from the platform API', async () => {
    vi.spyOn(tiramisIntegrationApi, 'getOverview').mockResolvedValue(overview);

    renderPage(['platform:tiramis-integration:read']);

    expect(await screen.findByText('Active: UAT')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(tiramisIntegrationApi.getOverview).toHaveBeenCalledTimes(1);
  });
});

describe('TIRAMIS friendly API errors', () => {
  function apiError(code: string, details?: Record<string, unknown>) {
    return new AxiosError('fail', 'ERR', undefined, undefined, {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        success: false,
        error: { code, message: 'raw', details: details ?? null },
        meta: { requestId: 'r', timestamp: new Date().toISOString() },
      },
    });
  }

  it('maps revoked access to a friendly message', () => {
    expect(parseApiError(apiError('TIRAMIS_ACCESS_REVOKED')).message).toMatch(
      /revoked by the platform owner/,
    );
  });

  it('maps readiness requirements', () => {
    const message = parseApiError(
      apiError('ORGANIZATION_NOT_TIRAMIS_READY', {
        missingRequirements: ['TIRAMIS_ACCESS_NOT_LINKED'],
      }),
    ).message;
    expect(message).toMatch(/not linked to TIRA/);
  });
});
