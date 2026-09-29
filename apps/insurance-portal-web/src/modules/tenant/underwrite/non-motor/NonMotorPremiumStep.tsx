import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
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
 * Premium & Taxes: the calculated premium of every insured risk, selected
 * add-ons and extensions, taxes and the final payable premium. Read-only;
 * premiums are edited in Sum Insured & Limits and Add-ons.
 */
export function NonMotorPremiumStep({
  wizard,
  onEditRisks,
}: {
  wizard: UnderwriteQuotationWizard;
  onEditRisks: () => void;
}) {
  const { form, riskOptions } = wizard;
  const risks = useWatch({ control: form.control, name: 'risks' }) ?? [];
  const addons = useWatch({ control: form.control, name: 'addons' }) ?? [];
  const currency = useWatch({ control: form.control, name: 'currency' });
  const values = form.getValues();
  const totals = quotationTotals(values);
  const issues = quotationPricingIssues(values);
  const money = (value: number) => formatMoney(value, currency || 'TZS');

  return (
    <div className="space-y-6">
      <StepSection
        title="Insured risks"
        first
        action={
          <button
            type="button"
            className="text-sm font-medium text-blue-600 hover:underline"
            onClick={onEditRisks}
          >
            Edit risks
          </button>
        }
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Sum insured</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Incl. taxes</TableHead>
                <TableHead>Pricing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk, index) => (
                <TableRow key={risk.client_ref || index}>
                  <TableCell>
                    {riskOptions.find((option) => option.id === risk.risk_id)
                      ?.risk_name ??
                      risk.risk_code ??
                      '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(amount(risk.sum_insured))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(amount(risk.premium_excluding_tax_equivalent))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(amount(risk.premium_including_tax))}
                  </TableCell>
                  <TableCell>
                    {risk.rating_result_metadata ? (
                      <Badge variant="success">Priced</Badge>
                    ) : (
                      <Badge variant="warning">Not priced</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </StepSection>

      {addons.some((addon) => addon.enabled) && (
        <StepSection title="Add-ons & extensions">
          <ul className="divide-y rounded-lg border">
            {addons
              .filter((addon) => addon.enabled)
              .map((addon, index) => (
                <li
                  key={addon.addon_reference || index}
                  className="flex justify-between gap-4 px-4 py-2 text-sm"
                >
                  <span>{addon.addon_desc || addon.addon_reference}</span>
                  <span className="tabular-nums">
                    {money(amount(addon.premium_including_tax))}
                  </span>
                </li>
              ))}
          </ul>
        </StepSection>
      )}

      <StepSection title="Premium & taxes">
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ['Total sum insured', totals.sumInsured],
              ['Premium', totals.premium],
              ['Taxes & levies', totals.tax],
              ['Final payable premium', totals.total],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {money(value)}
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
