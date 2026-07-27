import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
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
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">{result.risk_name}</CardTitle>
            <p className="text-xs font-mono text-slate-400">{result.risk_code}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {result.rate_type}
              </Badge>
              <span className="text-xs text-slate-500">{result.rule_name}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Payable</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatPricingMoney(
                result.premium_including_charges ?? result.final_premium,
              )}
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
                  {result.percentage_rate} ({formatDisplayRatePercent(result.percentage_rate)}%)
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Base Premium</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.base_premium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Per Unit Premium</TableCell>
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
                <TableCell className="py-1.5 text-xs">Gross Premium</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.gross_premium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Minimum Amount</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.minimum_amount)}
                  {result.minimum_applied ? (
                    <Badge className="ml-2 border-amber-200 bg-amber-50 text-[10px] text-amber-600 hover:bg-amber-50">
                      Min Applied
                    </Badge>
                  ) : null}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs font-semibold">
                  Final Premium
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {formatPricingMoney(result.final_premium)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs">Charges Total</TableCell>
                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                  {formatPricingMoney(result.total_charge_amount ?? 0)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="py-1.5 text-xs font-semibold">
                  Premium Including Charges
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {formatPricingMoney(
                    result.premium_including_charges ?? result.final_premium,
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {result.charges?.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Charges
            </p>
            <Table>
              <TableBody>
                {result.charges.map((charge) => (
                  <TableRow
                    key={`${charge.applied_rule_id}-${charge.charge_code}`}
                    className="hover:bg-blue-50/40"
                  >
                    <TableCell className="py-1.5 text-xs">
                      {charge.charge_name}{' '}
                      <span className="text-slate-400">({charge.charge_code})</span>
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                      {formatPricingMoney(charge.computed_amount)}
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
