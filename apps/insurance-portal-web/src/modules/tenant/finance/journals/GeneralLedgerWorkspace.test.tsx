import { afterEach, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi } from '../foundation/api';
import { scope, user, context, uuid } from '../foundation/__tests__/fixtures';
import { GeneralLedgerWorkspace } from './GeneralLedgerWorkspace';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
const setup = (prepare: boolean, insurer = false) => {
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
  const workspace = {
    insuranceMeasurements: insurer,
    functionalCurrency: 'TZS',
    currencies: { TZS: 2 },
    accounts: [
      { code: '611004', name: 'Internet Expense', posting: true },
      { code: '112001', name: 'CRDB Bank', posting: true },
    ],
    roles: [
      { code: 'NET', accountCode: '611004' },
      { code: 'BANK', accountCode: '112001' },
    ],
    components: [],
    dimensions: [
      {
        code: 'BRANCH',
        label: 'Branch',
        options: [{ value: uuid(80), label: 'Dar es Salaam' }],
      },
      {
        code: 'COST_CENTRE',
        label: 'Cost centre',
        options: [{ value: 'HQ', label: 'Head office' }],
      },
    ],
    documents: [
      {
        id: uuid(81),
        documentId: uuid(82),
        hash: 'a'.repeat(64),
        title: 'Internet invoice',
      },
    ],
    programs: [],
    drafts: [],
    journals: [],
    registers: [],
    reconciliations: [],
    readiness: {
      blockers: [],
      missingNative: ['REFUND'],
      counts: { posted: 0, unposted: 0 },
    },
  };
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    data: url.endsWith('/premium-memos')
      ? [
          {
            id: uuid(85),
            invoiceId: uuid(86),
            hash: 'b'.repeat(64),
            event: 'ISSUED',
            date: '2026-11-05',
            reference: 'PREM-42',
            amount: '100.00',
            currency: 'TZS',
            movements: 0,
          },
        ]
      : workspace,
  }));
  vi.spyOn(foundationReadApi, 'scopes').mockResolvedValue([scope]);
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { id: uuid(84) } });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <GeneralLedgerWorkspace />
    </QueryClientProvider>,
  );
  return { post, get };
};
it('submits the expense and bank lines with their scoped branch, cost centre and evidence', async () => {
  const { post } = setup(true);
  await screen.findByLabelText('External reference');
  const fill = (el: HTMLElement, value: string) =>
    fireEvent.change(el, { target: { value } });
  fill(screen.getByLabelText('External reference'), 'JV-2026-000001');
  fill(screen.getByLabelText('Description'), 'Paid office internet');
  fill(screen.getByLabelText('Supporting document version'), uuid(81));
  const groups = screen.getAllByRole('group');
  for (const [i, group] of groups.entries()) {
    const q = within(group);
    fill(q.getByLabelText('Account and role'), i ? 'BANK' : 'NET');
    fill(q.getByLabelText('Branch'), uuid(80));
    fill(q.getByLabelText(i ? 'Credit' : 'Debit'), '500000');
    if (!i) fill(q.getByLabelText('Cost centre'), 'HQ');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit voucher' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/vouchers',
      expect.objectContaining({
        scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
        input: expect.objectContaining({
          reference: 'JV-2026-000001',
          currency: 'TZS',
          evidence: {
            id: uuid(81),
            documentId: uuid(82),
            hash: 'a'.repeat(64),
          },
          lines: [
            {
              role: 'NET',
              debit: '500000',
              credit: '0',
              dimensions: { BRANCH: uuid(80), COST_CENTRE: 'HQ' },
            },
            {
              role: 'BANK',
              debit: '0',
              credit: '500000',
              dimensions: { BRANCH: uuid(80) },
            },
          ],
        }),
      }),
    ),
  );
});
it('finds a premium memorandum and submits the signed measurement in the selected insurer book', async () => {
  const { get, post } = setup(true, true);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Insurance measurement' }),
  );
  expect(await screen.findByText('PREM-42')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Invoice number or ID'), {
    target: { value: 'PREM-42' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find memoranda' }));
  const selection = {
    bookId: scope.bookId,
    legalEntityId: scope.legalEntityId,
  };
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/premium-memos',
      {
        params: { ...selection, invoice: 'PREM-42' },
        signal: expect.any(AbortSignal),
      },
    ),
  );
  const input = {
    payload: { movementId: uuid(87) },
    signature: 'signed-result',
  };
  fireEvent.change(screen.getByLabelText('Signed measurement result (JSON)'), {
    target: { value: JSON.stringify(input) },
  });
  fireEvent.change(screen.getByLabelText('Measurement submission reason'), {
    target: { value: 'Reviewed closing run' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit measurement' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/measurements',
      { scope: selection, reason: 'Reviewed closing run', input },
    ),
  );
  expect(
    await screen.findByText('Measurement submitted for independent approval.'),
  ).toBeVisible();
});
it('shows the book readiness inventory to readers and restricts rollout actions', async () => {
  setup(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Book rollout' }));
  expect(screen.getByLabelText(/REFUND/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Enable FIN-02/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Programs' }));
  expect(screen.queryByRole('button', { name: 'Save for review' })).toBeNull();
});
