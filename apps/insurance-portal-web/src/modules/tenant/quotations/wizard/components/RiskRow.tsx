import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form';
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
import {
  computePremiumAfterDiscount,
  computePremiumIncludingTax,
} from '../utils/premiumAggregation';
import { motorFieldNameForFactorCode } from '../utils/riskFactorResolver';
import { useRiskPremiumCalculation } from '../hooks/useRiskPremiumCalculation';
import { getApiErrorMessage } from '@/lib/api-error';
import { StepSection } from './StepSection';
import { WizardFormItem } from './WizardFormItem';

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
const EMPTY_DISCOUNT_ROWS: QuotationFormSchemaValues['risks'][number]['discounts_offered'] =
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

  const { calculateMutation, requiredFactorsQuery, handleSumInsuredBlur } =
    useRiskPremiumCalculation(form, index);

  // Snapshot of the currently-selected risk's required factor codes, kept
  // fresh continuously (while riskId is unchanged) so that whenever a real
  // switch happens, this ref still holds the OUTGOING risk's codes — the
  // query for the new risk's factors has already moved on by the time this
  // effect's sibling below runs in the same commit.
  const currentFactorCodes = useMemo(
    () => (requiredFactorsQuery.data ?? []).map((factor) => factor.factor.code),
    [requiredFactorsQuery.data],
  );
  const previousFactorCodesRef = useRef<string[]>([]);
  useEffect(() => {
    previousFactorCodesRef.current = currentFactorCodes;
  }, [currentFactorCodes]);

  // Reset the row whenever the user actually changes risk_id to a different
  // value — not on initial mount/hydration, where risk_id is simply being
  // set from saved draft/quotation data.
  const previousRiskIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previousRiskId = previousRiskIdRef.current;
    previousRiskIdRef.current = riskId;

    if (!previousRiskId || previousRiskId === riskId) return;

    form.setValue(path(index, 'sum_insured'), '');
    form.setValue(path(index, 'sum_insured_equivalent'), '');
    form.setValue(path(index, 'premium_rate'), '');
    form.setValue(path(index, 'premium_before_discount'), '');
    form.setValue(path(index, 'premium_after_discount'), '');
    form.setValue(path(index, 'premium_excluding_tax_equivalent'), '');
    form.setValue(path(index, 'premium_including_tax'), '');
    form.setValue(path(index, 'discounts_offered'), [createEmptyRiskDiscountRow()]);
    form.setValue(path(index, 'taxes_charged'), [createEmptyRiskTaxRow()]);
    form.setValue(path(index, 'rating_result_metadata'), null);
    form.setValue(path(index, 'minimum_amount'), '');

    // Only clear factor fields the outgoing risk needed but the new one
    // doesn't — fields describing the same physical vehicle (make, model,
    // registration_no, ...) survive a risk swap when both risks need them.
    const newFactorCodes = new Set(currentFactorCodes);
    previousFactorCodesRef.current
      .filter((code) => !newFactorCodes.has(code))
      .forEach((code) => {
        const motorField = motorFieldNameForFactorCode(code);
        if (!motorField) return;
        form.setValue(
          `motor.${motorField}` as FieldPath<QuotationFormSchemaValues>,
          '',
        );
      });
  }, [form, index, riskId, currentFactorCodes]);

  const watchedDiscounts = useWatch({
    control: form.control,
    name: `risks.${index}.discounts_offered` as const,
  });
  const discounts = watchedDiscounts ?? EMPTY_DISCOUNT_ROWS;
  const watchedTaxes = useWatch({
    control: form.control,
    name: `risks.${index}.taxes_charged` as const,
  });
  const taxes = watchedTaxes ?? EMPTY_TAX_ROWS;
  const premiumBeforeDiscount = form.watch(
    `risks.${index}.premium_before_discount` as const,
  );
  const premiumAfterDiscount = form.watch(
    `risks.${index}.premium_after_discount` as const,
  );
  const premiumExcludingTaxEquivalent = form.watch(
    `risks.${index}.premium_excluding_tax_equivalent` as const,
  );
  const premiumIncludingTax = form.watch(
    `risks.${index}.premium_including_tax` as const,
  );
  const sumInsuredEquivalent = form.watch(
    `risks.${index}.sum_insured_equivalent` as const,
  );
  const minimumAmount = form.watch(`risks.${index}.minimum_amount` as const);
  const ratingResultMetadata = form.watch(
    `risks.${index}.rating_result_metadata` as const,
  ) as {
    minimum_applied?: boolean;
    minimum_amount?: number;
    validation_errors?: string[];
  } | null;

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

  // react-hook-form's useWatch returns a brand-new array reference for
  // nested array paths on essentially every notify, even when the content
  // is unchanged. Depending on `discounts`/`taxes` directly in the effects
  // below would re-run them (and risk a setValue feedback loop) on every
  // unrelated form update, so effects key off these stable content
  // fingerprints instead — the effect bodies still read the live arrays.
  // Only discount_amount/tax_amount feed the downstream premium recompute
  // below, so only they need to be in the fingerprint — discount_rate is
  // free-typed and would otherwise re-run that effect on every keystroke.
  const discountsKey = discounts.map((d) => d.discount_amount).join(';');
  const taxAmountsKey = taxes.map((t) => t.tax_amount).join(';');
  // Drives the tax_rate/tax_amount auto-calc effect below — tax_code and
  // is_tax_exempted are both discrete Select-driven inputs (not free-typed),
  // so reacting to every change here carries no keystroke-jank risk.
  const taxRateInputsKey = taxes
    .map((t) => `${t.tax_code}|${t.tax_rate}|${t.is_tax_exempted}`)
    .join(';');

  // Rules 4-6: premium_after_discount, premium_excluding_tax_equivalent and
  // premium_including_tax always stay in sync with premium_before_discount
  // and the current discount/tax line items, however those values changed.
  useEffect(() => {
    const nextAfterDiscount = computePremiumAfterDiscount(
      premiumBeforeDiscount,
      discounts,
    );
    const nextExcludingTaxEquivalent = nextAfterDiscount;
    const nextIncludingTax = computePremiumIncludingTax(
      nextExcludingTaxEquivalent,
      taxes,
    );

    if (
      toNumber(form.getValues(path(index, 'premium_after_discount')) as string) !==
      nextAfterDiscount
    ) {
      form.setValue(path(index, 'premium_after_discount'), String(nextAfterDiscount));
    }
    if (
      toNumber(
        form.getValues(path(index, 'premium_excluding_tax_equivalent')) as string,
      ) !== nextExcludingTaxEquivalent
    ) {
      form.setValue(
        path(index, 'premium_excluding_tax_equivalent'),
        String(nextExcludingTaxEquivalent),
      );
    }
    if (
      toNumber(form.getValues(path(index, 'premium_including_tax')) as string) !==
      nextIncludingTax
    ) {
      form.setValue(path(index, 'premium_including_tax'), String(nextIncludingTax));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, index, premiumBeforeDiscount, discountsKey, taxAmountsKey]);

  // Auto-fill discount_amount from discount_rate, but only once the user has
  // finished editing the rate (blur) or picked a discount type — not on
  // every keystroke, which used to cascade a recompute through
  // premium_after_discount/excl-tax/incl-tax on each character typed and
  // made the page visibly jump. Stays editable afterwards.
  const applyDiscountAutoFill = (discountIndex: number) => {
    const rate = form.getValues(
      path(index, `discounts_offered.${discountIndex}.discount_rate`),
    ) as string;
    if (!rate) return;
    const premiumBeforeDiscountValue = toNumber(
      form.getValues(path(index, 'premium_before_discount')) as string,
    );
    const amount = premiumBeforeDiscountValue * (toNumber(rate) / 100);
    form.setValue(
      path(index, `discounts_offered.${discountIndex}.discount_amount`),
      String(amount),
    );
  };

  // premium_rate is normally API-derived (set alongside premium_before_discount
  // by the calculation result), but for a manual-entry risk with no rating
  // rule an admin may hand-edit it — in that case premium_before_discount
  // must recompute from it, or it'd sit there disconnected from everything
  // downstream. Guarded to only fire when the value actually changed between
  // focus and blur, so merely tabbing through the field never overwrites an
  // API-correct premium_before_discount (which may include per-unit/fixed/
  // minimum-floor components this simple rate*sum-insured formula can't
  // reconstruct) with this simplified recompute.
  const premiumRateFocusValueRef = useRef<string | null>(null);
  const applyPremiumRateOverride = () => {
    const rate = form.getValues(path(index, 'premium_rate')) as string;
    if (!rate) return;
    // A manual-entry risk with no rating rule may never have had a
    // calculation succeed, so sum_insured_equivalent could still be blank —
    // fall back to the raw sum_insured the same way the display totals
    // below already do.
    const sumInsuredEquivalentForRate =
      toNumber(form.getValues(path(index, 'sum_insured_equivalent')) as string) ||
      toNumber(form.getValues(path(index, 'sum_insured')) as string);
    const nextBeforeDiscount = sumInsuredEquivalentForRate * (toNumber(rate) / 100);
    form.setValue(
      path(index, 'premium_before_discount'),
      String(nextBeforeDiscount),
    );
  };

  // Keeps tax_rate in sync with tax_code, and tax_amount in sync with
  // tax_rate/premium_excluding_tax_equivalent/is_tax_exempted — all of which
  // are discrete, Select-driven or computed inputs rather than free-typed,
  // so recomputing on every change here carries no keystroke-jank risk (see
  // the discount_rate/sum_insured fixes above and earlier in this file for
  // where that risk actually lives). Exempted rows are pinned to 0.
  useEffect(() => {
    const premiumExcludingTaxEquivalentValue = toNumber(
      premiumExcludingTaxEquivalent,
    );

    taxes.forEach((tax, taxIndex) => {
      const expectedRate = getTaxRateForCode(tax.tax_code);
      if (expectedRate && tax.tax_rate !== expectedRate) {
        form.setValue(
          path(index, `taxes_charged.${taxIndex}.tax_rate`),
          expectedRate,
        );
      }

      const effectiveRate = expectedRate || tax.tax_rate;
      const nextAmount = tax.is_tax_exempted
        ? 0
        : premiumExcludingTaxEquivalentValue * toNumber(effectiveRate);
      const currentAmount = toNumber(
        form.getValues(
          path(index, `taxes_charged.${taxIndex}.tax_amount`),
        ) as string,
      );
      if (currentAmount !== nextAmount) {
        form.setValue(
          path(index, `taxes_charged.${taxIndex}.tax_amount`),
          String(nextAmount),
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, index, taxRateInputsKey, premiumExcludingTaxEquivalent]);

  return (
    <StepSection
      variant="item"
      title={
        <>
          Risk #{index + 1}{' '}
          {selectedRisk ? (
            <span className="text-slate-500">- {selectedRisk.risk_code}</span>
          ) : null}
        </>
      }
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
      contentClassName="space-y-6"
    >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name={path(index, 'risk_id')}
            render={({ field }) => (
              <WizardFormItem>
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
              </WizardFormItem>
            )}
          />

          <FormField
            control={form.control}
            name={path(index, 'risk_code')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Risk Code</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value as string} readOnly />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name={path(index, 'sum_insured')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Sum Insured</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value as string}
                    onBlur={() => {
                      field.onBlur();
                      handleSumInsuredBlur();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'sum_insured_equivalent')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Sum Insured Equivalent</FormLabel>
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
          <FormField
            control={form.control}
            name={path(index, 'premium_rate')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Premium Rate</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.000001"
                    {...field}
                    value={field.value as string}
                    onFocus={() => {
                      premiumRateFocusValueRef.current = field.value as string;
                    }}
                    onBlur={() => {
                      field.onBlur();
                      if (premiumRateFocusValueRef.current !== (field.value as string)) {
                        applyPremiumRateOverride();
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_before_discount')}
            render={({ field }) => (
              <WizardFormItem>
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
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_after_discount')}
            render={({ field }) => (
              <WizardFormItem>
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
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_excluding_tax_equivalent')}
            render={({ field }) => (
              <WizardFormItem>
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
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name={path(index, 'premium_including_tax')}
            render={({ field }) => (
              <WizardFormItem>
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
              </WizardFormItem>
            )}
          />
        </div>

        {(minimumAmount ||
          calculateMutation.isPending ||
          calculateMutation.isError ||
          ratingResultMetadata) && (
          <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
            {minimumAmount ? (
              <p>Minimum premium: {toNumber(minimumAmount).toFixed(2)}</p>
            ) : null}
            {calculateMutation.isPending ? (
              <p className="text-slate-500">Calculating premium…</p>
            ) : null}
            {calculateMutation.isError ? (
              <p className="font-medium text-red-600">
                Could not calculate premium:{' '}
                {getApiErrorMessage(calculateMutation.error)}. The last known
                premium values are shown below.
              </p>
            ) : null}
            {ratingResultMetadata?.minimum_applied ? (
              <p className="font-medium text-amber-700">
                Minimum premium applied
              </p>
            ) : null}
            {ratingResultMetadata?.validation_errors?.length ? (
              <ul className="list-disc space-y-0.5 pl-4 text-red-600">
                {ratingResultMetadata.validation_errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="space-y-1 border-t border-slate-100 pt-4">
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
            <div className="space-y-1">
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
                      <WizardFormItem>
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
                            } else {
                              applyDiscountAutoFill(discountIndex);
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
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.discount_rate`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem>
                        <FormLabel>Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            {...field}
                            value={field.value as string}
                            onBlur={() => {
                              field.onBlur();
                              applyDiscountAutoFill(discountIndex);
                            }}
                          />
                        </FormControl>
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.discount_amount`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                      </WizardFormItem>
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

        <div className="space-y-1 border-t border-slate-100 pt-4">
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
            <div className="space-y-1">
              {taxFieldArray.map((_, taxIndex) => (
                <div
                  key={taxIndex}
                  className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-4"
                >
                  <FormField
                    control={form.control}
                    name={path(index, `taxes_charged.${taxIndex}.tax_code`)}
                    render={({ field }) => (
                      <WizardFormItem>
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
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_rate`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem>
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
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(index, `taxes_charged.${taxIndex}.tax_amount`)}
                    render={({ field }) => (
                      <WizardFormItem>
                        <FormLabel>Tax Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value as string}
                          />
                        </FormControl>
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.is_tax_exempted`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem>
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
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_exemption_type`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem className="md:col-span-2">
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
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `taxes_charged.${taxIndex}.tax_exemption_reference`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem className="md:col-span-2">
                        <FormLabel>Exemption Reference</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as string}
                            disabled={!form.watch(path(index, `taxes_charged.${taxIndex}.is_tax_exempted`))}
                          />
                        </FormControl>
                        <FormMessage />
                      </WizardFormItem>
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
          <p>Premium excluding tax: {toNumber(premiumExcludingTaxEquivalent).toFixed(2)}</p>
          <p>Tax total: {totalTax.toFixed(2)}</p>
          <p className="font-medium text-slate-900">
            Premium including tax: {premiumIncludingTaxValue.toFixed(2)}
          </p>
        </div>
    </StepSection>
  );
}
