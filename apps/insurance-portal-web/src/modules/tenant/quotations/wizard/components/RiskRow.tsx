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
  DISCOUNT_TYPE_OPTIONS,
  TAX_CODE_OPTIONS,
  TAX_EXEMPTION_OPTIONS,
  TAX_EXEMPTION_TYPE_OPTIONS,
  getDiscountRateForType,
  getTaxRateForCode,
} from '../utils/taxOptions';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import {
  isEqualNormalizingNumbers,
  recomputeRiskRow,
  toNumber,
} from '../utils/premiumAggregation';
import { motorFieldNameForFactorCode } from '../utils/riskFactorResolver';
import { useRiskPremiumCalculation } from '../hooks/useRiskPremiumCalculation';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  PricingStatusAlert,
  RatingFactorFields,
  readPricingQuoteMetadata,
} from '@/modules/pricing';
import type { PricingFactorValue } from '@/modules/pricing';
import { StepSection } from './StepSection';
import { WizardFormItem } from './WizardFormItem';
import type { QuotationFactorContext } from '../utils/riskFactorResolver';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  index: number;
  riskOptions: InsuranceRisk[];
  onRemove: (index: number) => void;
  canRemove: boolean;
  factorContext?: QuotationFactorContext;
}

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

export function RiskRow({
  form,
  index,
  riskOptions,
  onRemove,
  canRemove,
  factorContext,
}: Props) {
  const riskId = useWatch({
    control: form.control,
    name: `risks.${index}.risk_id` as const,
  });
  const quotationType = form.watch('quotation_type');
  const selectedRisk = riskOptions.find((risk) => risk.id === riskId) ?? null;
  const discountFieldArray =
    form.getValues(`risks.${index}.discounts_offered` as const) ?? [];
  const taxFieldArray =
    form.getValues(`risks.${index}.taxes_charged` as const) ?? [];

  useEffect(() => {
    const nextRiskCode = selectedRisk?.risk_code ?? '';
    if (form.getValues(path(index, 'risk_code')) !== nextRiskCode) {
      form.setValue(path(index, 'risk_code'), nextRiskCode);
    }
  }, [form, index, selectedRisk?.risk_code]);

  const { calculateMutation, requiredFactorsQuery, handleSumInsuredBlur } =
    useRiskPremiumCalculation(form, index, factorContext);

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
    form.setValue(path(index, 'factor_values'), {});
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
  const discountsKey = JSON.stringify(discounts);
  const taxesKey = JSON.stringify(taxes);
  const premiumAfterDiscount = form.watch(
    `risks.${index}.premium_after_discount` as const,
  );
  const premiumBeforeDiscount = form.watch(
    `risks.${index}.premium_before_discount` as const,
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
    validation_warnings?: string[];
  } | null;
  const pricingMetadata = readPricingQuoteMetadata(ratingResultMetadata);
  const factorValues =
    (form.watch(path(index, 'factor_values')) as
      | Record<string, PricingFactorValue>
      | undefined) ?? {};

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
    const currentRow = form.getValues(`risks.${index}` as const);
    const recomputedRow = recomputeRiskRow(currentRow);

    if (
      !isEqualNormalizingNumbers(
        currentRow.discounts_offered ?? [],
        recomputedRow.discounts_offered ?? [],
      )
    ) {
      form.setValue(path(index, 'discounts_offered'), recomputedRow.discounts_offered);
    }
    if (
      !isEqualNormalizingNumbers(
        currentRow.taxes_charged ?? [],
        recomputedRow.taxes_charged ?? [],
      )
    ) {
      form.setValue(path(index, 'taxes_charged'), recomputedRow.taxes_charged);
    }
    // Money fields are compared numerically, not as raw strings: the backend's
    // calculation result and this frontend recompute format the same amount
    // differently (e.g. "100000.0000" vs "100000"), which previously made this
    // effect believe the value had "changed" on every run and re-set it
    // forever, alternating with the backend's own format each pass (an
    // infinite update loop — see incident where creating a motor quotation
    // crashed the wizard right after entering Sum Insured).
    if (toNumber(currentRow.premium_after_discount) !== toNumber(recomputedRow.premium_after_discount)) {
      form.setValue(
        path(index, 'premium_after_discount'),
        recomputedRow.premium_after_discount,
      );
    }
    if (
      toNumber(currentRow.premium_excluding_tax_equivalent) !==
      toNumber(recomputedRow.premium_excluding_tax_equivalent)
    ) {
      form.setValue(
        path(index, 'premium_excluding_tax_equivalent'),
        recomputedRow.premium_excluding_tax_equivalent,
      );
    }
    if (toNumber(currentRow.premium_including_tax) !== toNumber(recomputedRow.premium_including_tax)) {
      form.setValue(
        path(index, 'premium_including_tax'),
        recomputedRow.premium_including_tax,
      );
    }
  }, [
    discountsKey,
    form,
    index,
    premiumBeforeDiscount,
    taxesKey,
  ]);

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

        <PricingStatusAlert
          minimumAmount={minimumAmount}
          isPending={calculateMutation.isPending}
          errorMessage={
            calculateMutation.isError
              ? `Could not calculate premium: ${getApiErrorMessage(
                  calculateMutation.error,
                )}. The last known premium values are shown below.`
              : null
          }
          metadata={pricingMetadata}
        />

        {quotationType === 'NON_MOTOR' ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Rating Factors</p>
              <p className="text-xs text-slate-500">
                These factors are sent to the backend pricing engine for non-motor calculations.
              </p>
            </div>
            <RatingFactorFields
              requiredFactors={requiredFactorsQuery.data ?? []}
              isLoading={requiredFactorsQuery.isLoading}
              values={factorValues}
              onChange={(code, value) =>
                form.setValue(path(index, 'factor_values'), {
                  ...factorValues,
                  [code]: value,
                })
              }
            />
          </div>
        ) : null}

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
                  className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-5"
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
                              form.setValue(
                                path(index, `discounts_offered.${discountIndex}.discount_rate`),
                                getDiscountRateForType(nextValue),
                              );
                            }
                            // discount_amount is not computed here — with
                            // automatic calculation currently disabled
                            // (AUTO_CALCULATION_DISABLED), it's left for
                            // manual entry below rather than guessed.
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
                          />
                        </FormControl>
                        <FormMessage />
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
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.request_reason_code`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem>
                        <FormLabel>Reason Code</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as string}
                            placeholder="e.g. LOYALTY"
                          />
                        </FormControl>
                      </WizardFormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={path(
                      index,
                      `discounts_offered.${discountIndex}.request_comment`,
                    )}
                    render={({ field }) => (
                      <WizardFormItem className="md:col-span-4">
                        <FormLabel>Comment</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as string}
                            placeholder="Why is this discount requested?"
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
                            // tax_rate is prefilled from the tax code's
                            // known default; tax_amount is left blank for
                            // manual entry — automatic calculation is
                            // currently disabled (AUTO_CALCULATION_DISABLED).
                            form.setValue(
                              path(index, `taxes_charged.${taxIndex}.tax_rate`),
                              getTaxRateForCode(nextValue),
                            );
                            form.setValue(
                              path(index, `taxes_charged.${taxIndex}.tax_amount`),
                              '',
                            );
                            if (value === SELECT_NONE_VALUE) {
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
                              // Zeroing is a presentation-level clear, not a
                              // calculation — safe to do immediately rather
                              // than waiting on the debounced recalculation.
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_amount`),
                                '0',
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
                              // Un-exempting means the true tax_amount is
                              // unknown again until the backend recalculates.
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_amount`),
                                '',
                              );
                            } else {
                              form.setValue(
                                path(index, `taxes_charged.${taxIndex}.tax_amount`),
                                '0',
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
