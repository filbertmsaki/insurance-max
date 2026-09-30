import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { quotationPricingIssues } from '@/modules/tenant/quotations/wizard/utils/quotationReadiness';
import { quotationTotals } from '@/modules/tenant/quotations/wizard/utils/quotationTotals';
import type { UnderwriteQuotationWizard } from '../wizard/useUnderwriteQuotationWizard';

const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Fleet premium: every vehicle's own premium (from its per-vehicle pricing in
 * the Vehicles step), optional covers, and the fleet totals the quotation will
 * be finalized with. Read-only — premiums are edited per vehicle.
 */
export function FleetPremiumStep({
  wizard,
  onEditVehicles,
}: {
  wizard: UnderwriteQuotationWizard;
  onEditVehicles: () => void;
}) {
  const { form, riskOptions } = wizard;
  const items = useWatch({ control: form.control, name: 'fleet.items' }) ?? [];
  const currency = useWatch({ control: form.control, name: 'currency' });
  const values = form.getValues();
  const totals = quotationTotals(values);
  const issues = quotationPricingIssues(values);
  const money = (value: number) => formatMoney(value, currency || 'TZS');
  const coverName = (riskId: string) =>
    riskOptions.find((risk) => risk.id === riskId)?.risk_name ?? '—';

  const rows = items.map((item, index) => {
    const risks = item.risks_covered ?? [];
    const addons = item.cover_note_addons ?? [];
    const priced = risks.every((risk) => Boolean(risk.rating_result_metadata));
    return {
      key: risks[0]?.client_ref || String(index),
      entry: item.fleet_entry || String(index + 1),
      registration: item.motor_dtl?.registration_number || '—',
      vehicle: [item.motor_dtl?.make, item.motor_dtl?.model]
        .filter(Boolean)
        .join(' '),
      cover: [...new Set(risks.map((risk) => coverName(risk.risk_id)))].join(
        ', ',
      ),
      sumInsured: risks.reduce(
        (sum, risk) => sum + amount(risk.sum_insured),
        0,
      ),
      premium:
        risks.reduce(
          (sum, risk) => sum + amount(risk.premium_excluding_tax_equivalent),
          0,
        ) +
        addons.reduce(
          (sum, addon) =>
            sum +
            amount(
              addon.premium_excluding_tax_equivalent ||
                addon.premium_excluding_tax,
            ),
          0,
        ),
      total:
        risks.reduce(
          (sum, risk) => sum + amount(risk.premium_including_tax),
          0,
        ) +
        addons.reduce(
          (sum, addon) => sum + amount(addon.premium_including_tax),
          0,
        ),
      addons: addons.length,
      priced,
    };
  });

  return (
    <div className="space-y-6">
      <StepSection
        title="Vehicle premiums"
        description="Each vehicle is priced individually; adjust cover, discounts or add-ons from the Vehicles step."
        first
        action={
          <button
            type="button"
            className="text-sm font-medium text-blue-600 hover:underline"
            onClick={onEditVehicles}
          >
            Edit vehicles
          </button>
        }
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Cover</TableHead>
                <TableHead className="text-right">Sum insured</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Incl. taxes</TableHead>
                <TableHead>Pricing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No vehicles added yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.entry}</TableCell>
                    <TableCell>
                      <span className="block font-medium">
                        {row.registration}
                      </span>
                      <span className="text-xs text-slate-500">
                        {row.vehicle}
                        {row.addons
                          ? ` · ${row.addons} add-on${row.addons === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </TableCell>
                    <TableCell>{row.cover}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.sumInsured)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.premium)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.total)}
                    </TableCell>
                    <TableCell>
                      {row.priced ? (
                        <Badge variant="success">Priced</Badge>
                      ) : (
                        <Badge variant="warning">Not priced</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Fleet total ({rows.length} vehicle
                    {rows.length === 1 ? '' : 's'})
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.sumInsured)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.premium)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money(totals.total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </StepSection>

      <StepSection title="Fleet totals">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Premium', totals.premium],
            ['Taxes & levies', totals.tax],
            ['Final payable premium', totals.total],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {money(value as number)}
              </p>
            </div>
          ))}
        </div>
        {issues.length > 0 && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <p className="font-medium">
              Waiting for complete, current premiums.
            </p>
            {issues.map((issue, index) => (
              <p key={index}>{issue}</p>
            ))}
          </div>
        )}
      </StepSection>
    </div>
  );
}
