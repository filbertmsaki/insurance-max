import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QuotationSummaryHeader } from '../components/QuotationSummaryHeader';
import { buildQuotationLifecycle } from '../utils/quotationLifecycle';
import { quotationDetailFixture } from './quotationDetailFixture';

describe('desktop summary figures', () => {
  it('shows a short premium and a numeric cover period in full', () => {
    const preview = quotationDetailFixture();
    preview.premium_summary.total_premium_including_tax = 23600;
    preview.premium_summary.currency = 'TZS';
    preview.cover_note.cover_note_start_date = '2026-11-09T00:00:00';
    preview.cover_note.cover_note_end_date = '2026-12-08T00:00:00';
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <QuotationSummaryHeader
            preview={preview}
            lifecycle={buildQuotationLifecycle(preview)}
            actions={null}
            menuItems={[]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/23\.6K$/)).toBeInTheDocument();
    expect(screen.getByText('09/11/26 –')).toBeInTheDocument();
    expect(screen.getByText('08/12/26')).toBeInTheDocument();
  });
});
