import { setPricingFormValue } from '../utils/pricingFormUpdates';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
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
  formatDiscountOptionLabel,
  getDiscountRateForType,
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
import { isMotorFactorCovered } from '../utils/riskFactorResolver';
import { useRiskPremiumCalculation } from '../hooks/useRiskPremiumCalculation';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { RiskTaxesFields } from './RiskTaxesFields';
import { RatingFactorFields, type PricingFactorValue } from '@/modules/pricing';
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
  showRiskSelector?: boolean;
  showSumInsured?: boolean;
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
  showRiskSelector = true,
  showSumInsured = true,
}: Props) {
  const riskId = useWatch({
    control: form.control,
    name: `risks.${index}.risk_id` as const,
  });
  const selectedRisk = riskOptions.find((risk) => risk.id === riskId) ?? null;
  useEffect(() => {
    if (!selectedRisk) return;
    const nextRiskCode = selectedRisk.risk_code;
    if (form.getValues(path(index, 'risk_code')) !== nextRiskCode) {
      form.setValue(path(index, 'risk_code'), nextRiskCode);
    }
  }, [form, index, selectedRisk]);

  const { requiredFactorsQuery, handleSumInsuredBlur, calculateMutation } =
    useRiskPremiumCalculation(form, index, factorContext);
  const quotationType = useWatch({
    control: form.control,
    name: 'quotation_type',
  });
  const factorValues = (useWatch({
    control: form.control,
    name: path(index, 'factor_values'),
  }) ?? {}) as Record<string, PricingFactorValue>;
  const visibleRequiredFactors = useMemo(
    () =>
      (requiredFactorsQuery.data ?? []).filter((requiredFactor) => {
        const code = requiredFactor.factor.code;
        if (
          [
            'sum_insured',
            'payment_mode',
            'currency_code',
            'exchange_rate',
            'sale_point_code',
            'officer_name',
            'officer_title',
            'policy_holder_type',
          ].includes(code)
        )
          return false;
        if (quotationType === 'MOTOR' && isMotorFactorCovered(code)) {
          return false;
        }
        return true;
      }),
    [requiredFactorsQuery.data, quotationType],
  );
  // Premium can't be calculated without it, so it's required when present.
  const requiresSumInsured = (requiredFactorsQuery.data ?? []).some(
    (item) => item.factor.code === 'sum_insured',
  );
  const handleFactorChange = useCallback(
    (code: string, value: PricingFactorValue) => {
      form.setValue(path(index, `factor_values.${code}`), value);
    },
    [form, index],
  );

  // Premium Before Discount is manually entered (automatic calculation is
  // disabled) — it only feeds the discount/tax recompute below once the user
  // leaves the field (blur), not on every keystroke, mirroring how Sum
  // Insured is committed via handleSumInsuredBlur above.
  const committedPremiumBeforeDiscount = form.watch(
    `risks.${index}.premium_before_discount`,
  );

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
    form.setValue(path(index, 'discounts_offered'), [
      createEmptyRiskDiscountRow(),
    ]);
    form.setValue(path(index, 'taxes_charged'), [createEmptyRiskTaxRow()]);
    form.setValue(path(index, 'factor_values'), {});
    form.setValue(path(index, 'rating_result_metadata'), null);
    form.setValue(path(index, 'minimum_amount'), '');
  }, [form, index, riskId]);

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
  const premiumExcludingTaxEquivalent = form.watch(
    `risks.${index}.premium_excluding_tax_equivalent` as const,
  );
  const premiumIncludingTax = form.watch(
    `risks.${index}.premium_including_tax` as const,
  );
  const sumInsuredValue = form.watch(`risks.${index}.sum_insured` as const);
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

  useEffect(() => {
    const nextEquivalent = sumInsuredValue ?? '';
    if ((sumInsuredEquivalent ?? '') === nextEquivalent) return;
    form.setValue(path(index, 'sum_insured_equivalent'), nextEquivalent);
  }, [form, index, sumInsuredEquivalent, sumInsuredValue]);

  useEffect(() => {
    const currentRow = form.getValues(`risks.${index}` as const);
    const recomputedRow = recomputeRiskRow(currentRow);

    if (
      !isEqualNormalizingNumbers(
        currentRow.discounts_offered ?? [],
        recomputedRow.discounts_offered ?? [],
      )
    ) {
      setPricingFormValue(
        form,
        path(index, 'discounts_offered'),
        recomputedRow.discounts_offered,
      );
    }
    if (
      !isEqualNormalizingNumbers(
        currentRow.taxes_charged ?? [],
        recomputedRow.taxes_charged ?? [],
      )
    ) {
      setPricingFormValue(
        form,
        path(index, 'taxes_charged'),
        recomputedRow.taxes_charged,
      );
    }
    // Money fields are compared numerically, not as raw strings: the backend's
    // calculation result and this frontend recompute format the same amount
    // differently (e.g. "100000.0000" vs "100000"), which previously made this
    // effect believe the value had "changed" on every run and re-set it
    // forever, alternating with the backend's own format each pass (an
    // infinite update loop — see incident where creating a motor quotation
    // crashed the wizard right after entering Sum Insured).
    if (
      toNumber(currentRow.premium_after_discount) !==
      toNumber(recomputedRow.premium_after_discount)
    ) {
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
    if (
      toNumber(currentRow.premium_including_tax) !==
      toNumber(recomputedRow.premium_including_tax)
    ) {
      form.setValue(
        path(index, 'premium_including_tax'),
        recomputedRow.premium_including_tax,
      );
    }
  }, [committedPremiumBeforeDiscount, discountsKey, form, index, taxesKey]);

  const currencyCode =
    useWatch({ control: form.control, name: 'currency' })
      ?.trim()
      .toUpperCase() || undefined;

  return (
    <StepSection
      variant="item"
      title={
        <>
          Risk #{index + 1}{' '}
          {selectedRisk ? (
            <span className="text-slate-500">{selectedRisk.risk_name}</span>
          ) : null}
        </>
      }
      action={
        canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null
      }
      contentClassName="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {showRiskSelector && (
          <FormField
            control={form.control}
            name={path(index, 'risk_id')}
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel required>Risk</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) =>
                    field.onChange(fromSelectValue(value))
                  }
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
                        {risk.risk_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        )}
        {showSumInsured &&
          (requiredFactorsQuery.isLoading ||
            requiresSumInsured ||
            Number(sumInsuredValue) > 0) && (
            <FormField
              control={form.control}
              name={path(index, 'sum_insured')}
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel required={requiresSumInsured}>
                    Sum Insured
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      value={field.value as string}
                      onChange={(event) => {
                        field.onChange(event);
                        form.setValue(
                          path(index, 'sum_insured_equivalent'),
                          event.target.value,
                        );
                      }}
                      onBlur={() => {
                        field.onBlur();
                        form.setValue(
                          path(index, 'sum_insured_equivalent'),
                          (form.getValues(
                            path(index, 'sum_insured'),
                          ) as string) ?? '',
                        );
                        handleSumInsuredBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
          )}

        <FormField
          control={form.control}
          name={path(index, 'discounts_offered.0.discount_type')}
          render={() => (
            <WizardFormItem>
              <FormLabel>Discount Type</FormLabel>
              <Select
                value={toSelectValue(discounts[0]?.discount_type)}
                onValueChange={(value) => {
                  const nextType = fromSelectValue(value);
                  // One discount per risk: the rate is resolved from the type
                  // and the amount is recomputed by recomputeRiskRow above.
                  form.setValue(path(index, 'discounts_offered'), [
                    {
                      ...createEmptyRiskDiscountRow(),
                      ...(discounts[0] ?? {}),
                      discount_type: nextType,
                      discount_rate: nextType
                        ? getDiscountRateForType(nextType)
                        : '',
                      discount_amount: '',
                    },
                  ]);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="No discount" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>No discount</SelectItem>
                  {DISCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {formatDiscountOptionLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <RiskTaxesFields form={form} riskPath={`risks.${index}`} inline />

        {visibleRequiredFactors.length > 0 && (
          <div className="col-span-full">
            <RatingFactorFields
              requiredFactors={visibleRequiredFactors}
              values={factorValues}
              isLoading={requiredFactorsQuery.isLoading}
              onChange={handleFactorChange}
            />
          </div>
        )}
      </div>

      {calculateMutation.isPending && (
        <p role="status" className="text-sm">
          Calculating premium...
        </p>
      )}
      {calculateMutation.isError && (
        <p role="alert" className="text-sm text-red-600">
          Premium could not be calculated. Check the cover details and try
          again.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:grid-cols-4">
        {totalDiscount > 0 && (
          <div>
            <dt className="text-xs">Discount</dt>
            <dd>{formatMoney(totalDiscount, currencyCode)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs">Premium excl. tax</dt>
          <dd>
            {formatMoney(toNumber(premiumExcludingTaxEquivalent), currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs">Tax</dt>
          <dd>{formatMoney(totalTax, currencyCode)}</dd>
        </div>
        <div>
          <dt className="text-xs">Total premium</dt>
          <dd className="font-semibold text-slate-900">
            {formatMoney(premiumIncludingTaxValue, currencyCode)}
          </dd>
        </div>
      </dl>
    </StepSection>
  );
}
