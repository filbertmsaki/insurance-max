import { useEffect } from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import {
  createEmptyAddonRow,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { AddonRow } from '../components/AddonRow';
import { StepSection } from '../components/StepSection';
import { sumEnabledAddonsTotal } from '../utils/addonCalculations';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'addons'>;
}

export function AddOnsStep({ form, fieldArray }: Props) {
  const { fields, append } = fieldArray;
  const currency = form.watch('currency')?.trim().toUpperCase();
  const exchangeRate =
    currency && currency !== 'TZS'
      ? Number(form.watch('exchange_rate')) || 1
      : 1;
  const addons = form.watch('addons');
  const total = sumEnabledAddonsTotal(addons, exchangeRate);

  // A quotation carries at most one add-on. Ensure the single slot exists
  // (toggle it off via the Included/Excluded switch rather than removing
  // the row) instead of offering an "Add Add-on" affordance for more.
  useEffect(() => {
    if (fields.length === 0) {
      append(createEmptyAddonRow());
    }
  }, [fields.length, append]);

  return (
    <StepSection
      title={
        form.watch('quotation_type') === 'MOTOR' && !form.watch('is_fleet')
          ? 'Step 5. Add-ons'
          : 'Step 4. Add-ons'
      }
      first
    >
      <p className="text-sm text-slate-500">
        An add-on is optional and only applies if this product/risk offers an
        extra cover (e.g. windscreen, radio) — priced from the product's own
        configured add-on rules. Toggle it off below if not needed.
      </p>

      {fields.map((_, index) => (
        <AddonRow
          key={index}
          form={form}
          index={index}
          onRemove={() => {
            /* capped to one slot — toggle Included/Excluded instead of removing */
          }}
          canRemove={false}
          exchangeRate={exchangeRate}
        />
      ))}

      {fields.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">
            Enabled add-on premium (including tax)
          </span>
          <span className="font-medium text-slate-900">{total.toFixed(2)}</span>
        </div>
      )}
    </StepSection>
  );
}
