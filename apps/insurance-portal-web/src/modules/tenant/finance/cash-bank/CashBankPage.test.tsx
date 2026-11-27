import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { foundationReadApi } from '../foundation/api';
import { context, scope, user, uuid } from '../foundation/__tests__/fixtures';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { CashBankPage } from './CashBankPage';
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
const data = {
  today: '2026-02-28',
  currency: 'TZS',
  currencies: ['TZS', 'USD'],
  payables: [
    {
      id: uuid(22),
      reference: 'Supplier advance',
      account_id: uuid(9),
      currency: 'TZS',
      amount: '750',
    },
  ],
  masters: [],
  rules: [],
  roles: [{ code: 'BANK', accountCode: '112001', accountType: 'ASSET' }],
  dimensions: [],
  staff: [],
  evidence: [],
  accounts: [
    {
      id: uuid(9),
      code: 'CRDB',
      name: 'CRDB Collections',
      kind: 'BANK',
      currency: 'TZS',
      active: true,
    },
  ],
  documents: [],
  entries: [],
  lines: [],
  statements: [],
  cashiers: [],
  counts: [],
  transfers: [],
  shifts: [],
  cheques: [],
};
function mount(view: string, prepare: boolean) {
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
  vi.spyOn(apiClient, 'get').mockImplementation(async (path) => ({
    data: path.endsWith('cutover')
      ? { opening: '155000000', pendingReceipts: 0 }
      : path.endsWith('forecast')
        ? {
            totals: [
              {
                currency: 'TZS',
                opening: '100',
                inflow: '380000000',
                outflow: '310000000',
                net: '70000000',
                closing: '70000100',
                actualInflow: '0',
                actualOutflow: '0',
              },
            ],
            items: [],
            actual: [],
            periods: [],
          }
        : data,
  }));
  const send = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { reference: 'HQ', state: 'PENDING' } });
  render(
    <MemoryRouter initialEntries={['/apps/finance/cash-bank?view=' + view]}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <CashBankPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return send;
}
it('opens a specific setup task and sends the selected book and office details for review', async () => {
  const send = mount('bank-and-till-setup&action=BANK', true);
  fireEvent.change(await screen.findByLabelText('Code'), {
    target: { value: 'HQ' },
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'CRDB' },
  });
  fireEvent.change(screen.getByLabelText('Bank branch or operator'), {
    target: { value: 'Head Office' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
        input: expect.objectContaining({
          kind: 'BANK',
          fields: { name: 'CRDB', branchName: 'Head Office' },
          reference: 'HQ',
        }),
      }),
    ),
  );
});
it('offers treasury balances and forecasts to a reader', async () => {
  mount('treasury-and-forecasts', false);
  expect(await screen.findByText('70,000,000')).toBeInTheDocument();
  expect(screen.getByText('CRDB Collections')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Submit for review' }),
  ).toBeNull();
});

it('reads the certified GL amount for the selected account and fills the opening balance', async () => {
  mount('bank-and-till-setup&action=ACCOUNT', true);
  fireEvent.change(await screen.findByLabelText('Account GL role'), {
    target: { value: 'BANK' },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Use GL opening balance' }),
  );
  expect(screen.getByLabelText('Opening balance')).toHaveValue('155000000');
});
it('creates a linked EFT from the approved payable without re-entering its beneficiary or amount', async () => {
  const send = mount('payment-channels&action=EFT', true);
  fireEvent.change(await screen.findByLabelText('Account or till'), {
    target: { value: uuid(9) },
  });
  fireEvent.change(
    screen.getByLabelText('Approved payable voucher (optional)'),
    { target: { value: uuid(22) } },
  );
  expect(screen.queryByLabelText('Beneficiary account number')).toBeNull();
  fireEvent.change(screen.getByLabelText('Document reference'), {
    target: { value: 'WIRE-22' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'EFT',
          fields: { account: uuid(9), apVoucher: uuid(22) },
        }),
      }),
    ),
  );
});
it('uploads a statement and preserves bank-specific column mappings', async () => {
  const send = mount('statements-and-reconciliation&action=STATEMENT', true);
  fireEvent.change(await screen.findByLabelText('Account or till'), {
    target: { value: uuid(9) },
  });
  fireEvent.change(screen.getByLabelText('Document reference'), {
    target: { value: 'FEB-END' },
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Map bank columns or use an existing batch',
    }),
  );
  fireEvent.change(screen.getByLabelText('Reference column'), {
    target: { value: 'Bank ref' },
  });
  const csv = 'date,Bank ref,amount\n2026-02-28,WORKSHOP,-750';
  const file = new File([csv], 'statement.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => csv });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Bank CSV file'), {
      target: { files: [file] },
    });
  });
  fireEvent.change(screen.getByLabelText('Opening balance'), {
    target: { value: '750' },
  });
  fireEvent.change(screen.getByLabelText('Closing balance'), {
    target: { value: '0' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'STATEMENT',
          fields: expect.objectContaining({
            csv,
            referenceColumn: 'Bank ref',
            closing: '0',
          }),
        }),
      }),
    ),
  );
});
