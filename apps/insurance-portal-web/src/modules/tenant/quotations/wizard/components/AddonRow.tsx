import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createEmptyAddonTaxRow, type QuotationFormSchemaValues } from '../../schemas';
import { computeAddonAmounts } from '../utils/addonCalculations';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  index: number;
  onRemove: (index: number) => void;
  canRemove: boolean;
  exchangeRate: number;
}

function path(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `addons.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function AddonRow({ form, index, onRemove, canRemove, exchangeRate }: Props) {
  const taxFieldArray = useFieldArray({ control: form.control, name: `addons.${index}.taxes` });
  const enabled = form.watch(`addons.${index}.enabled` as const);
  const addon = form.watch(`addons.${index}` as const);
  const computed = computeAddonAmounts(addon, exchangeRate);

  return (
    <Card className={enabled ? undefined : 'opacity-60'}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Add-on #{index + 1}</CardTitle>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={(checked) => form.setValue(`addons.${index}.enabled` as const, checked)} />
            <span className="text-xs text-slate-500">{enabled ? 'Included' : 'Excluded'}</span>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField control={form.control} name={path(index, 'addon_reference')} render={({ field }) => (
            <FormItem>
              <FormLabel>Add-on Reference</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name={path(index, 'addon_desc')} render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name={path(index, 'addon_amount')} render={({ field }) => (
            <FormItem>
              <FormLabel>Insured Amount</FormLabel>
              <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name={path(index, 'addon_premium_rate')} render={({ field }) => (
            <FormItem>
              <FormLabel>Premium Rate (optional)</FormLabel>
              <FormControl><Input type="number" step="0.0001" {...field} value={field.value as string} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name={path(index, 'premium_excluding_tax')} render={({ field }) => (
            <FormItem>
              <FormLabel>Premium Excluding Tax</FormLabel>
              <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Taxes Charged</p>
            <Button type="button" variant="outline" size="sm" onClick={() => taxFieldArray.append(createEmptyAddonTaxRow())}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Tax
            </Button>
          </div>

          {taxFieldArray.fields.map((taxField, taxIndex) => (
            <div key={taxField.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-5">
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_code`)} render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Tax Code</FormLabel>
                  <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_rate`)} render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (e.g. 0.18)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      disabled={Boolean(form.watch(path(index, `taxes.${taxIndex}.is_tax_exempted`)))}
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.is_tax_exempted`)} render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Exempted</FormLabel>
                  <FormControl>
                    <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
              <div className="flex items-end justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => taxFieldArray.remove(taxIndex)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p>Excluding tax equivalent: {computed.premiumExcludingTaxEquivalent.toFixed(2)}</p>
          <p>Total tax: {computed.totalTax.toFixed(2)}</p>
          <p className="font-medium text-slate-900">Including tax: {computed.premiumIncludingTax.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
