import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financeEventsApi } from './api';
import { FinanceEventMonitoringPage } from './FinanceEventMonitoringPage';

const permissions = new Set<string>();

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ hasPermission: (p: string) => permissions.has(p) }),
}));

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    financeEventsApi: {
      summary: vi.fn(),
      list: vi.fn(),
      detail: vi.fn(),
      replays: vi.fn(),
      requestReplay: vi.fn(),
      decideReplay: vi.fn(),
      executeReplay: vi.fn(),
      cancelReplay: vi.fn(),
    },
  };
});

const api = vi.mocked(financeEventsApi);

const blockedRow = {
  id: 'event-1',
  event_type: 'INVOICE_ISSUED',
  schema_version: 1,
  aggregate_type: 'INVOICE',
  aggregate_id: 'inv-1',
  event_key: 'invoice:inv-1:issued',
  status: 'BLOCKED' as const,
  attempt_count: 1,
  failure_class: 'POLICY_BLOCKED',
  last_error: 'held',
  created_at: '2026-11-19T10:00:00Z',
  published_at: null,
  age_seconds: 120,
  business_outcome: 'BLOCKED',
  accounting_outcome: 'POLICY_BLOCKED',
  accounting_reference: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FinanceEventMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Finance event monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.clear();
    api.summary.mockResolvedValue({
      total: 1287,
      counts: { PENDING: 3, PROCESSING: 1, PUBLISHED: 1270, FAILED: 4, BLOCKED: 1, DEAD_LETTER: 8 },
      oldestOpenAgeSeconds: 5400,
      retrying: 4,
      totalAttempts: 1301,
      latency24h: { samples: 40, avgSeconds: 2, p95Seconds: 30 },
      byType: [],
      accountingOutcomes: [{ accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND', n: 900 }],
      replays: { awaiting_approval: 1, approved: 0 },
      alerts: [{ level: 'critical', message: '8 event(s) in dead letter.' }],
      contracts: [],
    });
    api.list.mockResolvedValue({ items: [blockedRow], total: 51, page: 1, pageSize: 25 });
    api.replays.mockResolvedValue([
      {
        id: 'req-1',
        outbox_event_id: 'event-1',
        status: 'REQUESTED',
        reason: 'Posting policy activated',
        requested_by: 'maker',
        requested_at: '2026-11-19T10:00:00Z',
        decided_by: null,
        decision_note: null,
        execution_result: null,
        event_type: 'INVOICE_ISSUED',
        event_status: 'BLOCKED',
      },
    ]);
    api.detail.mockResolvedValue({
      event: { ...blockedRow, payload: {} },
      outcomes: [
        {
          id: 'o-1',
          consumer: 'invoice-recognition-verifier',
          idempotency_key: 'invoice:inv-1:issued',
          source_type: 'INVOICE',
          source_id: 'inv-1',
          source_revision: '1',
          operation: 'INVOICE_ISSUE',
          business_outcome: 'BLOCKED',
          business_reference: null,
          accounting_outcome: 'POLICY_BLOCKED',
          accounting_reference: null,
          detail: 'No journal; posting policy holds INVOICE.',
          processed_at: '2026-11-19T10:00:00Z',
        },
      ],
      attempts: [],
      replays: [],
    });
  });

  it('shows server-side totals, alerts and outcome columns', async () => {
    renderPage();
    expect(await screen.findByText('1287')).toBeInTheDocument();
    expect(screen.getByTestId('count-DEAD_LETTER')).toHaveTextContent('8');
    expect(screen.getByTestId('count-PUBLISHED')).toHaveTextContent('1270');
    expect(screen.getByRole('alert')).toHaveTextContent('8 event(s) in dead letter.');
    expect(await screen.findByText(/51 event\(s\) · page 1 of 3/)).toBeInTheDocument();
    expect(screen.getAllByText('POLICY_BLOCKED').length).toBeGreaterThan(0);
  });

  it('filters by status through the server', async () => {
    renderPage();
    await screen.findByText('1287');
    fireEvent.click(screen.getByTestId('count-DEAD_LETTER'));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ status: 'DEAD_LETTER', page: 1, pageSize: 25 }),
    );
  });

  it('hides replay and approval actions without permission', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect' }));
    expect(await screen.findByText(/posting policy holds INVOICE/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request replay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('requests a replay with a reason and approves through the API', async () => {
    permissions.add('finance-events:replay-request');
    permissions.add('finance-events:replay-approve');
    api.requestReplay.mockResolvedValue({} as never);
    api.decideReplay.mockResolvedValue({} as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect' }));
    const reason = await screen.findByLabelText('Replay reason');
    const submit = screen.getByRole('button', { name: 'Request replay' });
    expect(submit).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'Posting policy activated' } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.requestReplay).toHaveBeenCalledWith('event-1', 'Posting policy activated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.decideReplay).toHaveBeenCalledWith('req-1', 'APPROVE'));
  });
});
