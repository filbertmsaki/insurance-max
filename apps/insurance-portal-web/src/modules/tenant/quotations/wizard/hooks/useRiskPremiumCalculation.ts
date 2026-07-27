import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import {
  applyRate,
  roundMoney,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import {
  usePricingCalculator,
  usePricingRequiredFactors,
  usePricingRulePreview,
} from '@/modules/pricing';
import type { QuotationFormSchemaValues } from '../../schemas';
import { resolveFactorValues } from '../utils/riskFactorResolver';
import {
  applyRiskPremiumResult,
  computePremiumAfterDiscount,
  computePremiumIncludingTax,
  toNumber,
} from '../utils/premiumAggregation';
import { getTaxRateForCode } from '../utils/taxOptions';

const CALCULATION_DEBOUNCE_MS = 400;

function path(
  index: number,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `risks.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

/**
 * The single shared recompute cascade for a risk row's derived premium
 * fields: discount_amount (per row, from the current discount_rate) ->
 * premium_after_discount -> premium_excluding_tax_equivalent -> tax_amount
 * (per row, from the current tax_rate, skipping exempted rows) ->
 * premium_including_tax — always derived fresh from whatever
 * premium_before_discount/discounts_offered/taxes_charged currently hold, so
 * a single change anywhere (a fresh calculation, a discount edit, a tax
 * edit) always ends with a fully up-to-date premium_including_tax.
 *
 * Called explicitly from four places: after a calculation result lands
 * (below), on a discount_rate/discount_type change, on a tax_code/tax_rate
 * change, and after a hand-edited premium_rate recomputes
 * premium_before_discount — plus reactively from RiskRow.tsx whenever
 * premium_before_discount or the tax code/rate/exemption inputs change, so
 * every path converges on this one implementation instead of diverging
 * across separate handlers.
 *
 * This function itself is never wired to fire on every keystroke — only on
 * discrete commit points (blur, a Select choice, a fresh calculation) — so
 * unconditionally recomputing discount_amount/tax_amount here on every call
 * doesn't reintroduce the page-jump regression that free-typed reactivity
 * caused earlier (see the callers in RiskRow.tsx).
 */
export function recomputeRiskRow(
  form: UseFormReturn<QuotationFormSchemaValues>,
  index: number,
) {
  const premiumBeforeDiscount = form.getValues(
    path(index, 'premium_before_discount'),
  ) as string;

  // Refresh discount_amount for every row with a rate set, from the current
  // premium_before_discount — this is what keeps a discount correct after a
  // *new* calculation result, not just after the rate itself changes. Rows
  // with no rate set are left alone (nothing to derive from).
  const discountsBeforeRefresh = (form.getValues(
    path(index, 'discounts_offered'),
  ) ?? []) as QuotationFormSchemaValues['risks'][number]['discounts_offered'];
  discountsBeforeRefresh.forEach((discount, discountIndex) => {
    if (!discount.discount_rate) return;
    const nextDiscountAmount = roundMoney(
      applyRate(
        toNumber(premiumBeforeDiscount),
        toNumber(discount.discount_rate),
      ),
    );
    if (toNumber(discount.discount_amount) !== nextDiscountAmount) {
      form.setValue(
        path(index, `discounts_offered.${discountIndex}.discount_amount`),
        String(nextDiscountAmount),
      );
    }
  });

  const discounts = (form.getValues(path(index, 'discounts_offered')) ??
    []) as QuotationFormSchemaValues['risks'][number]['discounts_offered'];

  const nextAfterDiscount = computePremiumAfterDiscount(
    premiumBeforeDiscount,
    discounts,
  );
  if (
    toNumber(form.getValues(path(index, 'premium_after_discount')) as string) !==
    nextAfterDiscount
  ) {
    form.setValue(
      path(index, 'premium_after_discount'),
      String(nextAfterDiscount),
    );
  }

  const nextExcludingTaxEquivalent = nextAfterDiscount;
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

  const taxes = (form.getValues(path(index, 'taxes_charged')) ??
    []) as QuotationFormSchemaValues['risks'][number]['taxes_charged'];
  taxes.forEach((tax, taxIndex) => {
    const expectedRate = getTaxRateForCode(tax.tax_code);
    if (expectedRate && tax.tax_rate !== expectedRate) {
      form.setValue(
        path(index, `taxes_charged.${taxIndex}.tax_rate`),
        expectedRate,
      );
    }

    const effectiveRate = expectedRate || tax.tax_rate;
    const nextTaxAmount = tax.is_tax_exempted
      ? 0
      : roundMoney(
          applyRate(nextExcludingTaxEquivalent, toNumber(effectiveRate)),
        );
    if (
      toNumber(
        form.getValues(
          path(index, `taxes_charged.${taxIndex}.tax_amount`),
        ) as string,
      ) !== nextTaxAmount
    ) {
      form.setValue(
        path(index, `taxes_charged.${taxIndex}.tax_amount`),
        String(nextTaxAmount),
      );
    }
  });

  const updatedTaxes = (form.getValues(path(index, 'taxes_charged')) ??
    []) as QuotationFormSchemaValues['risks'][number]['taxes_charged'];
  const nextIncludingTax = computePremiumIncludingTax(
    nextExcludingTaxEquivalent,
    updatedTaxes,
  );
  if (
    toNumber(form.getValues(path(index, 'premium_including_tax')) as string) !==
    nextIncludingTax
  ) {
    form.setValue(
      path(index, 'premium_including_tax'),
      String(nextIncludingTax),
    );
  }
}

/**
 * Drives premium calculation for a single risk row, generically across any
 * risk (Motor, Marine, Fire, Engineering, GIT, Misc) — required factors and
 * rating rules both come from the product engine, keyed off the selected risk.
 */
export function useRiskPremiumCalculation(
  form: UseFormReturn<QuotationFormSchemaValues>,
  index: number,
) {
  const riskId = useWatch({ control: form.control, name: path(index, 'risk_id') }) as string;
  const quotationType = useWatch({ control: form.control, name: 'quotation_type' });
  const motor = useWatch({ control: form.control, name: 'motor' });
  const factorValuesRow = useWatch({
    control: form.control,
    name: path(index, 'factor_values'),
  }) as Record<string, string | number | boolean> | undefined;

  // Sum insured only feeds a calculation once the user has finished editing
  // it (blur), not on every keystroke — see handleSumInsuredBlur below. The
  // commit is tagged with the risk_id it was made for, so a stale commit
  // from a since-changed risk selection is derived away below rather than
  // requiring an effect to reset it (avoids a render -> setState -> render
  // cascade on every risk switch).
  const [committedEntry, setCommittedEntry] = useState({
    riskId: '',
    sumInsured: '',
  });
  const handleSumInsuredBlur = useCallback(() => {
    setCommittedEntry({
      riskId: form.getValues(path(index, 'risk_id')) as string,
      sumInsured: form.getValues(path(index, 'sum_insured')) as string,
    });
  }, [form, index]);
  const committedSumInsured =
    committedEntry.riskId === riskId ? committedEntry.sumInsured : '';

  const requiredFactorsQuery = usePricingRequiredFactors(riskId ?? '');
  const requiredFactors = useMemo(
    () => requiredFactorsQuery.data ?? [],
    [requiredFactorsQuery.data],
  );

  const ruleListQuery = usePricingRulePreview(riskId || '');

  const factorValues = useMemo(() => {
    const pseudoFormValues = {
      quotation_type: quotationType,
      motor,
      risks: [
        {
          sum_insured: committedSumInsured,
          factor_values: factorValuesRow ?? {},
        },
      ],
    } as QuotationFormSchemaValues;

    return resolveFactorValues(requiredFactors, pseudoFormValues, 0);
  }, [
    requiredFactors,
    quotationType,
    motor,
    committedSumInsured,
    factorValuesRow,
  ]);
  const factorValuesKey = JSON.stringify(factorValues);

  // Deselecting a risk clears its stale minimum immediately.
  useEffect(() => {
    if (riskId) return;
    form.setValue(path(index, 'minimum_amount'), '');
  }, [form, index, riskId]);

  // The moment the rule list for the selected risk resolves — before sum
  // insured is entered or any calculation call fires — surface the minimum
  // premium from the highest-priority (lowest priority number) active rule.
  // Deliberately does NOT touch premium_rate/premium_before_discount or any
  // other premium field here: those come only from a real calculation
  // result (or a saved/hydrated quotation), never from this placeholder.
  useEffect(() => {
    if (!riskId) return;

    const rules = ruleListQuery.data?.data ?? [];
    const activeRules = rules.filter((rule) => rule.is_active);
    if (activeRules.length === 0) return;

    const topRule = [...activeRules].sort((a, b) => a.priority - b.priority)[0];
    const minimumAmount = String(topRule.minimum_amount ?? 0);

    const currentMinimumAmount = form.getValues(
      path(index, 'minimum_amount'),
    ) as string;
    if (currentMinimumAmount !== minimumAmount) {
      form.setValue(path(index, 'minimum_amount'), minimumAmount);
    }
  }, [form, index, riskId, ruleListQuery.data]);

  const { calculateSingleMutation: calculateMutation } = usePricingCalculator();

  // Keep the mutate function reachable without making it an effect
  // dependency — mutate() itself is expected to be stable, but routing it
  // through a ref means the debounce below can never be re-armed by
  // anything other than the inputs that actually matter.
  const calculateMutateRef = useRef(calculateMutation.mutate);
  useEffect(() => {
    calculateMutateRef.current = calculateMutation.mutate;
  });

  // Guards against unmount: an in-flight request's response arriving after
  // this row has been removed (risk deleted, wizard navigated away) must not
  // call setValue on a field that no longer exists in the array. The flag is
  // reset in the effect body (not just relied on via useRef's initial value)
  // because React StrictMode double-invokes effects in development — mount,
  // run cleanup, mount again — which would otherwise flip this to false
  // permanently after the very first render and silently discard every
  // future calculation result for the rest of the row's life.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Monotonic "latest request wins" token. Incremented the instant a
  // request is actually sent (not merely armed) — any response whose token
  // no longer matches the current one has been superseded by a newer
  // request (risk switch, a further sum-insured edit, or a factor change)
  // made before the earlier one resolved, and is discarded outright rather
  // than risking a stale/partial apply.
  const requestTokenRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!riskId) return undefined;

    const hasCommittedSumInsured = committedSumInsured !== '';
    const hasNonMotorInputs =
      quotationType === 'NON_MOTOR' &&
      Object.entries(factorValues).some(
        ([code, value]) =>
          code !== 'sum_insured' &&
          value !== '' &&
          value !== null &&
          value !== undefined,
      );

    if (!hasCommittedSumInsured && !hasNonMotorInputs) return undefined;

    // Sum insured only ever reaches here once committed on blur; still gate
    // on the risk's minimum here (rather than in the blur handler) so this
    // is the single source of truth regardless of how committedSumInsured
    // got its value (blur, or a future re-trigger from a factor change).
    const minimumAmount =
      Number(form.getValues(path(index, 'minimum_amount')) as string) || 0;
    if (
      hasCommittedSumInsured &&
      Number(committedSumInsured) <= minimumAmount
    ) {
      return undefined;
    }

    timeoutRef.current = setTimeout(() => {
      const token = ++requestTokenRef.current;
      calculateMutateRef.current(
        {
          risk_id: riskId,
          sum_insured:
            Number(form.getValues(path(index, 'sum_insured')) as string) ||
            Number(factorValues.sum_insured) ||
            0,
          factors: factorValues,
        },
        {
          onSuccess: (result) => {
            if (!mountedRef.current || token !== requestTokenRef.current) {
              return;
            }

            const currentRow = form.getValues(`risks.${index}`);
            const updatedRow = applyRiskPremiumResult(currentRow, result);

            form.setValue(path(index, 'sum_insured'), updatedRow.sum_insured);
            form.setValue(
              path(index, 'sum_insured_equivalent'),
              updatedRow.sum_insured_equivalent,
            );
            form.setValue(path(index, 'premium_rate'), updatedRow.premium_rate);
            form.setValue(
              path(index, 'premium_before_discount'),
              updatedRow.premium_before_discount,
            );
            form.setValue(
              path(index, 'rating_result_metadata'),
              updatedRow.rating_result_metadata,
            );
            recomputeRiskRow(form, index);
          },
        },
      );
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // factorValues is intentionally tracked via its stable JSON key so the
    // debounce doesn't restart on every render from a new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form,
    index,
    riskId,
    quotationType,
    committedSumInsured,
    factorValuesKey,
  ]);

  return {
    requiredFactorsQuery,
    ruleListQuery,
    calculateMutation,
    handleSumInsuredBlur,
  };
}
