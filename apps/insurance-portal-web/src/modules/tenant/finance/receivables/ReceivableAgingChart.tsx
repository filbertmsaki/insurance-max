import Decimal from 'decimal.js';
import type { Info } from './customer-account-model';

const buckets = [
  ['current', 'Current'],
  ['days_1_30', '1–30 days'],
  ['days_31_60', '31–60 days'],
  ['days_61_90', '61–90 days'],
  ['over_90', 'Over 90 days'],
  ['undated', 'Undated'],
] as const;

function formatAmount(value: Decimal) {
  const [integer, fraction] = value.toFixed().split('.');
  const whole = new Intl.NumberFormat('en-TZ').format(BigInt(integer));
  return fraction ? whole + '.' + fraction : whole;
}

export function ReceivableAgingChart({
  totals,
  currency,
  date,
}: {
  totals: Info;
  currency: string;
  date: string;
}) {
  const amounts = buckets
    .map(([key, label]) => ({
      key,
      label,
      amount: new Decimal(totals[key] ?? 0),
    }))
    .filter((x) => x.key !== 'undated' || !x.amount.isZero());
  const largest = Decimal.max(...amounts.map((x) => x.amount));
  return (
    <figure aria-label="Receivable aging chart" className="max-w-3xl space-y-2">
      <figcaption>
        Outstanding by age · {currency} · {date}
      </figcaption>
      {largest.lte(0) ? (
        <p>No outstanding invoices.</p>
      ) : (
        <ul className="space-y-1">
          {amounts.map(({ key, label, amount }) => (
            <li
              key={key}
              className="grid grid-cols-[6rem_minmax(2rem,1fr)_auto] items-center gap-3 text-sm"
            >
              <span>{label}</span>
              <div aria-hidden="true" className="h-2 rounded bg-slate-100">
                <div
                  className="h-full rounded bg-sky-700"
                  style={{
                    width: amount.div(largest).times(100).toString() + '%',
                  }}
                />
              </div>
              <span className="tabular-nums">{formatAmount(amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
