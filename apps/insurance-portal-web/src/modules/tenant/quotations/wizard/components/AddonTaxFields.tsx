import type { FieldPath, UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  TAX_EXEMPTION_OPTIONS,
  TAX_EXEMPTION_TYPE_OPTIONS,
  type TaxRuleOption,
} from '../utils/taxOptions';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import { WizardFormItem } from './WizardFormItem';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  /** e.g. `addons.0` or `fleet.items.0.cover_note_addons.1` — no trailing dot. */
  basePath: string;
  taxRuleOptions: TaxRuleOption[];
  taxAmount: number;
}

function fieldPath(
  basePath: string,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `${basePath}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

/**
 * The tax-code/rate/exemption block shared by an add-on row, regardless of
 * whether it lives at `addons.{index}` (single/non-motor) or
 * `fleet.items.{itemIndex}.cover_note_addons.{index}` (fleet). Extracted from
 * AddonRow so fleet add-ons — which previously had no tax UI at all and
 * always submitted an empty `taxes` array — get the same capability.
 */
export function AddonTaxFields({
  form,
  basePath,
  taxRuleOptions,
  taxAmount,
}: Props) {
  return (
    <div className="space-y-1 border-t border-slate-100 pt-4">
      <p className="text-xs font-medium text-slate-500">Tax</p>
      <div className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4">
        <FormField
          control={form.control}
          name={fieldPath(basePath, 'taxes.0.tax_code')}
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Tax Code</FormLabel>
              <Select
                value={toSelectValue(field.value as string)}
                onValueChange={(value) => {
                  const nextValue = fromSelectValue(value);
                  field.onChange(nextValue);
                  form.setValue(
                    fieldPath(basePath, 'taxes.0.tax_rate'),
                    taxRuleOptions.find((option) => option.value === nextValue)
                      ?.rate ?? '',
                  );
                  if (value === SELECT_NONE_VALUE) {
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.is_tax_exempted'),
                      false,
                    );
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_type'),
                      '',
                    );
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_reference'),
                      '',
                    );
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
                  {taxRuleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name={fieldPath(basePath, 'taxes.0.tax_rate')}
          render={({ field }) => (
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />
        <WizardFormItem>
          <FormLabel>Tax Amount</FormLabel>
          <FormControl>
            <Input readOnly value={taxAmount.toFixed(2)} />
          </FormControl>
        </WizardFormItem>
        <FormField
          control={form.control}
          name={fieldPath(basePath, 'taxes.0.is_tax_exempted')}
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Exempted</FormLabel>
              <Select
                value={field.value ? 'Y' : 'N'}
                onValueChange={(value) => {
                  if (value === SELECT_NONE_VALUE) {
                    field.onChange(false);
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_type'),
                      '',
                    );
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_reference'),
                      '',
                    );
                    return;
                  }
                  const isExempted = value === 'Y';
                  field.onChange(isExempted);
                  if (!isExempted) {
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_type'),
                      '',
                    );
                    form.setValue(
                      fieldPath(basePath, 'taxes.0.tax_exemption_reference'),
                      '',
                    );
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
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name={fieldPath(basePath, 'taxes.0.tax_exemption_type')}
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <FormLabel>Exemption Type</FormLabel>
              <Select
                value={toSelectValue(field.value as string)}
                onValueChange={(value) =>
                  field.onChange(fromSelectValue(value))
                }
                disabled={
                  !form.watch(fieldPath(basePath, 'taxes.0.is_tax_exempted'))
                }
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
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name={fieldPath(basePath, 'taxes.0.tax_exemption_reference')}
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <FormLabel>Exemption Reference</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  disabled={
                    !form.watch(fieldPath(basePath, 'taxes.0.is_tax_exempted'))
                  }
                />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
      </div>
    </div>
  );
}
