import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { JournalSearchPanel } from '../JournalSearch';
import { foundationReadApi } from '../api';
import { scope, uuid } from './fixtures';

vi.mock('../api', async (load) => ({
  ...(await load<typeof import('../api')>()),
  foundationReadApi: { journals: vi.fn(), exportJournals: vi.fn() },
}));

describe('journal search', () => {
  it('refuses a date-range export when access has been revoked', async () => {
    vi.mocked(foundationReadApi.journals)
      .mockReset()
      .mockResolvedValueOnce({
        journals: [],
        hasMore: false,
        nextCursor: null,
        mode: 'VALIDATION',
      });
    vi.mocked(foundationReadApi.exportJournals)
      .mockReset()
      .mockRejectedValueOnce({ response: { status: 403 } });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <JournalSearchPanel scope={scope} identity={['user', 'session']} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Journal from date'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Journal to date'), {
      target: { value: '2026-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search journals' }));
    await screen.findByText(/Showing 0 journals/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Export date range evidence' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Export failed'),
    );
    expect(screen.queryByText(/Showing 0 journals/)).not.toBeInTheDocument();
    view.unmount();
    client.clear();
  });
  it('rechecks access before export and refuses a denied export', async () => {
    const journals = vi.mocked(foundationReadApi.journals);
    journals.mockReset();
    journals.mockResolvedValueOnce({
      journals: [
        {
          id: uuid(3),
          accountingDate: '2026-05-01',
          transactionDate: '2026-05-01',
          transactionCurrency: 'USD',
          functionalCurrency: 'TZS',
          kind: 'ORIGINAL',
          reversalOf: null,
          subjectHash: 'a'.repeat(64),
          financialEffects: 0,
        },
      ],
      hasMore: false,
      nextCursor: null,
      mode: 'VALIDATION',
    });
    journals.mockRejectedValueOnce({ response: { status: 403 } });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <JournalSearchPanel scope={scope} identity={['user', 'session']} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Journal from date'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Journal to date'), {
      target: { value: '2026-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search journals' }));
    await screen.findByText(/Showing 1 journals/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Export current page CSV' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Export failed'),
    );
    expect(journals).toHaveBeenCalledTimes(2);
    view.unmount();
    client.clear();
  });
});
