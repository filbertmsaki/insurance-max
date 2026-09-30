import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  RiskDetailsStep,
  type RiskDetailsState,
} from '../non-motor/RiskDetailsStep';
import {
  formatRiskValue,
  groupRiskFields,
  riskDataErrors,
} from '../non-motor/riskFields';
import type { ProductRiskField } from '../types';

const field = (
  overrides: Partial<ProductRiskField> &
    Pick<ProductRiskField, 'field_key' | 'label' | 'data_type'>,
): ProductRiskField => ({
  id: overrides.field_key,
  product_id: 'prod-1',
  sub_class_id: null,
  section: null,
  sort_order: 0,
  help_text: null,
  is_active: true,
  is_required: false,
  options: null,
  validation_rules: null,
  ...overrides,
});

const fields: ProductRiskField[] = [
  field({
    field_key: 'construction',
    label: 'Construction',
    data_type: 'SELECT',
    is_required: true,
    section: 'Building',
    options: [
      { value: 'CONCRETE', label: 'Concrete' },
      { value: 'TIMBER', label: 'Timber' },
    ],
  }),
  field({
    field_key: 'floors',
    label: 'Number of floors',
    data_type: 'INTEGER',
    section: 'Building',
    validation_rules: { min: 1 },
  }),
  field({
    field_key: 'vessel_name',
    label: 'Vessel name',
    data_type: 'TEXT',
    section: 'Voyage',
    help_text: 'As registered',
  }),
  field({
    field_key: 'perils',
    label: 'Perils',
    data_type: 'MULTI_SELECT',
    options: [
      { value: 'FIRE', label: 'Fire' },
      { value: 'FLOOD', label: 'Flood' },
    ],
  }),
];

describe('risk field helpers', () => {
  it('enforces required fields only when asked', () => {
    expect(riskDataErrors(fields, {}, false)).toEqual({});
    expect(riskDataErrors(fields, {}, true)).toEqual({
      construction: 'Construction is required',
    });
  });

  it('checks types and bounds like the backend', () => {
    expect(
      riskDataErrors(
        fields,
        { construction: 'STRAW', floors: '1.5', perils: ['QUAKE'] },
        false,
      ),
    ).toEqual({
      construction: 'Construction has an invalid option',
      floors: 'Number of floors must be a whole number',
      perils: 'Perils has invalid options',
    });
  });

  it('groups by section and formats values for display', () => {
    expect(groupRiskFields(fields).map((group) => group.section)).toEqual([
      'Building',
      'Voyage',
      'Risk details',
    ]);
    expect(formatRiskValue(fields[0], 'CONCRETE')).toBe('Concrete');
    expect(formatRiskValue(fields[3], ['FIRE', 'FLOOD'])).toBe('Fire, Flood');
    expect(formatRiskValue(fields[1], null)).toBe('—');
  });
});

function Harness() {
  const [state, setState] = useState<RiskDetailsState>({
    risk_data: {},
    risk_location: '',
    limit_of_liability: '',
  });
  return (
    <>
      <RiskDetailsStep
        fields={fields}
        loading={false}
        hasProduct
        state={state}
        errors={riskDataErrors(fields, state.risk_data, false)}
        onChange={setState}
      />
      <output data-testid="state">{JSON.stringify(state.risk_data)}</output>
    </>
  );
}

describe('RiskDetailsStep', () => {
  it('renders the product schema by section and captures typed values', () => {
    render(<Harness />);

    expect(screen.getByText('Building')).toBeInTheDocument();
    expect(screen.getByText('Voyage')).toBeInTheDocument();
    expect(screen.getByText('As registered')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Vessel name'), {
      target: { value: 'MV Kilimanjaro' },
    });
    fireEvent.change(screen.getByLabelText('Number of floors'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByLabelText('Flood'));

    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
      vessel_name: 'MV Kilimanjaro',
      floors: '0',
      perils: ['FLOOD'],
    });
    expect(
      screen.getByText('Number of floors must be at least 1'),
    ).toBeInTheDocument();
  });

  it('explains when the product has no configured risk fields', () => {
    render(
      <RiskDetailsStep
        fields={[]}
        loading={false}
        hasProduct
        state={{ risk_data: {}, risk_location: '', limit_of_liability: '' }}
        errors={{}}
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByText('No additional risk details for this product'),
    ).toBeInTheDocument();
  });
});
