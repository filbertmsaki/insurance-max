import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Form } from '@/components/ui/form';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { WizardInput } from './WizardInput';

function Harness({ select }: { select?: boolean }) {
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: {
      payment_mode_tira: '1',
      motor: createEmptyMotorDetails(),
    },
  });
  const stored = useWatch({
    control: form.control,
    name: select ? 'payment_mode_tira' : 'motor.make',
  });
  return (
    <Form {...form}>
      {/* Inside a <form>, like the wizard, so Radix renders its hidden native select. */}
      <form>
        {select ? (
          <WizardInput
            form={form}
            name="payment_mode_tira"
            label="Payment method"
            required
            options={[
              { value: '1', label: 'Cash' },
              { value: '3', label: 'EFT' },
            ]}
          />
        ) : (
          <WizardInput form={form} name="motor.make" label="Make" uppercase />
        )}
      </form>
      <button
        type="button"
        onClick={() => form.setValue('payment_mode_tira', '3')}
      >
        Set EFT
      </button>
      <output data-testid="stored">{stored}</output>
    </Form>
  );
}

beforeEach(() => {
  // Radix Select scrolls focused options; jsdom has no layout implementation.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('WizardInput', () => {
  it('renders options with the standard select and stores the chosen value', async () => {
    render(<Harness select />);
    const trigger = screen.getByRole('combobox', { name: 'Payment method' });
    expect(trigger).toHaveTextContent('Cash');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'EFT' }));

    expect(screen.getByTestId('stored')).toHaveTextContent('3');
    expect(trigger).toHaveTextContent('EFT');
  });

  it('keeps a value set programmatically while the list is closed', () => {
    render(<Harness select />);
    fireEvent.click(screen.getByRole('button', { name: 'Set EFT' }));

    expect(screen.getByTestId('stored')).toHaveTextContent('3');
    expect(
      screen.getByRole('combobox', { name: 'Payment method' }),
    ).toHaveTextContent('EFT');
  });

  it('upper-cases typed text when requested', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: 'toyota' },
    });
    expect(screen.getByTestId('stored')).toHaveTextContent('TOYOTA');
  });
});

describe('WizardInput required marker', () => {
  it('shows the red asterisk without changing the accessible name', () => {
    render(<Harness select />);
    const trigger = screen.getByRole('combobox', { name: 'Payment method' });
    expect(trigger).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toHaveClass('text-red-500');
  });
});

describe('WizardInput searchable', () => {
  function YearHarness() {
    const form = useForm<QuotationFormSchemaValues>({
      defaultValues: { motor: createEmptyMotorDetails() },
    });
    const stored = useWatch({
      control: form.control,
      name: 'motor.manufacture_year',
    });
    return (
      <Form {...form}>
        <form>
          <WizardInput
            form={form}
            name="motor.manufacture_year"
            label="Year of manufacture"
            options={['2020', '2019', '2018'].map((year) => ({
              value: year,
              label: year,
            }))}
            searchable
            required
          />
        </form>
        <button
          type="button"
          onClick={() => form.setFocus('motor.manufacture_year')}
        >
          Focus year
        </button>
        <output data-testid="stored">{stored}</output>
      </Form>
    );
  }

  it('filters options by typing and stores the chosen one', async () => {
    render(<YearHarness />);
    const trigger = screen.getByRole('combobox', {
      name: 'Year of manufacture',
    });
    expect(trigger).toHaveAttribute('aria-required', 'true');
    expect(trigger).toHaveTextContent('Select year of manufacture');

    fireEvent.click(trigger);
    fireEvent.change(
      await screen.findByPlaceholderText('Search year of manufacture'),
      { target: { value: '2019' } },
    );
    expect(screen.queryByRole('option', { name: '2020' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: '2019' }));

    expect(screen.getByTestId('stored')).toHaveTextContent('2019');
    expect(trigger).toHaveTextContent('2019');
  });

  it('lets the form focus the picker, e.g. on a validation error', async () => {
    render(<YearHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus year' }));
    // react-hook-form defers setFocus to the next tick.
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Year of manufacture' }),
      ).toHaveFocus(),
    );
  });
});
