import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { PricingSingleRiskResult } from '../types/pricing';
import {
  formatDisplayRatePercent,
  formatPricingMoney,
} from '../utilities/pricing';
import { PricingStatusAlert } from './PricingStatusAlert';

interface Props {
  result: PricingSingleRiskResult;
}

export function PremiumBreakdown({ result }: Props) {
  const breakdown = result.premium_breakdown;
  const item = breakdown?.items[0];
  const payablePremium =
    breakdown?.totals.payable_premium ??
    result.premium_including_charges ??
    result.final_premium;
  const rawPremium = item?.raw_premium ?? result.gross_premium;
  const minimumPremium = item?.minimum_premium ?? result.minimum_amount;
  const premiumAfterDiscount =
    item?.premium_after_discount ?? result.final_premium;
  const taxTotal =
    breakdown?.totals.taxes ??
    (result.charges ?? [])
      .filter((charge) => charge.charge_category === 'TAX')
      .reduce((sum, charge) => sum + charge.computed_amount, 0);
  const otherChargesTotal =
    breakdown?.totals.other_charges ??
    Math.max((result.total_charge_amount ?? 0) - taxTotal, 0);
  const chargeLines = breakdown
    ? [...(item?.taxes ?? []), ...(item?.other_charges ?? [])].map(
        (charge) => ({
          key: `${charge.charge_code}-${charge.charge_category}`,
          name: charge.charge_name,
          code: charge.charge_code,
          amount: charge.amount,
        }),
      )
    : (result.charges ?? []).map((charge) => ({
        key: `${charge.applied_rule_id}-${charge.charge_code}`,
        name: charge.charge_name,
        code: charge.charge_code,
        amount: charge.computed_amount,
      }));

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">{result.risk_name}</CardTitle>
            <p className="text-xs font-mono text-slate-400">
              {result.risk_code}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {item?.calculation_method ?? result.rate_type}
              </Badge>
              <span className="text-xs text-slate-500">
                {item?.matched_rule.rule_name ?? result.rule_name}
              </span>
              {breakdown?.rate_book.code ? (
                <span className="text-xs text-slate-400">
                  {breakdown.rate_book.code}
                  {breakdown.rate_book.version
                    ? ` / ${breakdown.rate_book.version}`
                    : ''}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Payable</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatPricingMoney(payablePremium)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PricingStatusAlert
          metadata={result}
          minimumAmount={result.minimum_amount}
          compact
        />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Breakdown
          </p>
          <Table>
            <TableBody>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Sum Insured</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.sum_insured)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Rate</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {item?.rate ?? result.percentage_rate} (
                  {item?.display_rate_percent ??
                    formatDisplayRatePercent(result.percentage_rate)}
                  %)
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Base Premium</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.base_premium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">
                  Per Unit Premium
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.per_unit_premium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Fixed Amount</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.fixed_amount)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Raw Premium</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(rawPremium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">
                  Minimum Premium
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(minimumPremium)}
                  {(item?.minimum_applied ?? result.minimum_applied) ? (
                    <Badge className="ml-2 border-amber-200 bg-amber-50 text-[10px] text-amber-600 hover:bg-amber-50">
                      Min Applied
                    </Badge>
                  ) : null}
                </TableCell>
              </TableRow>
              {result.maximum_premium != null ? (
                <TableRow className="hover:bg-blue-50/40">
                  <TableCell className="py-1.5 text-xs">
                    Maximum Premium
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {formatPricingMoney(result.maximum_premium)}
                    {result.maximum_premium_applied ? (
                      <Badge className="ml-2 border-amber-200 bg-amber-50 text-[10px] text-amber-600 hover:bg-amber-50">
                        Max Applied
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
              {result.base_addon_premium != null ? (
                <TableRow className="hover:bg-blue-50/40">
                  <TableCell className="py-1.5 text-xs">
                    Add-on Premium
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {formatPricingMoney(result.base_addon_premium)}
                  </TableCell>
                </TableRow>
              ) : null}
              {result.proration_factor != null ? (
                <TableRow className="hover:bg-blue-50/40">
                  <TableCell className="py-1.5 text-xs">
                    Proration Factor
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {result.proration_factor}
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs font-semibold">
                  Premium After Discount
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {formatPricingMoney(premiumAfterDiscount)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Taxes</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(taxTotal)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Other Charges</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(otherChargesTotal)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs font-semibold">
                  Final Premium
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {formatPricingMoney(payablePremium)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {chargeLines.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Charges
            </p>
            <Table>
              <TableBody>
                {chargeLines.map((charge) => (
                  <TableRow key={charge.key} className="hover:bg-blue-50/40">
                    <TableCell className="py-1.5 text-xs">
                      {charge.name}{' '}
                      <span className="text-slate-400">({charge.code})</span>
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                      {formatPricingMoney(charge.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
