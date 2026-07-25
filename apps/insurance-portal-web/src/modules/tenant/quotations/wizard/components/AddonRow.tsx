import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import { createEmptyAddonTaxRow, type QuotationFormSchemaValues } from '../../schemas';
import { computeAddonAmounts } from '../utils/addonCalculations';
import {
  TAX_CODE_OPTIONS,
  TAX_EXEMPTION_OPTIONS,
  TAX_EXEMPTION_TYPE_OPTIONS,
  getTaxRateForCode,
} from '../utils/taxOptions';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import { StepSection } from './StepSection';

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

  useEffect(() => {
    addon.taxes.forEach((tax, taxIndex) => {
      const expectedRate = getTaxRateForCode(tax.tax_code);
      if (expectedRate && tax.tax_rate !== expectedRate) {
        form.setValue(path(index, `taxes.${taxIndex}.tax_rate`), expectedRate);
      }
    });
  }, [addon.taxes, form, index]);

  return (
    <StepSection
      variant="item"
      className={enabled ? undefined : 'opacity-60'}
      title={`Add-on #${index + 1}`}
      action={
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={(checked) => form.setValue(`addons.${index}.enabled` as const, checked)} />
          <span className="text-xs text-slate-500">{enabled ? 'Included' : 'Excluded'}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} disabled={!canRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
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
            <div key={taxField.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4">
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_code`)} render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Code</FormLabel>
                  <Select
                    value={toSelectValue(field.value as string)}
                    onValueChange={(value) => {
                      const nextValue = fromSelectValue(value);
                      field.onChange(nextValue);
                      form.setValue(
                        path(index, `taxes.${taxIndex}.tax_rate`),
                        getTaxRateForCode(nextValue),
                      );
                      if (value === SELECT_NONE_VALUE) {
                        form.setValue(path(index, `taxes.${taxIndex}.is_tax_exempted`), false);
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_type`), '');
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_reference`), '');
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax code" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {TAX_CODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_rate`)} render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Rate</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      readOnly
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormItem>
                <FormLabel>Tax Amount</FormLabel>
                <FormControl>
                  <Input
                    readOnly
                    value={(computed.taxes[taxIndex]?.tax_amount ?? 0).toFixed(2)}
                  />
                </FormControl>
              </FormItem>
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.is_tax_exempted`)} render={({ field }) => (
                <FormItem>
                  <FormLabel>Exempted</FormLabel>
                  <Select
                    value={field.value ? 'Y' : 'N'}
                    onValueChange={(value) => {
                      if (value === SELECT_NONE_VALUE) {
                        field.onChange(false);
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_type`), '');
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_reference`), '');
                        return;
                      }
                      const isExempted = value === 'Y';
                      field.onChange(isExempted);
                      if (!isExempted) {
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_type`), '');
                        form.setValue(path(index, `taxes.${taxIndex}.tax_exemption_reference`), '');
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {TAX_EXEMPTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_exemption_type`)} render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Exemption Type</FormLabel>
                  <Select
                    value={toSelectValue(field.value as string)}
                    onValueChange={(value) => field.onChange(fromSelectValue(value))}
                    disabled={!form.watch(path(index, `taxes.${taxIndex}.is_tax_exempted`))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select exemption type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {TAX_EXEMPTION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name={path(index, `taxes.${taxIndex}.tax_exemption_reference`)} render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Exemption Reference</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value as string}
                      disabled={!form.watch(path(index, `taxes.${taxIndex}.is_tax_exempted`))}
                    />
                  </FormControl>
                  <FormMessage />
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
    </StepSection>
  );
}
