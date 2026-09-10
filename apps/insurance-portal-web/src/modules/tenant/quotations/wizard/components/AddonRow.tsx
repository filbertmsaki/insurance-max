import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { usePricingCalculator } from '@/modules/pricing';
import { Trash2 } from 'lucide-react';
import type { QuotationFormSchemaValues } from '../../schemas';
import { computeAddonAmounts } from '../utils/addonCalculations';
import {
  TAX_EXEMPTION_OPTIONS,
  TAX_EXEMPTION_TYPE_OPTIONS,
  resolveTaxRuleOptions,
} from '../utils/taxOptions';
import { useActiveTaxRules } from '../hooks/useActiveTaxRules';
import { useProductAddonDefinitions } from '../hooks/useProductAddonDefinitions';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import { StepSection } from './StepSection';
import { WizardFormItem } from './WizardFormItem';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  index: number;
  onRemove: (index: number) => void;
  canRemove: boolean;
  exchangeRate: number;
}

function path(
  index: number,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `addons.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function AddonRow({
  form,
  index,
  onRemove,
  canRemove,
  exchangeRate,
}: Props) {
  const enabled = form.watch(`addons.${index}.enabled` as const);
  const addon = form.watch(`addons.${index}` as const);
  const computed = computeAddonAmounts(addon, exchangeRate);

  const categoryId = form.watch('category_id');
  const productId = form.watch('product_id');
  const validFrom = form.watch('valid_from');
  const companyId = useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId ?? '',
  );

  const addonDefinitionsQuery = useProductAddonDefinitions(
    productId || undefined,
  );
  const addonDefinitions = addonDefinitionsQuery.data ?? [];
  const selectedDefinition = addonDefinitions.find(
    (definition) => definition.id === addon.addon_definition_id,
  );

  const activeTaxRulesQuery = useActiveTaxRules(companyId || undefined);
  const taxRuleOptions = useMemo(
    () =>
      resolveTaxRuleOptions({
        rules: activeTaxRulesQuery.data,
        categoryId,
        productId,
        riskId: undefined,
        effectiveDate: validFrom,
      }),
    [activeTaxRulesQuery.data, categoryId, productId, validFrom],
  );
  const taxRuleOptionsKey = JSON.stringify(taxRuleOptions);

  useEffect(() => {
    const currentTaxCode = form.getValues(path(index, 'taxes.0.tax_code')) as
      | string
      | undefined;
    const selected = taxRuleOptions.find(
      (option) => option.value === currentTaxCode,
    );
    if (selected) form.setValue(path(index, 'taxes.0.tax_rate'), selected.rate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, index, taxRuleOptionsKey]);

  const { calculateSingleMutation } = usePricingCalculator();
  const [isCalculating, setIsCalculating] = useState(false);

  async function handleCalculate() {
    const risk = form.getValues('risks.0');
    if (!risk?.risk_id) {
      toast.error('Add a risk before calculating the add-on premium.');
      return;
    }
    if (!addon.addon_definition_id) {
      toast.error('Select an add-on first.');
      return;
    }
    if (selectedDefinition?.allowsSeparateSumInsured && !addon.addon_amount) {
      toast.error('Enter the add-on sum insured first.');
      return;
    }

    setIsCalculating(true);
    try {
      const currency = (form.getValues('currency') || 'TZS')
        .trim()
        .toUpperCase();
      const result = await calculateSingleMutation.mutateAsync({
        risk_id: risk.risk_id,
        factors: risk.factor_values ?? {},
        effective_date: form.getValues('valid_from'),
        currency_code: currency,
        exchange_rate:
          currency === 'TZS' ? 1 : Number(form.getValues('exchange_rate')) || 1,
        addons: [
          {
            addon_definition_id: addon.addon_definition_id,
            quantity: Number(addon.addon_quantity) || 1,
            sum_insured: selectedDefinition?.allowsSeparateSumInsured
              ? Number(addon.addon_amount) || 0
              : undefined,
          },
        ],
      });
      const addonResult = result.addon_results?.[0];
      if (!addonResult) {
        toast.error('No pricing rule is configured for this add-on yet.');
        return;
      }
      form.setValue(
        path(index, 'premium_excluding_tax'),
        String(addonResult.calculated_premium),
      );
      toast.success('Add-on premium calculated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <StepSection
      variant="item"
      className={enabled ? undefined : 'opacity-60'}
      title="Add-on"
      action={
        <div className="flex items-center gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={(checked) =>
              form.setValue(`addons.${index}.enabled` as const, checked)
            }
          />
          <span className="text-xs text-slate-500">
            {enabled ? 'Included' : 'Excluded'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={!canRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          control={form.control}
          name={path(index, 'addon_definition_id')}
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Add-on</FormLabel>
              <Select
                value={toSelectValue(field.value as string)}
                onValueChange={(value) => {
                  const nextValue = fromSelectValue(value);
                  const definition = addonDefinitions.find(
                    (item) => item.id === nextValue,
                  );
                  field.onChange(nextValue);
                  form.setValue(
                    path(index, 'addon_reference'),
                    definition?.code ?? '',
                  );
                  form.setValue(
                    path(index, 'addon_desc'),
                    definition?.name ?? '',
                  );
                  form.setValue(path(index, 'addon_quantity'), '1');
                  form.setValue(path(index, 'addon_amount'), '');
                  form.setValue(path(index, 'premium_excluding_tax'), '');
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select add-on" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {addonDefinitions.map((definitionOption) => (
                    <SelectItem
                      key={definitionOption.id}
                      value={definitionOption.id}
                    >
                      {definitionOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addonDefinitions.length === 0 && (
                <p className="text-xs text-slate-400">
                  No add-on covers are configured for this product.
                </p>
              )}
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name={path(index, 'addon_desc')}
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} value={field.value as string} readOnly />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        {selectedDefinition?.allowsSeparateSumInsured && (
          <FormField
            control={form.control}
            name={path(index, 'addon_amount')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Sum Insured</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        )}
        {selectedDefinition &&
          (selectedDefinition.maximumQuantity === null ||
            selectedDefinition.maximumQuantity > 1) && (
            <FormField
              control={form.control}
              name={path(index, 'addon_quantity')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={selectedDefinition.maximumQuantity ?? undefined}
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
          )}
        <FormField
          control={form.control}
          name={path(index, 'premium_excluding_tax')}
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Premium Excluding Tax</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value as string}
                  readOnly
                />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCalculate}
            disabled={isCalculating || !addon.addon_definition_id}
          >
            {isCalculating ? 'Calculating…' : 'Calculate'}
          </Button>
        </div>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-500">Tax</p>
        <div className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4">
          <FormField
            control={form.control}
            name={path(index, 'taxes.0.tax_code')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Tax Code</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    form.setValue(
                      path(index, 'taxes.0.tax_rate'),
                      taxRuleOptions.find(
                        (option) => option.value === nextValue,
                      )?.rate ?? '',
                    );
                    if (value === SELECT_NONE_VALUE) {
                      form.setValue(
                        path(index, 'taxes.0.is_tax_exempted'),
                        false,
                      );
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_type'),
                        '',
                      );
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_reference'),
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
            name={path(index, 'taxes.0.tax_rate')}
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
              <Input
                readOnly
                value={(computed.taxes[0]?.tax_amount ?? 0).toFixed(2)}
              />
            </FormControl>
          </WizardFormItem>
          <FormField
            control={form.control}
            name={path(index, 'taxes.0.is_tax_exempted')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Exempted</FormLabel>
                <Select
                  value={field.value ? 'Y' : 'N'}
                  onValueChange={(value) => {
                    if (value === SELECT_NONE_VALUE) {
                      field.onChange(false);
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_type'),
                        '',
                      );
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_reference'),
                        '',
                      );
                      return;
                    }
                    const isExempted = value === 'Y';
                    field.onChange(isExempted);
                    if (!isExempted) {
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_type'),
                        '',
                      );
                      form.setValue(
                        path(index, 'taxes.0.tax_exemption_reference'),
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
            name={path(index, 'taxes.0.tax_exemption_type')}
            render={({ field }) => (
              <WizardFormItem className="md:col-span-2">
                <FormLabel>Exemption Type</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) =>
                    field.onChange(fromSelectValue(value))
                  }
                  disabled={!form.watch(path(index, 'taxes.0.is_tax_exempted'))}
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
            name={path(index, 'taxes.0.tax_exemption_reference')}
            render={({ field }) => (
              <WizardFormItem className="md:col-span-2">
                <FormLabel>Exemption Reference</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value as string}
                    disabled={
                      !form.watch(path(index, 'taxes.0.is_tax_exempted'))
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <p>
          Excluding tax equivalent:{' '}
          {computed.premiumExcludingTaxEquivalent.toFixed(2)}
        </p>
        <p>Total tax: {computed.totalTax.toFixed(2)}</p>
        <p className="font-medium text-slate-900">
          Including tax: {computed.premiumIncludingTax.toFixed(2)}
        </p>
      </div>
    </StepSection>
  );
}
