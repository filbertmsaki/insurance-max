import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ClaimsFxRatesPage } from '../pages/ClaimsFxRatesPage';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  permissions: new Set<string>(),
}));
vi.mock('@/modules/shared/api/client', () => ({
  apiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch },
}));
vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({
      user: { id: 'maker' },
      hasPermission: (permission: string) => mocks.permissions.has(permission),
    }),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ClaimsFxRatesPage />
    </QueryClientProvider>,
  );
}

describe('Claims FX rate management', () => {
  it('submits a draft to the API and keeps approval out of the maker view', async () => {
    mocks.permissions = new Set([
      'claims.fx.create',
      'claims.fx.submit',
      'claims.fx.approve',
    ]);
    mocks.get.mockResolvedValue({
      data: [
        {
          id: 'r1',
          transaction_currency: 'USD',
          functional_currency: 'TZS',
          rate: '2600',
          effective_date: '2025-01-01',
          source_reference: 'fixture',
          justification: 'test',
          status: 'SUBMITTED',
          created_by: 'maker',
          submitted_by: 'maker',
        },
      ],
    });
    mocks.post.mockResolvedValue({ data: {} });
    setup();
    expect(await screen.findByText(/USD → TZS/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    for (const [label, value] of [
      ['Transaction currency', 'USD'],
      ['Functional currency', 'TZS'],
      ['Rate (multiply)', '2600'],
      ['Effective date', '2025-01-01'],
      ['Source reference', 'fixture'],
      ['Justification', 'test'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/tenant/claims-fx/rates',
        expect.objectContaining({ rate: '2600', source_reference: 'fixture' }),
      ),
    );
  });
});
