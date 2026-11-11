import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { appBarStore } from '@/components/layout/app-bar/appBarStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Form } from '@/components/ui/form';
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { defaultValuesForLine } from '@/modules/tenant/underwrite/wizard/defaults';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import { MOTOR_WIZARD_STEPS } from '../wizard/SingleMotorQuotationWizard';
import { MobileQuotationShell } from '../wizard/mobile/MobileQuotationShell';
import { MobileVehicleForm } from '../wizard/mobile/MobileVehicleForm';
import {
  FLEET_TO_MOBILE,
  MOBILE_FLEET_STEPS,
  MOBILE_SHORT_TERM_FLEET_STEPS,
  MOBILE_SHORT_TERM_SINGLE_STEPS,
  MOBILE_SINGLE_STEPS,
  MOBILE_TO_FLEET,
  MOBILE_TO_SINGLE,
  SINGLE_TO_MOBILE,
} from '../wizard/mobile/mobileSteps';

vi.mock('@/modules/platform/reference-data/hooks', () => ({
  useVehicleReference: () => ({ data: [] }),
}));

describe('mobile motor quotation steps', () => {
  it('has three steps for every type', () => {
    for (const steps of [
      MOBILE_SINGLE_STEPS,
      MOBILE_FLEET_STEPS,
      MOBILE_SHORT_TERM_SINGLE_STEPS,
      MOBILE_SHORT_TERM_FLEET_STEPS,
    ]) {
      expect(steps).toHaveLength(3);
    }
  });

  it('validates every field the desktop Single Motor wizard validates', () => {
    const mobile = new Set(MOBILE_SINGLE_STEPS.flatMap((step) => step.fields));
    const missing = MOTOR_WIZARD_STEPS.flatMap((step) => step.fields).filter(
      (field) => !mobile.has(field),
    );
    expect(missing).toEqual([]);
  });

  it('reopens drafts across the phone and desktop layouts', () => {
    const singleMobile = new Set(MOBILE_SINGLE_STEPS.map((step) => step.id));
    Object.values(SINGLE_TO_MOBILE).forEach((id) =>
      expect(singleMobile.has(id)).toBe(true),
    );
    const singleDesktop = new Set(MOTOR_WIZARD_STEPS.map((step) => step.id));
    Object.values(MOBILE_TO_SINGLE).forEach((id) =>
      expect(singleDesktop.has(id)).toBe(true),
    );
    const fleetMobile = new Set(MOBILE_FLEET_STEPS.map((step) => step.id));
    Object.values(FLEET_TO_MOBILE).forEach((id) =>
      expect(fleetMobile.has(id)).toBe(true),
    );
    expect(Object.keys(MOBILE_TO_FLEET)).toEqual([...fleetMobile.values()]);
  });
});

function makeWizard(
  form: ReturnType<typeof useForm<QuotationFormSchemaValues>>,
  stepId: string,
  overrides: Partial<UnderwriteQuotationWizard> = {},
) {
  return {
    form,
    steps: MOBILE_SINGLE_STEPS,
    stepId,
    isLoading: false,
    isEditMode: false,
    isHydrating: false,
    isSaving: false,
    loadError: null,
    hasProduct: true,
    goToStep: vi.fn(async () => undefined),
    goBack: vi.fn(),
    saveDraft: vi.fn(),
    complete: vi.fn(),
    ...overrides,
  } as unknown as UnderwriteQuotationWizard;
}

function renderShell({
  stepId = 'm-vehicle',
  ready = false,
  onExit = vi.fn(),
  overrides = {},
}: {
  stepId?: string;
  ready?: boolean;
  onExit?: () => void;
  overrides?: Partial<UnderwriteQuotationWizard>;
} = {}) {
  let wizard: UnderwriteQuotationWizard | undefined;
  function Harness() {
    const form = useForm<QuotationFormSchemaValues>({
      defaultValues: {
        ...defaultValuesForLine(getUnderwriteLineMeta(UnderwriteLine.MOTOR)),
        customer_id: 'customer-1',
      },
    });
    wizard = makeWizard(form, stepId, overrides);
    return (
      <MobileQuotationShell
        wizard={wizard}
        title="New single motor quotation"
        onExit={onExit}
        steps={[
          {
            id: 'm-cover',
            label: 'Cover',
            primaryLabel: 'Next: Vehicle',
            ready: true,
          },
          {
            id: 'm-vehicle',
            label: 'Vehicle',
            primaryLabel: 'Next: Review',
            ready,
          },
          {
            id: 'm-review',
            label: 'Review',
            primaryLabel: 'Create quotation',
            ready: true,
          },
        ]}
        renderStep={(id) => <p>Content {id}</p>}
      />
    );
  }
  render(<Harness />);
  return { wizard: () => wizard!, onExit };
}

describe('MobileQuotationShell', () => {
  it('shows the step label, title, progress and one primary action', () => {
    renderShell();

    // Step label, title and back arrow sit in the shared app bar.
    expect(appBarStore.get().config).toMatchObject({
      variant: 'inner',
      title: 'New single motor quotation',
      subtitle: 'Step 2 of 3 · Vehicle',
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    expect(
      screen.getAllByRole('button', { name: 'Next: Review' }),
    ).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Save draft' })).toHaveLength(
      1,
    );
    expect(screen.getByText('Content m-vehicle')).toBeVisible();
    expect(screen.getByText('Content m-cover')).not.toBeVisible();
  });

  it('marks the primary action disabled until the step is valid', () => {
    renderShell({ ready: false });
    expect(
      screen.getByRole('button', { name: 'Next: Review' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('moves to the next step through the wizard validation', async () => {
    const { wizard } = renderShell({ ready: true });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review' }));
    await vi.waitFor(() =>
      expect(wizard().goToStep).toHaveBeenCalledWith('m-review'),
    );
  });

  it('goes back a step, and from step 1 back to the type selection', () => {
    const { wizard } = renderShell();
    act(() => appBarStore.back());
    expect(wizard().goBack).toHaveBeenCalled();
  });

  it('leaves for the type selection from step 1', () => {
    const onExit = vi.fn();
    renderShell({ stepId: 'm-cover', onExit });
    act(() => appBarStore.back());
    expect(onExit).toHaveBeenCalled();
  });

  it('creates the quotation on the review step', () => {
    const { wizard } = renderShell({ stepId: 'm-review' });
    fireEvent.click(screen.getByRole('button', { name: 'Create quotation' }));
    expect(wizard().complete).toHaveBeenCalled();
  });
});

function renderVehicleForm() {
  function Harness() {
    const form = useForm<QuotationFormSchemaValues>({
      defaultValues: defaultValuesForLine(
        getUnderwriteLineMeta(UnderwriteLine.MOTOR),
      ),
    });
    return (
      <Form {...form}>
        <form>
          <MobileVehicleForm form={form} />
        </form>
      </Form>
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('MobileVehicleForm', () => {
  it('shows the registration number only for registered vehicles', () => {
    renderVehicleForm();
    const motorType = screen.getByRole('radiogroup', { name: 'Motor type' });

    fireEvent.click(
      within(motorType).getByRole('radio', { name: 'Registered' }),
    );
    expect(screen.getByText('Registration number')).toBeInTheDocument();
    expect(screen.getByText('Chassis number')).toBeInTheDocument();

    fireEvent.click(
      within(motorType).getByRole('radio', { name: 'Unregistered' }),
    );
    expect(screen.queryByText('Registration number')).not.toBeInTheDocument();
    expect(screen.getByText('Chassis number')).toBeInTheDocument();
  });

  it('groups details in collapsible cards with a status', () => {
    renderVehicleForm();
    const engine = screen.getByRole('button', { name: /Engine & capacity/ });
    expect(engine).toHaveAttribute('aria-expanded', 'false');
    expect(within(engine).getByText('Details needed')).toBeInTheDocument();
    fireEvent.click(engine);
    expect(engine).toHaveAttribute('aria-expanded', 'true');
  });

  it('treats the policyholder as the owner by default', () => {
    renderVehicleForm();
    fireEvent.click(screen.getByRole('button', { name: /^Owner/ }));
    const toggle = screen.getByRole('switch', {
      name: 'Owner is the policyholder',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Owner address')).toBeInTheDocument();
  });
});
