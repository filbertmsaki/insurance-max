import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InvoiceTaxBreakdown } from './InvoiceTaxBreakdown';
import type { FinanceInvoice } from '../types';
describe('Invoice tax display', () => {
  it('shows an explicit reconciliation warning for historical zero tax', () => {
    render(
      <InvoiceTaxBreakdown
        invoice={
          {
            source_type: 'QUOTATION',
            tax_amount: '0.00',
            items: [],
          } as unknown as FinanceInvoice
        }
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'requires reconciliation',
    );
  });
  it('shows separate rates, bases and taxes, levies and fees', () => {
    const b = {
      schema: 'QUOTATION_INVOICE_TAX_V1',
      gross: '100',
      discount: '0',
      net: '100',
      tax: '18',
      levies: '2',
      fees: '1',
      total: '121',
      lines: [
        {
          key: 'risk',
          charges: [
            {
              code: 'VAT',
              name: 'Configured VAT',
              category: 'TAX',
              rate: '0.18',
              baseAmount: '100',
              amount: '18',
              exempt: false,
            },
            {
              code: 'LEVY',
              name: 'Regulatory levy',
              category: 'LEVY',
              rate: '0.02',
              baseAmount: '100',
              amount: '2',
              exempt: false,
            },
          ],
        },
      ],
    };
    render(
      <InvoiceTaxBreakdown
        invoice={
          {
            source_type: 'QUOTATION',
            currency: 'USD',
            items: [{ line_snapshot: { tax_breakdown: b } }],
          } as unknown as FinanceInvoice
        }
      />,
    );
    expect(screen.getByText('18%')).toBeTruthy();
    expect(screen.getByText('2%')).toBeTruthy();
    expect(screen.getByText('Levies / stamp duty')).toBeTruthy();
    expect(screen.getByText('Total payable')).toBeTruthy();
  });
});
