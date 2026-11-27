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
import type { CashData } from './cash-form';
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
function mount(
  view: string,
  prepare: boolean,
  changes: Partial<CashData> = {},
) {
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
                accountOpenings: '155000000',
                currencyExchange: '-2500',
                closing: '224997600',
                actualInflow: '0',
                actualOutflow: '0',
              },
            ],
            items: [],
            actual: [],
            periods: [],
          }
        : { ...data, ...changes },
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
  expect(
    screen.getByRole('columnheader', { name: 'New account balances' }),
  ).toBeInTheDocument();
  expect(screen.getByText('155,000,000')).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'Currency exchange' }),
  ).toBeInTheDocument();
  expect(screen.getByText('-2,500')).toBeInTheDocument();
  expect(screen.getByText('224,997,600')).toBeInTheDocument();
  expect(screen.getByText('CRDB Collections')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Submit for review' }),
  ).toBeNull();
});
it('prepares the exact shortage for the cashier’s current opening count', async () => {
  const till = uuid(51),
    count = uuid(52);
  const observation = {
    id: count,
    reference: 'OPEN-COUNT',
    day: data.today,
    cashier: user.id,
    code: 'HQ',
    expected: '400000',
    counted: '390000',
    opening_account_id: till,
    account_id: till,
    current_count: true,
  };
  const send = mount('cash-desk&action=SHORTAGE', true, {
    accounts: [
      {
        id: till,
        code: 'HQ',
        name: 'Head office till',
        kind: 'TILL',
        currency: 'TZS',
        active: true,
      },
    ],
    roles: [
      { code: 'CASH_SHORT', accountCode: '611009', accountType: 'EXPENSE' },
    ],
    counts: [
      observation,
      {
        ...observation,
        id: uuid(53),
        reference: 'Earlier count',
        current_count: false,
      },
    ],
  });
  fireEvent.change(await screen.findByLabelText('Account or till'), {
    target: { value: till },
  });
  expect(screen.queryByRole('option', { name: /Earlier count/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Physical count'), {
    target: { value: count },
  });
  expect(screen.getByLabelText('Amount')).toHaveValue('10000');
  fireEvent.change(screen.getByLabelText('Counterpart GL role'), {
    target: { value: 'CASH_SHORT' },
  });
  fireEvent.change(screen.getByLabelText('Document reference'), {
    target: { value: 'SHORT-01' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'SHORTAGE',
          fields: {
            account: till,
            target: count,
            role: 'CASH_SHORT',
            amount: '10000',
          },
        }),
      }),
    ),
  );
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

it('submits the selected entries for one combined bank debit', async () => {
  const line = uuid(30),
    entries = [
      {
        id: uuid(31),
        account_id: uuid(9),
        code: 'CRDB',
        reference: 'Cheque 1',
        amount: '-100000',
      },
      {
        id: uuid(32),
        account_id: uuid(9),
        code: 'CRDB',
        reference: 'Cheque 2',
        amount: '-200000',
      },
    ];
  const send = mount('statements-and-reconciliation&action=GROUP_MATCH', true, {
    entries,
    lines: [
      {
        id: line,
        reference: 'Batch payment',
        account_id: uuid(9),
        day: data.today,
        amount: '-300000',
      },
    ],
  });
  fireEvent.change(await screen.findByLabelText('Document reference'), {
    target: { value: 'MATCH-BATCH' },
  });
  fireEvent.change(screen.getByLabelText('Statement line'), {
    target: { value: line },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /Cheque 1/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Cheque 2/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'GROUP_MATCH',
          fields: { line, entries: entries.map((e) => e.id).join(',') },
        }),
      }),
    ),
  );
});
it('opens the original payable from a verified bank debit', async () => {
  const id = uuid(33),
    voucher = uuid(34);
  mount('payment-channels', true, {
    documents: [
      {
        id,
        kind: 'EFT',
        reference: 'WIRE-1',
        state: 'POSTED',
        maker_id: uuid(3),
        ap_voucher: voucher,
      },
    ],
    eftProofs: [{ id: uuid(35), eft_id: id, voucher_id: voucher }],
  });
  expect(
    await screen.findByRole('link', { name: 'Open payable voucher' }),
  ).toHaveAttribute('href', expect.stringContaining('voucher=' + voucher));
  expect(screen.queryByRole('button', { name: 'Export EFT file' })).toBeNull();
});

it('matches a deposit to split bank credits and shows the remaining amount', async () => {
  const entry = {
    id: uuid(41),
    account_id: uuid(9),
    reference: 'Deposit slip',
    code: 'CRDB',
    day: data.today,
    currency: 'TZS',
    amount: '25000',
    remaining_amount: '25000',
  };
  const lines = [
    { id: uuid(42), reference: 'Credit A', amount: '10000' },
    { id: uuid(43), reference: 'Credit B', amount: '15000' },
    { id: uuid(44), reference: 'Extra credit', amount: '1' },
    { id: uuid(45), reference: 'Bank debit', amount: '-1' },
    {
      id: uuid(46),
      reference: 'Reserved credit',
      amount: '1',
      proof_id: uuid(47),
    },
  ].map((l) => ({ ...l, account_id: entry.account_id, day: data.today }));
  const send = mount('statements-and-reconciliation&action=SPLIT_MATCH', true, {
    entries: [entry],
    lines,
  });
  fireEvent.change(await screen.findByLabelText('Document reference'), {
    target: { value: 'MATCH-SLIP' },
  });
  fireEvent.change(screen.getByLabelText('Cashbook entry'), {
    target: { value: entry.id },
  });
  expect(
    screen.queryByRole('checkbox', { name: /Bank debit|Reserved credit/ }),
  ).toBeNull();
  const submit = screen.getByRole('button', { name: 'Submit for review' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Credit A/ }));
  expect(
    screen.getByText('TZS 15,000 remaining after matching'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Credit B/ }));
  expect(
    screen.getByText('TZS 0 remaining after matching'),
  ).toBeInTheDocument();
  const extra = screen.getByRole('checkbox', { name: /Extra credit/ });
  fireEvent.click(extra);
  expect(submit).toBeDisabled();
  fireEvent.click(extra);
  fireEvent.click(submit);
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      '/tenant/finance/cash-bank',
      expect.objectContaining({
        input: expect.objectContaining({
          kind: 'SPLIT_MATCH',
          fields: { entry: entry.id, lines: [uuid(42), uuid(43)].join(',') },
        }),
      }),
    ),
  );
});
