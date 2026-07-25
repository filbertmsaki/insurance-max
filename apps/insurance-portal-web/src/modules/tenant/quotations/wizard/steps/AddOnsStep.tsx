import { Plus } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { createEmptyAddonRow, type QuotationFormSchemaValues } from '../../schemas';
import { AddonRow } from '../components/AddonRow';
import { StepSection } from '../components/StepSection';
import { sumEnabledAddonsTotal } from '../utils/addonCalculations';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'addons'>;
}

export function AddOnsStep({ form, fieldArray }: Props) {
  const { fields, append, remove } = fieldArray;
  const currency = form.watch('currency')?.trim().toUpperCase();
  const exchangeRate = currency && currency !== 'TZS' ? Number(form.watch('exchange_rate')) || 1 : 1;
  const addons = form.watch('addons');
  const total = sumEnabledAddonsTotal(addons, exchangeRate);

  return (
    <StepSection
      title="Step 4. Add-ons"
      first
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => append(createEmptyAddonRow())}>
          <Plus className="mr-2 h-4 w-4" />
          Add Add-on
        </Button>
      }
    >
      <p className="text-sm text-slate-500">
        Add-ons are optional and only apply if this product/risk offers extra covers (e.g. windscreen,
        radio). There is no backend record for add-ons — they are carried straight through to the
        TIRAMIS cover note submission and excluded entirely if disabled below.
      </p>

      {fields.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No add-ons for this cover note. Click "Add Add-on" if this product offers one.
        </p>
      )}

      {fields.map((field, index) => (
        <AddonRow
          key={field.id}
          form={form}
          index={index}
          onRemove={remove}
          canRemove
          exchangeRate={exchangeRate}
        />
      ))}

      {fields.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">Enabled add-ons premium (including tax)</span>
          <span className="font-medium text-slate-900">{total.toFixed(2)}</span>
        </div>
      )}
    </StepSection>
  );
}
