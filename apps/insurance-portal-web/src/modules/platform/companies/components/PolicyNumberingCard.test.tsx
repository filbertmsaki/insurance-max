import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { PolicyNumberingCard } from './PolicyNumberingCard';

const status = {
  configuration: {
    prefix: 'P11',
    scope: 'INSURER',
    branch_start: 100,
    product_start: 1001,
    category_start: 10,
  },
  timezone: 'Africa/Dar_es_Salaam',
  sequence: { last_allocated: '9007199254740993', scope: 'INSURER' },
  codes: {
    branches: [
      {
        id: 'branch-1',
        name: 'HQ',
        code: 'BR207',
        policy_numbering_code: '100',
        locked: true,
        deleted_at: null,
      },
    ],
    products: [],
    categories: [],
  },
};
function setup(role: string, permissions: string[] = []) {
  useAuthStore.setState({
    user: { id: 'user-1', roles: [role], permissions, scope: 'platform' },
    authorizationContext: null,
  } as never);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <PolicyNumberingCard companyId="company-1" />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});

describe('Policy numbering administration', () => {
  it('shows the exact bigint status and disables locked codes', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: status });
    setup('OWNER');
    expect(await screen.findByText('9007199254740993')).toBeInTheDocument();
    expect(screen.getByLabelText('HQ (BR207) · Locked')).toBeDisabled();
    expect(screen.queryByLabelText('Sequence')).not.toBeInTheDocument();
  });
  it('saves configuration without any sequence reset control', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: status });
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} });
    setup('OWNER');
    fireEvent.change(await screen.findByLabelText('System prefix'), {
      target: { value: 'NEW' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save policy numbering' }),
    );
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/platform/companies/company-1/configs/policy_numbering',
        {
          config_value: { ...status.configuration, prefix: 'NEW' },
          value_type: 'json',
          is_active: true,
        },
      ),
    );
  });
  it('makes the panel read-only for readers', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: status });
    setup('READER', ['company-configs:read']);
    expect(await screen.findByLabelText('System prefix')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save policy numbering' }),
    ).toBeDisabled();
  });
  it('does not fetch numbering without permission', () => {
    const get = vi.spyOn(apiClient, 'get');
    setup('READER');
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Policy numbering')).not.toBeInTheDocument();
  });
});
