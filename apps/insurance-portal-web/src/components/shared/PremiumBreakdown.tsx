import { SectionCard } from './DetailSections';
import { formatMoney } from './detailFormat';

export interface PremiumBreakdownRow {
  label: string;
  value: number | null | undefined;
  /** Rendered as a subtraction (parentheses, muted) — e.g. discounts. */
  negative?: boolean;
}

interface PremiumBreakdownProps {
  currency?: string | null;
  sumInsured?: number | null;
  rows: PremiumBreakdownRow[];
  total: { label: string; value: number | null | undefined };
  description?: string;
}

/** Backend-calculated premium figures only — this never recomputes a total client-side. */
export function PremiumBreakdown({
  currency,
  sumInsured,
  rows,
  total,
  description,
}: PremiumBreakdownProps) {
  return (
    <SectionCard title="Premium Summary" description={description}>
      <div className="space-y-3">
        {sumInsured !== undefined && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm">
            <span className="text-slate-500">Sum Insured</span>
            <span className="font-medium text-slate-900">
              {formatMoney(sumInsured, currency)}
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-500">{row.label}</span>
              <span
                className={
                  row.negative ? 'text-slate-500' : 'font-medium text-slate-900'
                }
              >
                {row.negative && row.value ? '-' : ''}
                {formatMoney(row.value, currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
          <span>{total.label}</span>
          <span>{formatMoney(total.value, currency)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
