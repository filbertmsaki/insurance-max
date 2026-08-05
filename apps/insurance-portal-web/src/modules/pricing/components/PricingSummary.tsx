import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { PricingCalculationState } from '../types/pricing';
import { formatPricingMoney } from '../utilities/pricing';

interface Props {
  title?: string;
  total: number | null;
  state: PricingCalculationState;
}

const STATE_LABELS: Record<PricingCalculationState, string> = {
  IDLE: 'Idle',
  LOADING: 'Calculating',
  CALCULATING: 'Calculating',
  CALCULATED: 'Calculated',
  INCOMPLETE: 'Incomplete',
  WARNING: 'Calculated with warnings',
  REFERRAL_REQUIRED: 'Referral required',
  STALE: 'Recalculation required',
  ERROR: 'Error',
  EXPIRED: 'Expired',
};

export function PricingSummary({
  title = 'Pricing Summary',
  total,
  state,
}: Props) {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Reusable pricing module summary
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2 text-[10px]">
            {STATE_LABELS[state]}
          </Badge>
          <p className="text-xs text-slate-500">Grand Total</p>
          <p className="text-3xl font-bold text-green-600 tabular-nums">
            {total === null ? '--' : formatPricingMoney(total)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
