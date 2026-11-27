import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { context, user, uuid } from '../foundation/__tests__/fixtures';
import { financeApi } from '../api';
import { FinanceManualInvoicePage } from './FinanceManualInvoicePage';

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(permissions: string[]) {
  useAuthStore.setState({
    user: { ...user, permissions },
    authorizationContext: { ...context, permissions },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <FinanceManualInvoicePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

it('creates one company fee draft with exact amounts for a creator without invoice browsing access', async () => {
  vi.spyOn(financeApi, 'manualInvoiceOptions').mockResolvedValue({
    ready: true,
    currency: 'TZS',
    scales: { TZS: 2 },
    terms: [],
  });
  vi.spyOn(financeApi, 'manualInvoiceCustomers').mockResolvedValue([
    { id: uuid(80), label: 'Example Transport', code: 'C01' },
  ]);
  const save = vi.spyOn(financeApi, 'createManualInvoice').mockResolvedValue({
    id: uuid(90),
    invoice_no: 'FEE-1',
    customer_id: uuid(80),
    status: 'DRAFT',
    total_amount: '0.30',
    paid_amount: '0',
    balance_amount: '0.30',
  });
  mount(['invoices:create-manual']);
  fireEvent.change(
    await screen.findByRole('searchbox', { name: 'Find customer' }),
    { target: { value: 'Example' } },
  );
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: /Example Transport/ },
      { timeout: 5000 },
    ),
  );
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Company fee' },
  });
  fireEvent.change(screen.getByLabelText('Quantity'), {
    target: { value: '3' },
  });
  fireEvent.change(screen.getByLabelText('Unit price (TZS)'), {
    target: { value: '0.001' },
  });
  expect(
    screen.getByRole('button', { name: 'Save draft invoice' }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Unit price (TZS)'), {
    target: { value: '0.10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft invoice' }));
  await waitFor(() => expect(screen.getByText('FEE-1')).toBeVisible());
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      insurer_company_id: user.companyId,
      customer_id: uuid(80),
      invoice_type: 'FEE',
      items: [expect.objectContaining({ total_amount: '0.30' })],
    }),
  );
  expect(screen.queryByRole('link', { name: 'Open invoice' })).toBeNull();
});

it('directs an authorized user to setup when the primary book is unavailable', async () => {
  vi.spyOn(financeApi, 'manualInvoiceOptions').mockResolvedValue({
    ready: false,
  });
  mount(['invoices:create-manual', 'finance-foundation:read']);
  expect(
    await screen.findByRole('link', { name: 'Accounting setup' }),
  ).toHaveAttribute('href', '/apps/finance/setup');
  expect(
    screen.queryByRole('button', { name: 'Save draft invoice' }),
  ).toBeNull();
});
