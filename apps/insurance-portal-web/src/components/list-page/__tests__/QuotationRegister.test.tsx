import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { QuotationRegister } from '@/modules/tenant/quotations/components/QuotationRegister';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';

const retryQuotationTira = vi.fn();
vi.mock('@/modules/tenant/underwrite/api', () => ({
  underwriteApi: {
    retryQuotationTira: (...args: unknown[]) => retryQuotationTira(...args),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function quotation(overrides: Partial<QuotationListItem>): QuotationListItem {
  return {
    id: 'q-1',
    quotation_no: 'AICL261109011',
    quotation_type: 'MOTOR',
    quotation_flow: 'MOTOR_SINGLE',
    channel_type: 'DIRECT',
    status: 'COMPLETED',
    quotation_status: 'COMPLETED',
    approval_status: 'NOT_REQUIRED',
    payment_status: 'PAID',
    tira_status: 'SUCCESS',
    display_status: 'COMPLETED',
    display_label: 'Completed',
    requires_approval: false,
    requires_payment: true,
    is_fleet: false,
    source_policy_transaction_id: null,
    source_policy_id: null,
    previous_quotation_id: null,
    fleet_id: null,
    currency_code: 'TZS',
    product_code: 'P1',
    product_name: 'Private vehicle',
    customer_name: 'Amani Juma Mashauri',
    customer_phone: '0712345678',
    sticker_no: 'ST-0001',
    cover_note_no: 'CN-0001',
    vehicle_registration_number: 'T123ABC',
    vehicle_chassis_number: null,
    cover_note_start_date: '2026-11-09T00:00:00',
    cover_note_end_date: '2026-12-08T23:59:59',
    total_premium_excluding_tax: 20000,
    total_premium_including_tax: 23600,
    submitted_at: null,
    created_at: '2026-11-09T14:32:00',
    updated_at: '2026-11-09T14:32:00',
    ...overrides,
  } as QuotationListItem;
}

const OK = quotation({});
const FAILED = quotation({
  id: 'q-2',
  quotation_no: 'AICL261109012',
  tira_status: 'FAILED',
  display_status: 'TIRAMIS_SUBMISSION_FAILED',
  display_label: 'TIRA submission failed',
  sticker_no: null,
  tira_error_code: 'E101',
  tira_error_reason: 'Vehicle already has active cover',
});
const EXPIRING = quotation({
  id: 'q-3',
  quotation_no: 'AICL261109013',
  quotation_flow: 'MOTOR_FLEET',
  cover_note_start_date: '2026-10-15T00:00:00',
  cover_note_end_date: '2026-11-14T23:59:59',
});

type Fetcher = Parameters<typeof QuotationRegister>[0]['fetcher'];

function page(rows: QuotationListItem[], total = rows.length) {
  return {
    data: rows,
    pagination: {
      page: 1,
      limit: 10,
      total,
      totalPages: Math.max(1, Math.ceil(total / 10)),
      hasNextPage: total > 10,
      hasPreviousPage: false,
    },
    summary: { all: total, active: 2, expiring: 1, tira_failed: 1, drafts: 0 },
  };
}

/** The table once its rows (not the loading skeleton) are shown. */
async function loadedTable(recordNo: string) {
  await waitFor(() =>
    within(screen.getByRole('table')).getByRole('link', { name: recordNo }),
  );
  return screen.getByRole('table');
}

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderRegister(fetcher: Fetcher) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/quotations']}>
        <Routes>
          <Route
            path="/quotations"
            element={
              <QuotationRegister
                title="Quotations"
                description="Single Motor and Fleet quotations in one register."
                breadcrumb={[
                  { label: 'Motor Insurance', href: '/' },
                  { label: 'Quotations' },
                ]}
                queryKey={['test-quotations']}
                stateKey="test-quotations"
                fetcher={fetcher}
                typeChips={[
                  { id: 'all', label: 'All' },
                  { id: 'single', label: 'Single' },
                  { id: 'fleet', label: 'Fleet' },
                ]}
                detailHref={(id) => `/quotations/${id}`}
                editHref={(id) => `/quotations/${id}/edit`}
                primaryAction={{ label: 'New quotation', onClick: vi.fn() }}
              />
            }
          />
          <Route path="/quotations/:id" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0));
  window.history.replaceState(null, '');
  retryQuotationTira.mockReset();
  useAuthStore.setState({
    user: {
      id: 'user-1',
      companyId: 'company-1',
      roles: ['UNDERWRITER'],
      permissions: [
        'quotations:retry-tiramis',
        'quotations:update',
        underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.TIRA_RETRY),
        underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.EDIT),
      ],
      scope: 'company',
    },
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QuotationRegister (standard list page)', () => {
  it('loads 20 quotations from the server and appends the next page on demand', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      quotation({ id: `first-${index}`, quotation_no: `Q-FIRST-${index}` }),
    );
    let resolveNext!: (value: ReturnType<typeof page>) => void;
    const fetcher = vi.fn(({ page: pageNumber }: { page?: number }) =>
      pageNumber === 1
        ? Promise.resolve(page(firstPage, 21))
        : new Promise<ReturnType<typeof page>>((resolve) => { resolveNext = resolve; }),
    );
    renderRegister(fetcher as Fetcher);
    const list = await screen.findByRole('list', { name: 'Quotations' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: /load more quotations/i }));
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 }), expect.anything()));
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    await act(async () => resolveNext(page([quotation({ id: 'next', quotation_no: 'Q-NEXT' })], 21)));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(21));
    expect(screen.queryByRole('button', { name: /load more quotations/i })).toBeNull();
  });
  it('shows the mandatory columns in the standard order on tablet and desktop', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([OK])));
    const table = await loadedTable('AICL261109011');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim());
    expect(headers).toEqual([
      'Quotation no.',
      'Customer',
      'Date issued',
      'Cover period',
      'Status',
      'TIRA',
      'Premium',
      'Actions',
    ]);

    const row = within(table)
      .getByRole('link', { name: 'AICL261109011' })
      .closest('tr')!;
    const [issued] = within(row).getAllByText('09/11/26');
    expect(issued).toHaveAttribute('dateTime', '2026-11-09');
    expect(issued).toHaveAttribute('title', '9 November 2026, 14:32');
    expect(within(row).getByText('14:32')).toBeInTheDocument();
    expect(row).toHaveTextContent('09/11/26 – 08/12/26');
    expect(within(row).getByText('29 days left')).toBeInTheDocument();
    expect(within(row).getByText('Success')).toBeInTheDocument();
    // Successful submissions show the status only, no sticker or cover note.
    expect(within(row).queryByText('ST-0001')).not.toBeInTheDocument();
    expect(within(row).getByText('PAID')).toBeInTheDocument();
    expect(within(row).getByText('0712345678')).toBeInTheDocument();
  });

  it('sorts newest issued first by default and marks the column', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([OK]));
    renderRegister(fetcher);
    await screen.findByRole('table');
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'created_at',
        sortOrder: 'DESC',
        include_summary: true,
      }),
      expect.anything(),
    );
    expect(
      screen.getByRole('columnheader', { name: /Date issued/ }),
    ).toHaveAttribute('aria-sort', 'descending');
  });

  it('flags rows that need attention with a coloured left bar', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([OK, FAILED, EXPIRING])));
    const table = await loadedTable('AICL261109013');
    const cellOf = (number: string) =>
      within(table).getByRole('link', { name: number }).closest('td')!;
    expect(cellOf('AICL261109011').className).not.toMatch(/inset_3px/);
    expect(cellOf('AICL261109012').className).toMatch(/#B42318/);
    expect(cellOf('AICL261109013').className).toMatch(/#8A4B08/);
    expect(within(table).getByText('Expires in 5 days')).toBeInTheDocument();
  });

  it('shows the TIRA failure reason without opening the row', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([FAILED])));
    const table = await loadedTable('AICL261109012');
    fireEvent.click(
      within(table).getByRole('button', {
        name: /TIRA failed: E101 – Vehicle already has active cover/,
      }),
    );
    expect(
      await screen.findByText('Vehicle already has active cover'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('opens the detail page from anywhere on the row', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([OK])));
    const table = await loadedTable('AICL261109011');
    fireEvent.click(within(table).getByText('Amani Juma Mashauri'));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/quotations/q-1',
    );
  });

  it('shows the phone list with the three-line rows', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([OK, EXPIRING])));
    const list = await screen.findByRole('list', { name: 'Quotations' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('AICL261109011');
    expect(first).toHaveTextContent('Single');
    expect(first).toHaveTextContent('Amani Juma Mashauri');
    expect(first).toHaveTextContent('09/11/26 – 08/12/26');
    expect(first).toHaveTextContent('Issued 09/11/26');
    expect(first).toHaveTextContent('TIRA success');
    expect(second).toHaveTextContent('Fleet');
    expect(second).toHaveTextContent('Expires in 5 days');
    expect(screen.getByText('2 quotations')).toBeInTheDocument();
    expect(
      within(first).getByRole('link', {
        name: 'Quotation no AICL261109011, Amani Juma Mashauri, Completed, TSh 23,600.00',
      }),
    ).toBeInTheDocument();
  });

  it('filters with the summary chips and shows their live counts', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([OK, FAILED, EXPIRING]));
    renderRegister(fetcher);
    const chip = await screen.findByRole('button', { name: /TIRA failed\s*1/ });
    fireEvent.click(chip);
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'tira_failed', page: 1 }),
        expect.anything(),
      ),
    );
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends typed DD/MM/YY dates to the API as ISO dates', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([OK]));
    renderRegister(fetcher);
    await screen.findByRole('table');
    const [from] = screen.getAllByLabelText('Date issued from (DD/MM/YY)');
    fireEvent.change(from, { target: { value: '01/11/26' } });
    fireEvent.blur(from);
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-11-01' }),
        expect.anything(),
      ),
    );
    expect(from).toHaveValue('01/11/26');
    expect(
      screen.getAllByText('Date issued: 01/11/26 – …')[0],
    ).toBeInTheDocument();
  });

  it('restores search and filters after coming back to the list', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([OK, FAILED]));
    const first = renderRegister(fetcher);
    fireEvent.click(await screen.findByRole('button', { name: /^Drafts/ }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'drafts' }),
        expect.anything(),
      ),
    );
    first.unmount();
    fetcher.mockClear();

    renderRegister(fetcher);
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'drafts' }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('button', { name: /^Drafts/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.location.search).toBe('');
  });

  it('retries a failed TIRA submission and updates the badge in place', async () => {
    retryQuotationTira.mockResolvedValue({});
    const fetcher = vi.fn().mockResolvedValue(page([FAILED]));
    renderRegister(fetcher);
    const table = await loadedTable('AICL261109012');
    fireEvent.pointerDown(
      within(table).getByRole('button', {
        name: 'More actions for AICL261109012',
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Retry TIRA' }),
    );
    await waitFor(() =>
      expect(retryQuotationTira).toHaveBeenCalledWith('motor', 'q-2'),
    );
    await waitFor(() =>
      expect(within(table).getByText('Pending')).toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shows the empty, no-results and error states', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]));
    const view = renderRegister(fetcher);
    expect(
      (await screen.findAllByText('No quotations yet'))[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'New quotation' }).length,
    ).toBeGreaterThan(0);
    view.unmount();

    window.history.replaceState(null, '');
    const searching = renderRegister(fetcher);
    const [search] = screen.getAllByLabelText(/Search quotation no/);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(
      (await screen.findAllByText("No results for 'zzz'"))[0],
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Clear filters' })[0],
    );
    await waitFor(() =>
      expect(screen.getAllByText('No quotations yet')[0]).toBeInTheDocument(),
    );
    searching.unmount();

    window.history.replaceState(null, '');
    renderRegister(vi.fn().mockRejectedValue(new Error('offline')));
    expect(
      (await screen.findAllByText("We couldn't load the quotations"))[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Try again' })[0],
    ).toBeInTheDocument();
  });

  it('never moves the list state into the address bar', async () => {
    renderRegister(vi.fn().mockResolvedValue(page([OK])));
    await screen.findByRole('table');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('radio', { name: 'Fleet' })[0]);
    });
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });
});
