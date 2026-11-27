import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi } from '../foundation/api';
import { context, scope, user, uuid } from '../foundation/__tests__/fixtures';
import { AccountsPayablePage } from './AccountsPayablePage';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
const common = {
  terms: [],
  staff: [],
  currencies: { TZS: 2 },
  functionalCurrency: 'TZS',
  roles: [],
  dimensions: [],
  documents: [],
};
function mount(employee = false) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <AccountsPayablePage employee={employee} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
it('submits an independently reviewed bill to the book selected in the portal', async () => {
  useAuthStore.setState({
    user,
    authorizationContext: {
      ...context,
      permissions: ['finance-foundation:read', 'finance-foundation:prepare'],
    },
  });
  vi.spyOn(foundationReadApi, 'scopes').mockResolvedValue([scope]);
  const bill = {
    id: uuid(88),
    kind: 'BILL',
    reference: 'ABC-INV-2026-001',
    sequence: '1',
    status: 'APPROVED',
    state: 'APPROVED',
    doc_date: '2026-11-25',
    party: 'S:' + uuid(86),
    currency: 'TZS',
    amount: '12000000',
    data: {
      details: { description: 'Laptop equipment' },
      lines: [{ role: 'COMPUTERS', debit: '12000000', credit: '0' }],
    },
  };
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    data: url.endsWith('/payables') ? { ...common, records: [bill] } : common,
  }));
  const send = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { ...bill, status: 'AWAITING_GL' } });
  mount();
  fireEvent.click(
    await screen.findByRole('button', { name: 'ABC-INV-2026-001' }),
  );
  expect(screen.queryByRole('button', { name: /^Approve$/ })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit journal for approval' }),
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/payables/' + bill.id + '/post',
      { scope: { legalEntityId: scope.legalEntityId, bookId: scope.bookId } },
    ),
  );
});
it('opens the employee register without fetching company-wide finance records', async () => {
  useAuthStore.setState({
    user,
    authorizationContext: { ...context, permissions: [] },
  });
  const books = vi.spyOn(foundationReadApi, 'scopes');
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ data: { ...common, records: [] } });
  mount(true);
  await screen.findByText('No accounts payable documents yet.');
  expect(books).not.toHaveBeenCalled();
  expect(get.mock.calls.map((c) => c[0])).toEqual([
    '/tenant/finance/payables/my-expenses',
  ]);
  expect(screen.queryByRole('button', { name: 'GL approvals' })).toBeNull();
});
