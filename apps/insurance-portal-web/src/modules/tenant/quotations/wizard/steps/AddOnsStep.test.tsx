import { fireEvent, render, screen, within } from '@testing-library/react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { QuotationFormSchemaValues } from '../../schemas';
import { AddOnsStep } from './AddOnsStep';

vi.mock('../components/AddonRow', () => ({
  AddonRow: ({
    form,
    index,
    onRemove,
    canRemove,
  }: {
    form: UseFormReturn<QuotationFormSchemaValues>;
    index: number;
    onRemove: (index: number) => void;
    canRemove: boolean;
  }) => (
    <div>
      <span>
        {form.watch(`addons.${index}.addon_reference`) || 'Draft add-on'}
      </span>
      <button
        type="button"
        onClick={() => {
          form.setValue(`addons.${index}.addon_definition_id`, 'windscreen');
          form.setValue(`addons.${index}.addon_reference`, 'WINDSCREEN');
          form.setValue(`addons.${index}.premium_excluding_tax`, '100');
        }}
      >
        Select and calculate
      </button>
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)}>
          Remove add-on
        </button>
      )}
    </div>
  ),
}));

function Harness() {
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: { addons: [], currency: 'TZS', quotation_type: 'MOTOR' },
  });
  const fieldArray = useFieldArray({ control: form.control, name: 'addons' });
  return <AddOnsStep form={form} fieldArray={fieldArray} />;
}

describe('AddOnsStep', () => {
  it('adds multiple add-ons through the modal and allows removing every row', () => {
    render(<Harness />);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Add add-on' }));
      const dialog = within(screen.getByRole('dialog'));
      expect(
        dialog.getByRole('button', { name: 'Add to cover note' }),
      ).toBeDisabled();
      fireEvent.click(
        dialog.getByRole('button', { name: 'Select and calculate' }),
      );
      fireEvent.click(
        dialog.getByRole('button', { name: 'Add to cover note' }),
      );
    }
    expect(screen.getAllByText('WINDSCREEN')).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove add-on' })[0],
    );
    expect(screen.getAllByText('WINDSCREEN')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove add-on' }));
    expect(screen.getByText(/No add-ons added/)).toBeInTheDocument();
  });

  it('discards the draft when cancelled', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add add-on' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select and calculate' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('WINDSCREEN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add add-on' }));
    expect(
      screen.getByRole('button', { name: 'Add to cover note' }),
    ).toBeDisabled();
  });
});
