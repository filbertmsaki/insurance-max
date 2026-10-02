import { useEffect } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { taxesApi } from '@/modules/tenant/taxes/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  createEmptyRiskTaxRow,
  type QuotationFormSchemaValues,
} from '../../schemas';
import {
  computeTaxAmount,
  computePremiumIncludingTax,
  toNumber,
} from '../utils/premiumAggregation';
import { formatRatePercent } from '../utils/taxOptions';
import { WizardFormItem } from './WizardFormItem';

type RiskPath =
  | `risks.${number}`
  | `fleet.items.${number}.risks_covered.${number}`;
export function RiskTaxesFields({
  form,
  riskPath,
  inline = false,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskPath: RiskPath;
  /** Render fields directly into the parent grid (no own section/heading). */
  inline?: boolean;
}) {
  const companyId = useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId,
  );
  const query = useQuery({
    queryKey: ['taxes', companyId, 'active'],
    queryFn: taxesApi.active,
    enabled: !!companyId,
    staleTime: 30_000,
  });
  const name = `${riskPath}.taxes_charged` as const;
  const array = useFieldArray({ control: form.control, name });
  const rows = useWatch({ control: form.control, name });
  const premium = useWatch({
    control: form.control,
    name: `${riskPath}.premium_excluding_tax_equivalent` as const,
  });
  useEffect(() => {
    const defaultTax = query.data?.find((tax) => tax.is_default);
    const current = form.getValues(name) ?? [];
    if (defaultTax && current.length === 0) {
      form.setValue(
        name,
        [
          {
            ...createEmptyRiskTaxRow(),
            tax_code: defaultTax.tax_code,
            tax_rate: defaultTax.tax_rate,
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
      return;
    }
    if (
      defaultTax &&
      current.length === 1 &&
      !current[0]?.tax_code?.trim() &&
      !current[0]?.is_tax_exempted
    ) {
      form.setValue(`${name}.0.tax_code`, defaultTax.tax_code, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue(`${name}.0.tax_rate`, defaultTax.tax_rate, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    const updated = current.map((row, index) => {
      const tax = query.data?.find((item) => item.tax_code === row.tax_code);
      const rate = tax?.tax_rate ?? row.tax_rate ?? '';
      if (tax && (!row.tax_rate || toNumber(row.tax_rate) !== Number(rate)))
        form.setValue(`${name}.${index}.tax_rate`, rate);
      const amount =
        row.tax_code && premium !== ''
          ? String(computeTaxAmount(premium, rate, row.is_tax_exempted))
          : '';
      if (row.tax_amount !== amount)
        form.setValue(`${name}.${index}.tax_amount`, amount);
      return { ...row, tax_amount: amount };
    });
    const total =
      premium === ''
        ? ''
        : String(computePremiumIncludingTax(premium, updated));
    if (form.getValues(`${riskPath}.premium_including_tax`) !== total)
      form.setValue(`${riskPath}.premium_including_tax`, total);
  }, [form, name, premium, query.data, riskPath, rows]);

  return (
    <div className={inline ? 'contents' : 'space-y-2'}>
      {!inline && <p className="text-sm font-medium">Tax</p>}
      {query.isError && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {getApiErrorMessage(query.error)}{' '}
          <Button
            type="button"
            variant="link"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {!query.isLoading && !query.isError && !query.data?.length && (
        <p className="col-span-full text-sm text-slate-500">
          No active taxes. Add them in Taxes management.
        </p>
      )}
      {array.fields.map((_, index) => (
        <div
          key={index}
          className={
            inline ? 'contents' : 'grid items-end gap-3 md:grid-cols-[2fr_1fr]'
          }
        >
          <FormField
            control={form.control}
            name={`${name}.${index}.tax_code`}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Tax</FormLabel>
                <Select
                  value={field.value || '__none__'}
                  onValueChange={(value) => {
                    const code = value === '__none__' ? '' : value;
                    field.onChange(code);
                    form.setValue(
                      `${name}.${index}.tax_rate`,
                      query.data?.find((tax) => tax.tax_code === code)
                        ?.tax_rate ?? '',
                    );
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tax" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {field.value &&
                      !query.data?.some(
                        (tax) => tax.tax_code === field.value,
                      ) && (
                        <SelectItem value={field.value} disabled>
                          {field.value} (unavailable)
                        </SelectItem>
                      )}
                    {query.data?.map((tax) => (
                      <SelectItem
                        key={tax.id}
                        value={tax.tax_code}
                        disabled={rows?.some(
                          (item, otherIndex) =>
                            otherIndex !== index &&
                            item.tax_code === tax.tax_code,
                        )}
                      >
                        {tax.tax_name} ({formatRatePercent(tax.tax_rate)}%)
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
            name={`${name}.${index}.is_tax_exempted`}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Exempted</FormLabel>
                <Select
                  value={field.value ? 'Y' : 'N'}
                  onValueChange={(value) => {
                    field.onChange(value === 'Y');
                    if (value === 'N') {
                      form.setValue(`${name}.${index}.tax_exemption_type`, '');
                      form.setValue(
                        `${name}.${index}.tax_exemption_reference`,
                        '',
                      );
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="N">No</SelectItem>
                    <SelectItem value="Y">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          {rows?.[index]?.is_tax_exempted && (
            <>
              <FormField
                control={form.control}
                name={`${name}.${index}.tax_exemption_type`}
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel>Exemption type</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exemption type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Policyholder exempted</SelectItem>
                        <SelectItem value="2">Risk exempted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </WizardFormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${name}.${index}.tax_exemption_reference`}
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel>Exemption reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </WizardFormItem>
                )}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
