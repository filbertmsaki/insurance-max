import { CarFront, Truck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import { motorInsurancePaths } from '../paths';
import { useCanCreateMotorKind } from './mobile/useCanCreateMotorKind';

export type MotorCoverMode = 'single' | 'fleet';

/**
 * Single / Fleet switch on the first step of the Standard Motor Cover and
 * Short-Term wizards. Locked (no `onChange`) once the draft is saved, because
 * the line cannot change on a saved quotation.
 */
export function MotorModeToggle({
  mode,
  onChange,
  ariaLabel = 'Cover mode',
}: {
  mode: MotorCoverMode;
  onChange?: (mode: MotorCoverMode) => void;
  ariaLabel?: string;
}) {
  const options = [
    { value: 'single' as const, label: 'Single', icon: CarFront },
    { value: 'fleet' as const, label: 'Fleet', icon: Truck },
  ];
  return (
    <div className="space-y-1">
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-auto"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const active = value === mode;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!onChange && !active}
              onClick={() => !active && onChange?.(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-5 py-1.5 text-sm font-medium transition sm:flex-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                active
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        {onChange
          ? mode === 'fleet'
            ? 'Two or more vehicles, each with its own cover note.'
            : 'One vehicle under one cover note.'
          : 'The mode is fixed once the draft is saved.'}
      </p>
    </div>
  );
}

/** Values kept when the user flips between Single and Fleet before saving. */
type Carry = Pick<
  QuotationFormSchemaValues,
  'customer_id' | 'policyholder_mode' | 'policyholder' | 'valid_from'
>;

interface CarryState {
  standardMotorCarry?: Carry;
}

/**
 * Standard Motor Cover: Single and Fleet are separate wizards on separate
 * lines, so switching swaps the `?type=`. The customer and start date travel
 * in the navigation state and are restored once the new wizard has loaded,
 * the same fields Short-Term keeps across its switch.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStandardMotorSwitch(wizard: UnderwriteQuotationWizard) {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, companyId, isEditMode } = wizard;
  const carry = (location.state as CarryState | null)?.standardMotorCarry;

  const restoredRef = useRef(false);
  useEffect(() => {
    // Wait for the company: the wizard resets the form when it arrives.
    if (restoredRef.current || !companyId || isEditMode) return;
    restoredRef.current = true;
    if (!carry) return;
    form.setValue('policyholder_mode', carry.policyholder_mode);
    form.setValue('customer_id', carry.customer_id);
    form.setValue('policyholder', carry.policyholder);
    if (carry.valid_from) form.setValue('valid_from', carry.valid_from);
  }, [carry, companyId, form, isEditMode]);

  return (next: MotorCoverMode) => {
    const values = form.getValues();
    const state: CarryState = {
      standardMotorCarry: {
        customer_id: values.customer_id,
        policyholder_mode: values.policyholder_mode,
        policyholder: values.policyholder,
        valid_from: values.valid_from,
      },
    };
    navigate(motorInsurancePaths.quotationCreate(next), {
      replace: true,
      state,
    });
  };
}

/**
 * Desktop Single / Fleet switch for Standard Motor Cover. Shown when the user
 * may create both, or locked on a saved draft / edit.
 */
export function StandardMotorModeToggle({
  wizard,
  mode,
  onSwitch,
}: {
  wizard: UnderwriteQuotationWizard;
  mode: MotorCoverMode;
  onSwitch: (mode: MotorCoverMode) => void;
}) {
  const canCreate = useCanCreateMotorKind();
  const locked = wizard.isEditMode || Boolean(wizard.draftId);
  if (!locked && !(canCreate('single') && canCreate('fleet'))) return null;
  return (
    <MotorModeToggle
      mode={mode}
      ariaLabel="Standard motor cover mode"
      onChange={locked ? undefined : onSwitch}
    />
  );
}
