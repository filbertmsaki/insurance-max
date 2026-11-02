import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Form } from '@/components/ui/form';
import {
  createEmptyFleetItemRow,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import { MotorFleetDetailsStep } from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { QuotationJourneyProgress } from '@/modules/tenant/quotations/wizard/QuotationJourneyProgress';
import { defaultValuesForLine } from '../wizard/defaults';
import { getUnderwriteLineMeta } from '../lines';

function renderWorkspace() {
  const duplicate = vi.fn();
  const remove = vi.fn();
  function Harness() {
    const defaults = defaultValuesForLine(
      getUnderwriteLineMeta(UnderwriteLine.FLEET),
    );
    const form = useForm<QuotationFormSchemaValues>({
      defaultValues: {
        ...defaults,
        fleet: {
          ...defaults.fleet,
          items: Array.from({ length: 12 }, (_, index) => {
            const item = createEmptyFleetItemRow();
            return {
              ...item,
              fleet_entry: String(index + 1),
              motor_dtl: {
                ...item.motor_dtl,
                registration_number:
                  'T' + String(index + 1).padStart(3, '0') + 'AAA',
                make: 'TOYOTA',
                model: 'HILUX',
              },
            };
          }),
        },
      },
    });
    const fieldArray = useFieldArray({
      control: form.control,
      name: 'fleet.items',
    });
    return (
      <Form {...form}>
        <MotorFleetDetailsStep
          form={form}
          customerOptions={[]}
          riskOptions={[]}
          vehicleOptions={[]}
          fieldArray={fieldArray}
          onAddVehicle={() => undefined}
          onRemoveVehicle={remove}
          onDuplicateVehicle={duplicate}
          onImportVehicles={() => undefined}
        />
      </Form>
    );
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Harness />
    </QueryClientProvider>,
  );
  return { duplicate, remove };
}

describe('Fleet vehicle workspace', () => {
  it('keeps actions attached to the original vehicle after searching', () => {
    const { duplicate, remove } = renderWorkspace();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search fleet vehicles' }),
      { target: { value: 'T012AAA' } },
    );
    const table = within(screen.getByRole('table'));
    expect(table.queryByText('T001AAA')).toBeNull();
    fireEvent.click(
      table.getByRole('button', { name: 'Duplicate vehicle 12' }),
    );
    fireEvent.click(table.getByRole('button', { name: 'Remove' }));
    expect(duplicate).toHaveBeenCalledWith(11);
    expect(remove).toHaveBeenCalledWith(11);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search fleet vehicles' }),
      { target: { value: '' } },
    );
    expect(table.getByText('T001AAA')).toBeInTheDocument();
    expect(table.queryByText('T012AAA')).toBeNull();
  });
  it('paginates the presentation without changing fleet entry numbers', () => {
    const { duplicate } = renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    const table = within(screen.getByRole('table'));
    expect(table.getByText('T011AAA')).toBeInTheDocument();
    expect(table.getByText('12')).toBeInTheDocument();
    fireEvent.click(
      table.getByRole('button', { name: 'Duplicate vehicle 12' }),
    );
    expect(duplicate).toHaveBeenCalledWith(11);
  });
  it('shows the current mobile step and disables steps that cannot be revisited', () => {
    const navigate = vi.fn();
    render(
      <QuotationJourneyProgress
        steps={[
          { id: 'customer', label: 'Customer & Cover' },
          { id: 'vehicles', label: 'Vehicles' },
          { id: 'premium', label: 'Premium' },
        ]}
        currentStep="vehicles"
        completedSteps={['customer']}
        onStepClick={navigate}
      />,
    );
    const picker = screen.getByRole('combobox', {
      name: 'Navigate quotation steps',
    });
    expect(
      within(picker).getByRole('option', { name: '3. Premium' }),
    ).toBeDisabled();
    fireEvent.change(picker, { target: { value: 'customer' } });
    expect(navigate).toHaveBeenCalledWith('customer');
  });
});
