import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PricingStatusAlert } from '../PricingStatusAlert';

describe('PricingStatusAlert', () => {
  it('shows the loading state while pricing is in progress', () => {
    render(<PricingStatusAlert isPending minimumAmount={250000} />);

    expect(screen.getByText('Pricing in progress')).toBeInTheDocument();
    expect(screen.getByText('Calculating premium...')).toBeInTheDocument();
    expect(screen.getByText('Minimum premium: 250000.00')).toBeInTheDocument();
  });

  it('shows the stale warning with the supplied stale reason', () => {
    render(
      <PricingStatusAlert
        metadata={{
          pricing_quote_id: 'PQ-2026-00000014',
          pricing_is_stale: true,
          stale_reason: 'Exchange rate changed after the last calculation.',
          validation_warnings: ['Discount needs approval'],
        }}
      />,
    );

    expect(screen.getByText('Pricing is stale')).toBeInTheDocument();
    expect(
      screen.getByText('Exchange rate changed after the last calculation.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Pricing quote: PQ-2026-00000014'),
    ).toBeInTheDocument();
    expect(screen.getByText('Discount needs approval')).toBeInTheDocument();
  });

  it('shows the expired state and exchange-rate details from pricing metadata', () => {
    render(
      <PricingStatusAlert
        metadata={{
          pricing_quote_id: 'PQ-2026-00000015',
          expires_at: '2026-07-26T10:00:00.000Z',
          exchange_rate_snapshot: {
            quotation_currency_code: 'USD',
            base_currency_code: 'TZS',
            exchange_rate: 2540.125,
            exchange_rate_source: 'MANUAL',
            exchange_rate_date: '2026-07-26',
            exchange_rate_precision: 10,
            approval_required: true,
            approval_granted: true,
            approved_by_user_id: 'approver-1',
            approved_at: '2026-07-26T10:00:00.000Z',
            conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
            rounding_method: 'ROUND_HALF_UP',
          },
        }}
      />,
    );

    expect(screen.getByText('Pricing has expired')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The stored pricing quote has expired. Recalculate before continuing.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Exchange: USD -> TZS @ 2540.125'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Rate date: 2026-07-26 (manual)'),
    ).toBeInTheDocument();
  });

  it('shows validation errors as an attention state', () => {
    render(
      <PricingStatusAlert
        errorMessage="Could not calculate premium for this risk."
        metadata={{
          validation_errors: [
            'Sum insured is required',
            'Registration number is required',
          ],
        }}
      />,
    );

    expect(screen.getByText('Pricing needs attention')).toBeInTheDocument();
    expect(
      screen.getByText('Could not calculate premium for this risk.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sum insured is required')).toBeInTheDocument();
    expect(
      screen.getByText('Registration number is required'),
    ).toBeInTheDocument();
  });

  it('surfaces referral-style warnings from pricing metadata', () => {
    render(
      <PricingStatusAlert
        metadata={{
          minimum_applied: true,
          validation_warnings: [
            'Referral to underwriting required before the quote can be issued.',
          ],
        }}
      />,
    );

    expect(screen.getByText('Minimum premium applied')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Referral to underwriting required before the quote can be issued.',
      ),
    ).toBeInTheDocument();
  });
});
