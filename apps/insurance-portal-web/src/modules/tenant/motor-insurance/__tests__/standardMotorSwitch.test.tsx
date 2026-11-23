import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import {
  StandardMotorModeToggle,
  useStandardMotorSwitch,
} from '../wizard/MotorModeToggle';

const CARRY = {
  customer_id: 'cust-1',
  policyholder_mode: 'existing',
  policyholder: { name: 'Acme Ltd' },
  valid_from: '2026-12-01',
};

function setup(state?: unknown, isEditMode = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter
      initialEntries={[{ pathname: '/apps/motor/quotations/new', state }]}
    >
      {children}
    </MemoryRouter>
  );
  return renderHook(
    () => {
      const form = useForm({ defaultValues: {} as never });
      const wizard = {
        form,
        companyId: 'company-1',
        isEditMode,
      } as unknown as UnderwriteQuotationWizard;
      return {
        form,
        location: useLocation(),
        switchMode: useStandardMotorSwitch(wizard),
      };
    },
    { wrapper },
  );
}

describe('useStandardMotorSwitch', () => {
  it('sends the customer and start date with the switch', () => {
    const { result } = setup();
    act(() => {
      for (const [key, value] of Object.entries(CARRY)) {
        result.current.form.setValue(key as never, value as never);
      }
    });
    act(() => result.current.switchMode('fleet'));

    expect(result.current.location.search).toBe('?type=fleet');
    expect(result.current.location.state).toEqual({
      standardMotorCarry: CARRY,
    });
  });

  it('restores carried values in the new wizard', () => {
    const { result } = setup({ standardMotorCarry: CARRY });
    const values = result.current.form.getValues() as Record<string, unknown>;
    expect(values.customer_id).toBe('cust-1');
    expect(values.policyholder).toEqual({ name: 'Acme Ltd' });
    expect(values.valid_from).toBe('2026-12-01');
  });

  it('does not overwrite a quotation being edited', () => {
    const { result } = setup({ standardMotorCarry: CARRY }, true);
    const values = result.current.form.getValues() as Record<string, unknown>;
    expect(values.customer_id).toBeUndefined();
  });
});

describe('StandardMotorModeToggle', () => {
  function renderToggle(
    permissions: string[],
    wizard: { isEditMode?: boolean; draftId?: string | null } = {},
  ) {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        companyId: 'company-1',
        roles: ['UNDERWRITER'],
        permissions,
        scope: 'company',
      },
    } as never);
    const onSwitch = vi.fn();
    render(
      <StandardMotorModeToggle
        wizard={
          {
            isEditMode: false,
            draftId: null,
            ...wizard,
          } as unknown as UnderwriteQuotationWizard
        }
        mode="single"
        onSwitch={onSwitch}
      />,
    );
    return onSwitch;
  }

  const BOTH = [
    'quotations:create',
    'underwrite.motor.create',
    'underwrite.fleet.create',
  ];

  it('switches to Fleet before the draft is saved', () => {
    const onSwitch = renderToggle(BOTH);
    fireEvent.click(screen.getByRole('radio', { name: /Fleet/ }));
    expect(onSwitch).toHaveBeenCalledWith('fleet');
  });

  it('is hidden when the user may create only one of Single or Fleet', () => {
    renderToggle(['quotations:create', 'underwrite.motor.create']);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('locks once the draft is saved', () => {
    const onSwitch = renderToggle(BOTH, { draftId: 'draft-1' });
    const fleet = screen.getByRole('radio', { name: /Fleet/ });
    expect(fleet).toBeDisabled();
    fireEvent.click(fleet);
    expect(onSwitch).not.toHaveBeenCalled();
    expect(
      screen.getByText('The mode is fixed once the draft is saved.'),
    ).toBeInTheDocument();
  });

  it('shows locked when editing, even with one permission', () => {
    renderToggle(['quotations:create', 'underwrite.motor.create'], {
      isEditMode: true,
    });
    expect(screen.getByRole('radio', { name: /Fleet/ })).toBeDisabled();
  });
});
