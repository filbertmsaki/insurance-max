import type { UseFormReturn } from 'react-hook-form';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
}

function getVehicleIssues(
  item: QuotationFormSchemaValues['fleet']['items'][number],
): string[] {
  const issues: string[] = [];

  if (!item.cover_note_number.trim()) issues.push('Missing cover note number');
  if (!item.cover_note_desc.trim()) issues.push('Missing cover note description');
  if (!item.operative_clause.trim()) issues.push('Missing operative clause');
  if (!item.motor_dtl.registration_number.trim() && !item.motor_dtl.chassis_number.trim()) {
    issues.push('Vehicle identification is incomplete');
  }
  if (!item.motor_dtl.make.trim() || !item.motor_dtl.model.trim()) {
    issues.push('Make and model are required');
  }
  if (item.risks_covered.length === 0 || !item.risks_covered.some((risk) => risk.risk_code.trim())) {
    issues.push('At least one risk is required');
  }
  if (
    item.subject_matters_covered.length === 0 ||
    !item.subject_matters_covered.some(
      (subject) =>
        subject.subject_matter_reference.trim() &&
        subject.subject_matter_desc.trim(),
    )
  ) {
    issues.push('At least one subject matter is required');
  }

  return issues;
}

export function FleetSummaryStep({ form }: Props) {
  const items = form.watch('fleet.items');
  const comprehensiveInsured =
    Number(form.watch('fleet.header.comprehensive_insured')) || 0;
  const expectedFleetSize = Number(form.watch('fleet.header.fleet_size')) || items.length;
  const invalidVehicles = items
    .map((item, index) => ({
      index,
      entry: item.fleet_entry || String(index + 1),
      issues: getVehicleIssues(item),
    }))
    .filter((item) => item.issues.length > 0);
  const totals = items.reduce(
    (acc, item) => {
      const riskTotals = item.risks_covered.reduce(
        (riskAcc, risk) => {
          const discount = risk.discounts_offered.reduce(
            (sum, row) => sum + (Number(row.discount_amount) || 0),
            0,
          );
          const tax = risk.taxes_charged.reduce(
            (sum, row) => sum + (Number(row.tax_amount) || 0),
            0,
          );

          return {
            sumInsured: riskAcc.sumInsured + (Number(risk.sum_insured) || 0),
            premiumBeforeDiscount:
              riskAcc.premiumBeforeDiscount +
              (Number(risk.premium_before_discount) || 0),
            totalDiscount: riskAcc.totalDiscount + discount,
            totalTax: riskAcc.totalTax + tax,
            premiumExcludingTax:
              riskAcc.premiumExcludingTax +
              (Number(risk.premium_excluding_tax_equivalent) || 0),
            premiumIncludingTax:
              riskAcc.premiumIncludingTax +
              (Number(risk.premium_including_tax) || 0),
          };
        },
        {
          sumInsured: 0,
          premiumBeforeDiscount: 0,
          totalDiscount: 0,
          totalTax: 0,
          premiumExcludingTax: 0,
          premiumIncludingTax: 0,
        },
      );

      return {
        sumInsured: acc.sumInsured + riskTotals.sumInsured,
        premiumBeforeDiscount:
          acc.premiumBeforeDiscount + riskTotals.premiumBeforeDiscount,
        totalDiscount: acc.totalDiscount + riskTotals.totalDiscount,
        totalTax: acc.totalTax + riskTotals.totalTax,
        premiumExcludingTax:
          acc.premiumExcludingTax + riskTotals.premiumExcludingTax,
        premiumIncludingTax:
          acc.premiumIncludingTax + riskTotals.premiumIncludingTax,
      };
    },
    {
      sumInsured: 0,
      premiumBeforeDiscount: 0,
      totalDiscount: 0,
      totalTax: 0,
      premiumExcludingTax: 0,
      premiumIncludingTax: 0,
    },
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 4. Fleet Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>Expected fleet size: {expectedFleetSize}</p>
          <p>Vehicles entered: {items.length}</p>
          <p>Comprehensively insured vehicles: {comprehensiveInsured}</p>
          <p>Total sum insured: {totals.sumInsured.toFixed(2)}</p>
          <p>Premium before discounts: {totals.premiumBeforeDiscount.toFixed(2)}</p>
          <p>Total discounts: {totals.totalDiscount.toFixed(2)}</p>
          <p>Total taxes: {totals.totalTax.toFixed(2)}</p>
          <p>Premium excluding tax: {totals.premiumExcludingTax.toFixed(2)}</p>
          <p>Premium including tax: {totals.premiumIncludingTax.toFixed(2)}</p>
          <p>Invalid or incomplete vehicles: {invalidVehicles.length}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => {
            const issues = getVehicleIssues(item);
            const entry = item.fleet_entry || String(index + 1);
            const vehicleName =
              item.motor_dtl.registration_number ||
              item.motor_dtl.chassis_number ||
              `Vehicle ${entry}`;

            return (
              <div
                key={`${entry}-${index}`}
                className="flex items-start justify-between rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Fleet Entry {entry} - {vehicleName}
                  </p>
                  {issues.length > 0 ? (
                    <div className="mt-2 space-y-1 text-sm text-amber-700">
                      {issues.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-700">
                      Vehicle entry is ready for submission.
                    </p>
                  )}
                </div>
                {issues.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
