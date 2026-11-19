import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { financeApi } from '../api';
import { FinanceDashboardPage } from './FinanceDashboardPage';

vi.mock('../api', () => ({
  financeApi: { getDashboardSummary: vi.fn() },
}));

describe('Finance dashboard', () => {
  it('shows server totals across pages without combining currencies', async () => {
    vi.mocked(financeApi.getDashboardSummary).mockResolvedValue({
      openInvoices: [
        { currency: 'TZS', count: 130, amount: '250000.25' },
        { currency: 'USD', count: 2, amount: '9007199254740993.0100' },
      ],
      receipts: [{ currency: 'TZS', count: 111, amount: '100000.00' }],
      paidRefunds: [{ currency: 'USD', count: 1, amount: '10.00' }],
      journalCount: 145,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FinanceDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('132')).toBeInTheDocument();
    expect(
      screen.getByText(
        /145 operational journal entries are currently available for review/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/USD 9,007,199,254,740,993\.0100/),
    ).toBeInTheDocument();
  });
});
