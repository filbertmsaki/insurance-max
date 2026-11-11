import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { CustomersTable } from '@/modules/tenant/customers/components/CustomersTable';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import {
  TiraRows,
  TransactionRows,
} from '@/modules/tenant/underwrite/components/TransactionRows';
import type { TransactionListSource } from '@/modules/tenant/underwrite/pages/transaction-list-source';
import type {
  UnderwritePolicyTransactionRow,
  UnderwriteTiraQueueRow,
} from '@/modules/tenant/underwrite/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const pagination = (total: number) => ({
  page: 1,
  limit: 10,
  total,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
});

const ENDORSEMENT = {
  kind: 'endorsement',
  id: 't-1',
  transaction_no: 'END-2611-0001',
  transaction_type: 'ENDORSEMENT',
  stage: 'COMPLETED',
  approval_status: 'APPROVED',
  payment_status: 'PAID',
  submission_status: 'ACCEPTED',
  source_policy_id: 'p-1',
  effective_date: '2026-11-09',
  reason: 'Add driver',
  premium_effect: 'ADDITIONAL',
  additional_premium: '5000',
  return_premium: '0',
  net_premium_difference: '5000',
  currency_code: 'TZS',
  tiramis_request_id: null,
  tiramis_transaction_id: null,
  created_at: '2026-11-09T14:32:00',
  updated_at: '2026-11-09T14:32:00',
  policy_no: 'POL-1',
  cover_note_no: 'CN-1',
  customer_name: 'Amani Juma',
  customer_phone: '0712345678',
  business_line: 'FLEET',
  cover_start_date: '2026-11-09',
  cover_end_date: '2027-11-08',
} as UnderwritePolicyTransactionRow;

const FAILED_TIRA: UnderwriteTiraQueueRow = {
  source_kind: 'quotation',
  id: 'q-9',
  reference_no: 'AICL261109099',
  workflow_status: 'FAILED',
  tira_status: 'FAILED',
  tira_request_id: 'REQ-1',
  tira_response_id: null,
  status_code: 'E101',
  status_description: 'Vehicle already has active cover',
  customer_name: 'Neema Ally',
  updated_at: '2026-11-09T08:05:00',
};

function source(
  overrides: Partial<TransactionListSource> = {},
): TransactionListSource {
  return {
    keyPrefix: ['test', Math.random()],
    noun: 'motor',
    listRenewals: vi.fn(),
    listTransactions: vi.fn().mockResolvedValue({
      data: [ENDORSEMENT],
      pagination: pagination(1),
      summary: { all: 1, active: 1, expiring: 0, tira_failed: 0, drafts: 0 },
    }),
    getTiraQueue: vi
      .fn()
      .mockResolvedValue({ data: [FAILED_TIRA], pagination: pagination(1) }),
    paths: {
      renewal: (p, r) => `/policies/${p}/renewals/${r}`,
      endorsement: (p, e) => `/policies/${p}/endorsements/${e}`,
      cancellation: (p, c) => `/policies/${p}/cancellations/${c}`,
      quotation: (id) => `/quotations/${id}`,
      policy: (id) => `/policies/${id}`,
    },
    ...overrides,
  };
}

const header = (title: string) => ({
  title,
  breadcrumb: [{ label: 'Motor Insurance' }, { label: title }],
  stateKey: `test-${title}`,
});

function renderUi(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

async function loadedRow(recordNo: string) {
  await waitFor(() =>
    within(screen.getByRole('table')).getByRole('link', { name: recordNo }),
  );
  return within(screen.getByRole('table'))
    .getByRole('link', { name: recordNo })
    .closest('tr')!;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0));
  window.history.replaceState(null, '');
  useAuthStore.setState({
    user: {
      id: 'user-1',
      companyId: 'company-1',
      roles: [],
      permissions: ['quotations:retry-tiramis'],
      scope: 'company',
    },
  } as never);
});

afterEach(() => vi.useRealTimers());

describe('transaction registers on the standard list page', () => {
  it('shows endorsements with the mandatory columns and a signed premium change', async () => {
    const src = source();
    renderUi(
      <TransactionRows
        source={src}
        kind="endorsements"
        header={header('Endorsements')}
      />,
    );
    const row = await loadedRow('END-2611-0001');

    const headers = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.trim());
    expect(headers).toEqual([
      'Endorsement no.',
      'Customer',
      'Date issued',
      'Cover period',
      'Status',
      'TIRA',
      'Premium change',
      'Actions',
    ]);
    expect(row).toHaveTextContent('Fleet');
    expect(row).toHaveTextContent('14:32');
    expect(row).toHaveTextContent('09/11/26 – 08/11/27');
    expect(row).toHaveTextContent('Success');
    expect(row).toHaveTextContent('+ TSh 5,000.00');
    expect(row).toHaveTextContent('PAID');
    expect(src.listTransactions).toHaveBeenCalledWith(
      'endorsements',
      expect.objectContaining({ include_summary: true, sortBy: 'created_at' }),
      expect.anything(),
    );
    expect(
      screen.getByRole('button', { name: /^Active\s*1/ }),
    ).toBeInTheDocument();
  });

  it('labels the cancellation amount as the refund', async () => {
    renderUi(
      <TransactionRows
        source={source()}
        kind="cancellations"
        header={header('Cancellations')}
      />,
    );
    await loadedRow('END-2611-0001');
    expect(
      screen.getByRole('columnheader', { name: /Refund/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Cancellation no\./ }),
    ).toBeInTheDocument();
  });

  it('shows the TIRA failure reason and retries in place', async () => {
    const retryTira = vi.fn().mockResolvedValue({});
    const src = source({ retryTira });
    renderUi(
      <TiraRows source={src} kind="failed" header={header('TIRA failed')} />,
    );
    const row = await loadedRow('AICL261109099');
    expect(row.querySelector('td')!.className).toMatch(/#B42318/);

    fireEvent.click(
      within(row).getByRole('button', {
        name: 'TIRA failed: E101 – Vehicle already has active cover',
      }),
    );
    expect(
      await screen.findByText('Vehicle already has active cover'),
    ).toBeInTheDocument();

    fireEvent.pointerDown(
      within(row).getByRole('button', {
        name: 'More actions for AICL261109099',
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Retry TIRA' }),
    );
    await waitFor(() => expect(retryTira).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(row).getByText('Pending')).toBeInTheDocument(),
    );
    expect(src.getTiraQueue).toHaveBeenCalledTimes(1);
  });

  it('shows customers on the same table with their own key fields', async () => {
    const customer = {
      id: 'c-1',
      customer_no: 'CUS-0001',
      customer_type: 'INDIVIDUAL',
      first_name: 'Amani',
      last_name: 'Juma',
      phone: '0712345678',
      id_number: '19900101',
      email: 'amani@example.com',
      status: 'ACTIVE',
      created_at: '2026-11-09T14:32:00',
    } as unknown as CustomerRecord;
    renderUi(
      <CustomersTable
        title="Customers"
        breadcrumb={[{ label: 'Customers' }]}
        stateKey="test-customers"
        queryKey={['test-customers']}
        fetcher={vi
          .fn()
          .mockResolvedValue({ data: [customer], pagination: pagination(1) })}
      />,
    );
    const row = await loadedRow('CUS-0001');
    expect(row).toHaveTextContent('Individual');
    expect(row).toHaveTextContent('Amani Juma');
    expect(row).toHaveTextContent('0712345678');
    expect(row).toHaveTextContent('09/11/26');
    expect(row).toHaveTextContent('Active');
  });
});
