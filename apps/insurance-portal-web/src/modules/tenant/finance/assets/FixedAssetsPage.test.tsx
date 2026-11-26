import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { foundationReadApi } from '../foundation/api';
import { context, scope, user, uuid } from '../foundation/__tests__/fixtures';
import { FixedAssetsPage } from './FixedAssetsPage';
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
const evidence = {
  id: uuid(90),
  documentId: uuid(91),
  hash: 'a'.repeat(64),
  title: 'Asset invoice',
};
function mount(prepare: boolean) {
  useAuthStore.setState({
    user,
    authorizationContext: {
      ...context,
      permissions: [
        'finance-foundation:read',
        ...(prepare ? ['finance-foundation:prepare'] : []),
      ],
    },
  });
  vi.spyOn(foundationReadApi, 'scopes').mockResolvedValue([scope]);
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      today: '2026-11-26',
      scale: 2,
      currency: 'TZS',
      roles: [],
      dimensions: [],
      evidence: [evidence],
      documents: [],
      sources: [],
      staff: [],
      depreciation: [],
      assets: [
        {
          code: 'AST-000001',
          name: 'Lenovo Laptop',
          category: 'PC',
          group: 'IT',
          serial: '',
          location: 'HQ',
          status: 'ACTIVE',
          cost: '1200000',
          accumulated: '25000',
          impairment: '0',
        },
      ],
    },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <FixedAssetsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
it('shows the carrying amount and the monthly laptop example for a reader', async () => {
  mount(false);
  expect(await screen.findByText('Lenovo Laptop')).toBeDefined();
  expect(screen.getByText('1,175,000')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'New document' })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Depreciation' }),
  );
  expect(screen.getByText(/Annual depreciation/).textContent).toContain(
    '300,000',
  );
  expect(screen.getByText(/Annual depreciation/).textContent).toContain(
    '25,000',
  );
});
it('submits a scoped group with linked evidence for independent review', async () => {
  mount(true);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(await screen.findByRole('button', { name: 'Setup' }));
  fireEvent.click(screen.getByRole('button', { name: 'New group' }));
  fireEvent.change(screen.getByLabelText('Setup code'), {
    target: { value: 'IT' },
  });
  fireEvent.change(screen.getByLabelText('Name', { exact: true }), {
    target: { value: 'IT equipment' },
  });
  fireEvent.change(screen.getByLabelText('Source reference'), {
    target: { value: 'Board approval' },
  });
  fireEvent.change(screen.getByLabelText('Supporting document version'), {
    target: { value: evidence.id },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit for independent review' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/tenant/finance/fixed-assets', {
      scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
      input: expect.objectContaining({
        kind: 'GROUP',
        code: 'IT',
        name: 'IT equipment',
        evidence: {
          id: evidence.id,
          documentId: evidence.documentId,
          hash: evidence.hash,
        },
      }),
    }),
  );
});
