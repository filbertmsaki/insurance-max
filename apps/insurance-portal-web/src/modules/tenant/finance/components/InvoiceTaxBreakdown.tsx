import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '../components';
import type { FinanceInvoice } from '../types';
import Decimal from 'decimal.js';
import { invoiceTaxBreakdown } from '../utils/invoice-tax-breakdown';
export function InvoiceTaxBreakdown({ invoice }: { invoice: FinanceInvoice }) {
  const b = invoiceTaxBreakdown(invoice),
    currency = invoice.currency ?? invoice.currency_code ?? '';
  if (!['QUOTATION', 'ENDORSEMENT'].includes(invoice.source_type ?? ''))
    return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Premium and tax breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {!b ? (
          <p role="alert" className="text-amber-800">
            Tax breakdown requires reconciliation with the original pricing. A
            zero in the old invoice tax column does not establish a tax
            exemption. New issue, posting and payment instructions are blocked
            until the evidence is resolved.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2">
              <dt>Premium before discount</dt>
              <dd>{formatMoney(b.gross, currency)}</dd>
              <dt>Discount</dt>
              <dd>{formatMoney(b.discount, currency)}</dd>
              <dt>Net premium</dt>
              <dd>{formatMoney(b.net, currency)}</dd>
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full text-sm my-4">
                <thead>
                  <tr>
                    <th className="text-left">Component</th>
                    <th>Category</th>
                    <th>Basis</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {b.lines.flatMap((l) =>
                    l.charges.map((c) => (
                      <tr key={`${l.key}:${c.code}`}>
                        <td>
                          {c.name} ({c.code})
                          {l.direction
                            ? ` — ${l.direction === 'SOURCE' ? 'Original reversal' : 'Revised premium'}`
                            : ''}
                          {c.exempt
                            ? ` — Exempt: ${c.exemptionReference ?? ''}`
                            : ''}
                        </td>
                        <td>{c.category}</td>
                        <td className="text-right">
                          {formatMoney(c.baseAmount, currency)}
                        </td>
                        <td className="text-right">
                          {new Decimal(c.rate)
                            .mul(100)
                            .toFixed(8)
                            .replace(/\.?0+$/, '')}
                          %
                        </td>
                        <td className="text-right">
                          {formatMoney(c.amount, currency)}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            {b.rounding && new Decimal(b.rounding).isZero() === false ? (
              <p>
                Pricing rounding adjustment included in net premium:{' '}
                {formatMoney(b.rounding, currency)}
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-2">
              <dt>Taxes</dt>
              <dd>{formatMoney(b.tax, currency)}</dd>
              <dt>Levies / stamp duty</dt>
              <dd>{formatMoney(b.levies, currency)}</dd>
              <dt>Fees</dt>
              <dd>{formatMoney(b.fees, currency)}</dd>
              <dt>Total payable</dt>
              <dd className="font-semibold">
                {formatMoney(b.total, currency)}
              </dd>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
