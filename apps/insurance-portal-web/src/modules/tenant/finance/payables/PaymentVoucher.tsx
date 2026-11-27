import { Button } from '@/components/ui/button';
import type { Info, Register, Row } from './ap-model';
import { amountLabel } from './ap-export';
export function PaymentVoucher({
  row: r,
  register,
  party,
  company,
}: {
  row: Row;
  register: Register;
  party: string;
  company: string;
}) {
  const name = (id?: string) =>
    register.staff.find((s) => s.id === id)?.name ?? id ?? '';
  const bank = register.records.find((b) => b.id === r.data.bankId),
    details = r.data.details;
  return (
    <>
      <Button variant="outline" onClick={() => window.print()}>
        Print payment voucher
      </Button>
      <section id="ap-voucher-print" className="hidden print:block">
        <style>
          {
            '@media print{body:has(#ap-voucher-print) *{visibility:hidden}#ap-voucher-print,#ap-voucher-print *{visibility:visible}#ap-voucher-print{display:block;position:absolute;left:0;top:0;width:100%;padding:1rem;background:white;color:black}}'
          }
        </style>
        <h1>
          Payment voucher · PV-{r.doc_date.slice(0, 4)}-
          {String(r.sequence).padStart(8, '0')}
        </h1>
        <p>
          {company} · {r.status} · {r.reference}
        </p>
        <p>Payee · {party}</p>
        <p>{details.description}</p>
        <p>
          {bank?.data.details.bankName} · Account ending{' '}
          {bank?.data.details.accountEnding}
        </p>
        <p>Scheduled payment date · {r.due_date}</p>
        {details.allocations && details.allocations.length > 0 && (
          <table>
            <thead>
              <tr>
                {['Bill', 'Gross', 'Withholding', 'Discount', 'Net'].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {details.allocations.map((a: Info) => (
                <tr key={a.itemId}>
                  {[a.reference, a.gross, a.withheld, a.discount, a.net].map(
                    (x, i) => (
                      <td key={i}>{i ? amountLabel(x) : x}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>
          Total payable · {r.currency} {amountLabel(r.amount)}
        </p>
        <p>
          Prepared by {name(r.maker_id)} · Approved by{' '}
          {name(r.reviewer_user_id)}
        </p>
        {r.journal_no && <p>Journal · {r.journal_no}</p>}
        {r.settlement && (
          <p>
            Bank reference · {r.settlement.reference} ·{' '}
            {r.settlement.valueDate || r.settlement.settledAt}
          </p>
        )}
      </section>
    </>
  );
}
