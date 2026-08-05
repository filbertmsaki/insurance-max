import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RatingFactorFields } from '../RatingFactorFields';
import type { PricingRequiredFactor } from '../../types/pricing';

describe('RatingFactorFields', () => {
  it('renders factor fields in sort order and marks required factors', () => {
    render(
      <RatingFactorFields
        requiredFactors={
          [
            {
              id: 'factor-b',
              sort_order: 2,
              is_required: false,
              factor: {
                code: 'claim_record',
                name: 'Claim Record',
                data_type: 'TEXT',
                default_value: null,
                options: null,
              },
            },
            {
              id: 'factor-a',
              sort_order: 1,
              is_required: true,
              factor: {
                code: 'seat_capacity',
                name: 'Seat Capacity',
                data_type: 'NUMBER',
                default_value: '14',
                options: null,
              },
            },
          ] as unknown as PricingRequiredFactor[]
        }
        values={{}}
        onChange={vi.fn()}
      />,
    );

    const labels = screen.getAllByText(/Claim Record|Seat Capacity/);
    expect(labels[0]).toHaveTextContent('Seat Capacity');
    expect(labels[1]).toHaveTextContent('Claim Record');
    expect(screen.getByText('(seat_capacity)')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows the empty message when no factors exist', () => {
    render(
      <RatingFactorFields
        requiredFactors={[]}
        values={{}}
        emptyMessage="No factors for this risk"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('No factors for this risk')).toBeInTheDocument();
  });

  it('emits value changes for number, boolean, and multi-select fields', () => {
    const onChange = vi.fn();
    render(
      <RatingFactorFields
        requiredFactors={
          [
            {
              id: 'factor-1',
              sort_order: 1,
              is_required: true,
              factor: {
                code: 'sum_insured',
                name: 'Sum Insured',
                data_type: 'NUMBER',
                default_value: null,
                options: null,
              },
            },
            {
              id: 'factor-2',
              sort_order: 2,
              is_required: false,
              factor: {
                code: 'tracking_device',
                name: 'Tracking Device',
                data_type: 'BOOLEAN',
                default_value: null,
                options: null,
              },
            },
            {
              id: 'factor-3',
              sort_order: 3,
              is_required: false,
              factor: {
                code: 'extensions',
                name: 'Extensions',
                data_type: 'MULTI_SELECT',
                default_value: null,
                options: ['RIOT', 'FLOOD'],
              },
            },
          ] as unknown as PricingRequiredFactor[]
        }
        values={{ extensions: '' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2500000' },
    });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'RIOT' }));

    expect(onChange).toHaveBeenCalledWith('sum_insured', 2500000);
    expect(onChange).toHaveBeenCalledWith('tracking_device', true);
    expect(onChange).toHaveBeenCalledWith('extensions', 'RIOT');
  });
});
