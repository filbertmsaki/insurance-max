import { MemoryRouter } from 'react-router-dom';
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
const setup = (
  prepare: boolean,
  insurer = false,
  register: Record<string, unknown> = {},
) => {
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
    adjustmentPeriods: [
      {
        id: uuid(89),
        code: 'YEAR-END',
        start: '2020-01-01',
        finish: '2099-01-01',
        ready: true,
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
    ...register,
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
    <MemoryRouter>
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
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { post, get };
};
it('submits the expense and bank lines with their scoped branch, cost centre and evidence', async () => {
  const { post } = setup(true);
  await screen.findByLabelText('External reference');
  const fill = (el: HTMLElement, value: string) =>
    fireEvent.change(el, { target: { value } });
  fill(screen.getByLabelText('External reference'), 'JV-2026-000001');
  fill(screen.getByLabelText('Adjustment period (optional)'), uuid(89));
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
          adjustmentPeriodId: uuid(89),
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
it('recovers a never-created instalment using the original due date, signed evidence and selected open posting date', async () => {
  const date = '2026-10-01',
    id = uuid(87),
    hash = 'b'.repeat(64);
  const { post } = setup(true, false, {
    programs: [
      {
        id,
        code: 'MONTHLY',
        kind: 'RECURRING',
        state: 'APPROVED',
        revision: 1,
        subject_hash: hash,
        definition: {
          start: date,
          end: '2027-01-01',
          description: 'Office utilities',
          currency: 'TZS',
          dimensions: {},
        },
      },
    ],
    scheduleHolds: [
      {
        programId: id,
        code: 'MONTHLY',
        kind: 'RECURRING',
        date,
        reason: 'The regular period is closed.',
      },
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Programs' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Recover missed occurrence' }),
  );
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fill('Recovery posting date', '2026-11-01');
  fill('Action reason', 'Book missed office utilities');
  const documents = screen.getAllByLabelText('Supporting document version');
  fireEvent.change(documents[documents.length - 1], {
    target: { value: uuid(81) },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit occurrence for approval' }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/programs/' + id + '/occurrences',
      expect.objectContaining({
        input: expect.objectContaining({
          date,
          postingDate: '2026-11-01',
          stage: 'GENERATE',
          subjectHash: hash,
          evidence: expect.objectContaining({ id: uuid(81) }),
        }),
      }),
    ),
  );
});

it('records the direction and supporting document of a resolved statement timing item', async () => {
  const { post } = setup(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Programs' }));
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fill('Program type', 'RECONCILIATION');
  fireEvent.click(screen.getByRole('button', { name: 'Add reconciling item' }));
  fill('Exception reference', 'Deposit 42');
  fill('Exception description', 'Deposit in transit');
  fill('Exception amount', '10');
  fill('Signed statement balance', '90');
  fill('Statement adjustment', 'ADD_TO_STATEMENT');
  fill('Timing item evidence', uuid(81));
  fireEvent.click(screen.getByLabelText('Resolved'));
  fill('Action reason', 'Match statement to bank evidence');
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/programs',
      expect.objectContaining({
        input: expect.objectContaining({
          definition: expect.objectContaining({
            statementBalance: '90',
            exceptions: [
              expect.objectContaining({
                amount: '10',
                treatment: 'ADD_TO_STATEMENT',
                resolved: true,
                evidence: expect.objectContaining({ id: uuid(81) }),
              }),
            ],
          }),
        }),
      }),
    ),
  );
});

it('submits opposite-signed branch positions for one controlled FX opening', async () => {
  const branches = [
    { value: uuid(80), label: 'Head office' },
    { value: uuid(88), label: 'Coast' },
  ];
  const { post } = setup(true, false, {
    currencies: { TZS: 2, USD: 2 },
    dimensions: [{ code: 'BRANCH', label: 'Branch', options: branches }],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Programs' }));
  const fill = (field: HTMLElement, value: string) =>
    fireEvent.change(field, { target: { value } });
  fill(screen.getByLabelText('Program type'), 'REVALUATION');
  fill(screen.getByLabelText('Currency'), 'USD');
  const positions = branches.map((branch, i) => ({
    branch: branch.value,
    currency: 'USD',
    foreign: i ? '-40' : '100',
    carrying: i ? '-100000' : '250000',
  }));
  for (const [i, row] of positions.entries()) {
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Add branch and currency opening position',
      }),
    );
    const q = within(
      screen.getByRole('group', { name: 'Opening position ' + (i + 1) }),
    );
    fill(q.getByLabelText('Branch'), row.branch);
    fill(q.getByLabelText('Currency'), row.currency);
    fill(q.getByLabelText('Signed foreign amount'), row.foreign);
    fill(q.getByLabelText('Signed carrying amount'), row.carrying);
  }
  fill(
    screen.getByLabelText('Action reason'),
    'Certify branch opening balances',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/tenant/finance/foundation/gl/programs',
      expect.objectContaining({
        input: expect.objectContaining({
          definition: expect.objectContaining({ openingPositions: positions }),
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
