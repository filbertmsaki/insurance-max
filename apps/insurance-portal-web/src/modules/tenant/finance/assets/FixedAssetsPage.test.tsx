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
      documents: [
        {
          state: 'POSTED',
          effective_date: '2026-11-26',
          code: 'AST-000002',
          plan: {
            asset: {
              code: 'AST-000002',
              category: 'PC',
              status: 'ACTIVE',
              name: 'Late laptop',
              policy: { method: 'STRAIGHT_LINE', life: 1, rate: '0' },
              end: '2026-11-01',
              cost: '100000',
              accumulated: '0',
              impairment: '0',
            },
          },
        },
      ],
      sources: [],
      staff: [],
      depreciation: [],
      valuations: [
        {
          reference: 'Annual PCs',
          run_id: uuid(92),
          missing: ['AST-000002'],
          category: 'PC',
          effective_date: '2026-11-26',
          state: 'PARTIAL',
          total: 2,
          posted: 1,
          outstanding: ['AST-000002'],
        },
      ],
      assets: [
        {
          code: 'AST-000001',
          name: 'Lenovo Laptop',
          policy: { method: 'STRAIGHT_LINE', life: 12, rate: '0' },
          lease: {
            ownershipBasis: 'TITLE_TRANSFER',
            liability: '0',
            schedule: [],
            index: 0,
          },
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
  fireEvent.click(screen.getByRole('button', { name: 'Depreciation' }));
  expect(screen.getByText(/Annual depreciation/).textContent).toContain(
    '300,000',
  );
  expect(screen.getByText(/Annual depreciation/).textContent).toContain(
    '25,000',
  );
});
it('shows the outstanding class valuation members to a read-only reviewer', async () => {
  mount(false);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Class revaluation' }),
  );
  expect(screen.getByText('PARTIAL')).toBeInTheDocument();
  expect(screen.getByText('AST-000002')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Prepare class valuation' }),
  ).toBeNull();
});
it('prepares only the uncovered asset for independent class valuation review', async () => {
  mount(true);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Class revaluation' }),
  );
  fireEvent.change(screen.getByLabelText('Valuation to prepare'), {
    target: { value: uuid(92) },
  });
  fireEvent.change(screen.getByLabelText('Uncovered asset'), {
    target: { value: 'AST-000002' },
  });
  fireEvent.change(screen.getByLabelText(/Late laptop/), {
    target: { value: '110000' },
  });
  fireEvent.change(screen.getByLabelText(/Revised remaining life/), {
    target: { value: '5' },
  });
  fireEvent.change(screen.getByLabelText(/Revised residual value/), {
    target: { value: '0' },
  });
  fireEvent.change(screen.getByLabelText('Supporting document version'), {
    target: { value: evidence.id },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Prepare supplemental valuation' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/fixed-assets',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'REVALUE',
          code: 'AST-000002',
          valuationRunId: uuid(92),
          reference: 'Annual PCs',
          amount: '110000',
          life: 5,
          residual: '0',
          date: '2026-11-26',
        }),
      }),
    ),
  );
});
it('submits a settled lease handover with the title evidence', async () => {
  mount(true);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(await screen.findByRole('button', { name: 'New document' }));
  fireEvent.change(screen.getByLabelText('Operation'), {
    target: { value: 'LEASE_TAKE_OWNERSHIP' },
  });
  fireEvent.change(screen.getByLabelText('Asset', { exact: true }), {
    target: { value: 'AST-000001' },
  });
  fireEvent.change(screen.getByLabelText('Source reference'), {
    target: { value: 'Signed title' },
  });
  fireEvent.change(
    screen.getByLabelText(
      'Evidence of title transfer or purchase option exercise',
    ),
    { target: { value: 'Title lodged with Finance' } },
  );
  fireEvent.change(screen.getByLabelText('Supporting document version'), {
    target: { value: evidence.id },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit for independent review' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/fixed-assets',
      expect.objectContaining({
        input: expect.objectContaining({
          code: 'AST-000001',
          kind: 'LEASE_TAKE_OWNERSHIP',
          note: 'Title lodged with Finance',
          evidence: expect.objectContaining({ id: evidence.id }),
        }),
      }),
    ),
  );
});
it('accepts an owned opening life and distinguishes single and separate branch clearing', async () => {
  mount(true);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(await screen.findByRole('button', { name: 'New document' }));
  const operation = screen.getByLabelText('Operation');
  fireEvent.change(operation, { target: { value: 'CATEGORY' } });
  const clearing = screen.getByLabelText('Inter-branch clearing');
  fireEvent.change(clearing, { target: { value: 'SEPARATE' } });
  expect(screen.getByLabelText('Inter-branch due to')).toBeInTheDocument();
  fireEvent.change(clearing, { target: { value: 'SINGLE' } });
  expect(screen.queryByLabelText('Inter-branch due to')).toBeNull();
  expect(
    screen.getByLabelText('Inter-branch clearing account'),
  ).toBeInTheDocument();
  fireEvent.change(operation, { target: { value: 'OPENING' } });
  fireEvent.change(screen.getByLabelText('New asset code'), {
    target: { value: 'OWN-1' },
  });
  fireEvent.change(screen.getByLabelText('Source reference'), {
    target: { value: 'Opening register' },
  });
  fireEvent.change(screen.getByLabelText(/Original useful life/), {
    target: { value: '120' },
  });
  fireEvent.change(screen.getByLabelText('Supporting document version'), {
    target: { value: evidence.id },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit for independent review' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/fixed-assets',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'OPENING',
          life: 120,
          code: 'OWN-1',
        }),
      }),
    ),
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
