import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness />
      </QueryClientProvider>,
    );

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
    expect(
      screen.getByRole('button', { name: 'Calculate Fleet Premium' }),
    ).toBeInTheDocument();
  });

  it('shows the chassis number for a vehicle without a registration', () => {
    const unregistered = vehicle('1', '', '1000', '1180', true);
    unregistered.motor_dtl.chassis_number = 'CHS-UNREG-001';
    function UnregisteredHarness() {
      const defaults = defaultValuesForLine(
        getUnderwriteLineMeta(UnderwriteLine.FLEET),
      );
      const form = useForm<QuotationFormSchemaValues>({
        defaultValues: {
          ...defaults,
          fleet: { ...defaults.fleet, items: [unregistered] },
        },
      });
      const wizard = {
        form,
        riskOptions: [{ id: 'risk-comp', risk_name: 'Comprehensive' }],
      } as unknown as UnderwriteQuotationWizard;
      return (
        <FleetPremiumStep wizard={wizard} onEditVehicles={() => undefined} />
      );
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UnregisteredHarness />
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('CHS-UNREG-001').length).toBeGreaterThan(0);
  });
});
