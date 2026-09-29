import { render, screen, within } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import {
  createEmptyFleetItemRow,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import { FleetPremiumStep } from '../fleet/FleetPremiumStep';
import { getUnderwriteLineMeta } from '../lines';
import { defaultValuesForLine } from '../wizard/defaults';
import type { UnderwriteQuotationWizard } from '../wizard/useUnderwriteQuotationWizard';

function vehicle(
  entry: string,
  registration: string,
  premium: string,
  total: string,
  priced: boolean,
) {
  const base = createEmptyFleetItemRow();
  return {
    ...base,
    fleet_entry: entry,
    motor_dtl: { ...base.motor_dtl, registration_number: registration },
    risks_covered: [
      {
        ...base.risks_covered[0],
        risk_id: 'risk-comp',
        sum_insured: '10000',
        premium_excluding_tax_equivalent: premium,
        premium_including_tax: total,
        rating_result_metadata: priced
          ? ({} as NonNullable<
              (typeof base.risks_covered)[number]['rating_result_metadata']
            >)
          : null,
      },
    ],
  };
}

function Harness() {
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: {
      ...defaultValuesForLine(getUnderwriteLineMeta(UnderwriteLine.FLEET)),
      fleet: {
        ...defaultValuesForLine(getUnderwriteLineMeta(UnderwriteLine.FLEET))
          .fleet,
        items: [
          vehicle('1', 'T 100 AAA', '1000', '1180', true),
          vehicle('2', 'T 200 BBB', '500', '590', false),
        ],
      },
    },
  });
  const wizard = {
    form,
    riskOptions: [{ id: 'risk-comp', risk_name: 'Comprehensive' }],
  } as unknown as UnderwriteQuotationWizard;

  return <FleetPremiumStep wizard={wizard} onEditVehicles={() => undefined} />;
}

describe('FleetPremiumStep', () => {
  it('lists each vehicle premium and flags vehicles still to be priced', () => {
    render(<Harness />);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // header + 2 vehicles + footer
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText('T 100 AAA')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Comprehensive')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Priced')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Not priced')).toBeInTheDocument();
    expect(
      within(rows[3]).getByText(/Fleet total \(2 vehicles\)/),
    ).toBeInTheDocument();
  });
});
