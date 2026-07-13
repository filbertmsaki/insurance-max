import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import {
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
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
import type { InsuranceRisk } from '@/types/product-engine';
import {
  createEmptyRiskDiscountRow,
  createEmptyRiskTaxRow,
  type QuotationFormSchemaValues,
} from '../../schemas';
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

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  index: number;
  riskOptions: InsuranceRisk[];
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const DISCOUNT_TYPE_OPTIONS = [
  { value: '1', label: '1. Fleet discount' },
] as const;
const EMPTY_TAX_ROWS: QuotationFormSchemaValues['risks'][number]['taxes_charged'] =
  [];

function path(
  index: number,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `risks.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RiskRow({
  form,
  index,
  riskOptions,
  onRemove,
  canRemove,
}: Props) {
  const riskId = form.watch(`risks.${index}.risk_id` as const);
  const selectedRisk = riskOptions.find((risk) => risk.id === riskId) ?? null;
  const discountFieldArray =
    form.getValues(`risks.${index}.discounts_offered` as const) ?? [];
  const taxFieldArray =
    form.getValues(`risks.${index}.taxes_charged` as const) ?? [];

  useEffect(() => {
    form.setValue(path(index, 'risk_code'), selectedRisk?.risk_code ?? '');
  }, [form, index, selectedRisk?.risk_code]);

  const discounts =
    form.watch(`risks.${index}.discounts_offered` as const) ?? [];
  const watchedTaxes = useWatch({
    control: form.control,
    name: `risks.${index}.taxes_charged` as const,
  });
  const taxes = watchedTaxes ?? EMPTY_TAX_ROWS;
  const premiumAfterDiscount = form.watch(
    `risks.${index}.premium_after_discount` as const,
  );
  const premiumIncludingTax = form.watch(
    `risks.${index}.premium_including_tax` as const,
  );
  const sumInsuredEquivalent = form.watch(
    `risks.${index}.sum_insured_equivalent` as const,
  );

  const totalDiscount = discounts.reduce(
    (sum, row) => sum + toNumber(row.discount_amount),
    0,
  );
  const totalTax = taxes.reduce(
    (sum, row) => sum + toNumber(row.tax_amount),
    0,
  );
  const premiumAfterDiscountValue = toNumber(premiumAfterDiscount);
  const premiumIncludingTaxValue =
    toNumber(premiumIncludingTax) || premiumAfterDiscountValue + totalTax;
  const sumInsuredEquivalentValue =
    toNumber(sumInsuredEquivalent) ||
    toNumber(form.watch(`risks.${index}.sum_insured` as const));

  useEffect(() => {
    taxes.forEach((tax, taxIndex) => {
      const expectedRate = getTaxRateForCode(tax.tax_code);
      if (expectedRate && tax.tax_rate !== expectedRate) {
        form.setValue(
          path(index, `taxes_charged.${taxIndex}.tax_rate`),
          expectedRate,
        );
      }
    });
  }, [form, index, taxes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Risk #{index + 1}{' '}
          {selectedRisk ? (
            <span className="text-slate-500">- {selectedRisk.risk_code}</span>
          ) : null}
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={path(index, 'risk_id')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => field.onChange(fromSelectValue(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {riskOptions.map((risk) => (
                      <SelectItem key={risk.id} value={risk.id}>
                        {risk.risk_name} ({risk.risk_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={path(index, 'risk_code')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Code</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value as string} readOnly />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={path(index, 'sum_insured')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'sum_insured_equivalent')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured Equivalent</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_rate')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Rate</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.000001"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_before_discount')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Before Discount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_after_discount')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium After Discount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_excluding_tax_equivalent')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Excluding Tax Equivalent</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_including_tax')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Including Tax</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Discounts Offered (optional)
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                form.setValue(path(index, 'discounts_offered'), [
                  ...discountFieldArray,
                  createEmptyRiskDiscountRow(),
                ])
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Discount
            </Button>
          </div>

          {discountFieldArray.length > 0 ? (
            <div className="space-y-3">
              {discountFieldArray.map((_, discountIndex) => (
                <div
                  key={discountIndex}
                  className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4"
                >
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.discount_type`,
                    )}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Type</FormLabel>
                        <Select
                          value={toSelectValue(field.value as string)}
                          onValueChange={(value) => {
                            const nextValue = fromSelectValue(value);
                            field.onChange(nextValue);
                            if (value === SELECT_NONE_VALUE) {
                              form.setValue(
                                path(index, `discounts_offered.${discountIndex}.discount_rate`),
                                '',
                              );
                              form.setValue(
                                path(index, `discounts_offered.${discountIndex}.discount_amount`),
                                '',
                              );
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select discount type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                            {DISCOUNT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.discount_rate`,
                    )}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.discount_amount`,
                    )}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = discountFieldArray.filter(
                          (_, i) => i !== discountIndex,
                        );
                        form.setValue(
                          path(index, 'discounts_offered'),
                          next.length ? next : [createEmptyRiskDiscountRow()],
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Taxes Charged
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                form.setValue(path(index, 'taxes_charged'), [
                  ...taxFieldArray,
                  createEmptyRiskTaxRow(),
                ])
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Tax
            </Button>
          </div>

          {taxFieldArray.length > 0 ? (
            <div className="space-y-3">
              {taxFieldArray.map((_, taxIndex) => (
                <div
                  key={taxIndex}
                  className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4"
                >
                  <FormField
                    control={form.control}
                    name={path(index, `taxes_charged.${taxIndex}.tax_code`)}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Code (required)</FormLabel>
                        <Select
                          value={toSelectValue(field.value as string)}
                          onValueChange={(value) => {
                            const nextValue = fromSelectValue(value);
                            field.onChange(nextValue);
                            form.setValue(
                              path(index, `taxes_charged.${taxIndex}.tax_rate`),
                              getTaxRateForCode(nextValue),
                            );
                            if (value === SELECT_NONE_VALUE) {
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_amount`),
                                '',
                              );
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.is_tax_exempted`),
                                false,
                              );
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_exemption_type`),
                                '',
                              );
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_exemption_reference`),
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
                            {TAX_CODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_rate`,
                    )}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            readOnly
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(index, `taxes_charged.${taxIndex}.tax_amount`)}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.is_tax_exempted`,
                    )}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exempted</FormLabel>
                        <Select
                          value={field.value ? 'Y' : 'N'}
                          onValueChange={(value) => {
                            if (value === SELECT_NONE_VALUE) {
                              field.onChange(false);
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_exemption_type`),
                                '',
                              );
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_exemption_reference`),
                                '',
                              );
                              return;
                            }
                            const isExempted = value === 'Y';
                            field.onChange(isExempted);
                            if (!isExempted) {
                              form.setValue(
                                path(
                                  index,
                                  `taxes_charged.${taxIndex}.tax_exemption_type`,
                                ),
                                '',
                              );
                              form.setValue(
                                path(
                                  index,
                                  `taxes_charged.${taxIndex}.tax_exemption_reference`,
                                ),
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
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_exemption_type`,
                    )}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Exemption Type</FormLabel>
                        <Select
                          value={toSelectValue(field.value as string)}
                          onValueChange={(value) => field.onChange(fromSelectValue(value))}
                          disabled={!form.watch(path(index, `taxes_charged.${taxIndex}.is_tax_exempted`))}
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
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_exemption_reference`,
                    )}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Exemption Reference</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as string}
                            disabled={!form.watch(path(index, `taxes_charged.${taxIndex}.is_tax_exempted`))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end justify-end md:col-span-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = taxFieldArray.filter(
                          (_, i) => i !== taxIndex,
                        );
                        form.setValue(
                          path(index, 'taxes_charged'),
                          next.length ? next : [createEmptyRiskTaxRow()],
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p>Sum insured equivalent: {sumInsuredEquivalentValue.toFixed(2)}</p>
          <p>Discount total: {totalDiscount.toFixed(2)}</p>
          <p>Tax total: {totalTax.toFixed(2)}</p>
          <p className="font-medium text-slate-900">
            Premium including tax: {premiumIncludingTaxValue.toFixed(2)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
