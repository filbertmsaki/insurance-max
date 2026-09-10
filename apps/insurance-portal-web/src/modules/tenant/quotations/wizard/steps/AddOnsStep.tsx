import { useState } from 'react';
import { useForm, useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const { fields, append, remove } = fieldArray;
  const [open, setOpen] = useState(false);
  const draftForm = useForm<QuotationFormSchemaValues>();
  const draftAddon = useWatch({ control: draftForm.control, name: 'addons.0' });
  const currency = form.watch('currency')?.trim().toUpperCase();
  const exchangeRate =
    currency && currency !== 'TZS'
      ? Number(form.watch('exchange_rate')) || 1
      : 1;
  const addons = form.watch('addons');
  const total = sumEnabledAddonsTotal(addons, exchangeRate);

  const openAddDialog = () => {
    draftForm.reset({ ...form.getValues(), addons: [createEmptyAddonRow()] });
    setOpen(true);
  };
  const canAdd = !!draftAddon?.addon_definition_id &&
    draftAddon.premium_excluding_tax !== '' &&
    Number.isFinite(Number(draftAddon.premium_excluding_tax)) &&
    Number(draftAddon.premium_excluding_tax) >= 0;

  return (
    <StepSection
      title={
        form.watch('quotation_type') === 'MOTOR' && !form.watch('is_fleet')
          ? 'Step 5. Add-ons'
          : 'Step 4. Add-ons'
      }
      first
      action={<Button type="button" variant="outline" onClick={openAddDialog}>
        <Plus className="mr-2 h-4 w-4" />Add add-on
      </Button>}
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
          onRemove={remove}
          canRemove
          exchangeRate={exchangeRate}
        />
      ))}

      {fields.length === 0 && <p className="py-4 text-sm text-slate-500">
        No add-ons added. Use Add add-on to include extra cover.
      </p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add add-on to cover note</DialogTitle>
            <DialogDescription>Select an add-on and calculate its premium before adding it.</DialogDescription>
          </DialogHeader>
          <Form {...draftForm}>
            <AddonRow form={draftForm} index={0} onRemove={() => undefined}
              canRemove={false} exchangeRate={exchangeRate} />
          </Form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!canAdd} onClick={() => {
              if (!canAdd) return;
              append(draftForm.getValues('addons.0'));
              setOpen(false);
            }}>Add to cover note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
