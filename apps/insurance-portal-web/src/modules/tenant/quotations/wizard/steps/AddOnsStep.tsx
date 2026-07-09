import { Plus } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createEmptyAddonRow, type QuotationFormSchemaValues } from '../../schemas';
import { AddonRow } from '../components/AddonRow';
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Step 4. Add-ons</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append(createEmptyAddonRow())}>
            <Plus className="mr-2 h-4 w-4" />
            Add Add-on
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Add-ons are optional and only apply if this product/risk offers extra covers (e.g. windscreen,
            radio). There is no backend record for add-ons — they are carried straight through to the
            TIRAMIS cover note submission and excluded entirely if disabled below.
          </p>
        </CardContent>
      </Card>

      {fields.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No add-ons for this cover note. Click "Add Add-on" if this product offers one.
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <span className="text-slate-500">Enabled add-ons premium (including tax)</span>
            <span className="font-medium text-slate-900">{total.toFixed(2)}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
