import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi } from '../foundation/api';
import { context, scope, user, uuid } from '../foundation/__tests__/fixtures';
import { AccountsReceivablePage } from './AccountsReceivablePage';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
const invoice = {
  id: uuid(81),
  label: 'INV-FLEET',
  customer_id: uuid(80),
  currency: 'TZS',
  invoice_type: 'PREMIUM',
  status: 'PARTIALLY_PAID',
  total_amount: '15000000',
  paid_amount: '10000000',
  balance_amount: '5000000',
};
function mount(permissions: string[]) {
  useAuthStore.setState({
    user,
    authorizationContext: { ...context, permissions },
  });
  vi.spyOn(foundationReadApi, 'scopes').mockResolvedValue([scope]);
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      customers: [{ id: uuid(80), label: 'ABC Transport' }],
      invoices: [invoice],
      currencies: ['TZS'],
      documents: [],
      evidence: [],
      cases: [],
      receipts: [],
      terms: [],
      staff: [],
      refunds: [],
      reminders: [],
      roles: [],
      dimensions: [],
      today: '2026-11-26',
    },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <AccountsReceivablePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
it('shows paid and outstanding amounts to a reader and opens the originating invoice', async () => {
  mount(['finance-foundation:read']);
  expect((await screen.findByText('INV-FLEET')).getAttribute('href')).toBe(
    '/apps/finance/invoices/' + invoice.id,
  );
  expect(screen.getByText('5000000')).toBeTruthy();
  expect(screen.getByText('10000000')).toBeTruthy();
  expect(screen.queryByText('New document')).toBeNull();
});
it('imports the external reference, dates and exact decimal amount from CSV for review', async () => {
  mount(['finance-foundation:read', 'finance-foundation:prepare']);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(await screen.findByRole('button', { name: 'New document' }));
  fireEvent.change(screen.getByLabelText('Document type'), {
    target: { value: 'OPENING_IMPORT' },
  });
  const file = new File([], 'opening.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      'customerCode,reference,invoiceDate,dueDate,amount\nC01,"OLD,01",2026-01-01,2026-02-01,70.25',
  });
  fireEvent.change(screen.getByLabelText('Opening invoice CSV'), {
    target: { files: [file] },
  });
  await screen.findByText('1 invoice ready for review');
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit for independent review' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/customer-accounts/opening-imports',
      expect.objectContaining({
        input: expect.objectContaining({
          openingItems: [
            {
              customerCode: 'C01',
              reference: 'OLD,01',
              invoiceDate: '2026-01-01',
              dueDate: '2026-02-01',
              amount: '70.25',
            },
          ],
        }),
      }),
    ),
  );
});
it('submits a category to independent review in the selected book', async () => {
  mount(['finance-foundation:read', 'finance-foundation:prepare']);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  fireEvent.click(await screen.findByRole('button', { name: 'New document' }));
  fireEvent.change(screen.getByLabelText('Source reference or category name'), {
    target: { value: 'Bancassurance' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit for independent review' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/tenant/finance/customer-accounts', {
      scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
      input: expect.objectContaining({
        kind: 'CATEGORY',
        reference: 'Bancassurance',
        currency: 'TZS',
      }),
    }),
  );
});
