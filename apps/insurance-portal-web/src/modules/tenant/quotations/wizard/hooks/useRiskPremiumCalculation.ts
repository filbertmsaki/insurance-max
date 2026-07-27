import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import {
  usePricingCalculator,
  usePricingRequiredFactors,
  usePricingRulePreview,
} from '@/modules/pricing';
import type { QuotationFormSchemaValues } from '../../schemas';
import { resolveFactorValues } from '../utils/riskFactorResolver';
import { applyRiskPremiumResult, toNumber } from '../utils/premiumAggregation';
import { readPricingQuoteMetadata } from '@/modules/pricing';
import { buildSingleRiskPricingSignature } from '../utils/pricingStaleness';

const CALCULATION_DEBOUNCE_MS = 400;

function path(
  index: number,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `risks.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
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
  const productId = useWatch({ control: form.control, name: 'product_id' });
  const validFrom = useWatch({ control: form.control, name: 'valid_from' });
  const validUntil = useWatch({ control: form.control, name: 'valid_until' });
  const currency = useWatch({ control: form.control, name: 'currency' });
  const exchangeRate = useWatch({ control: form.control, name: 'exchange_rate' });
  const addons = useWatch({ control: form.control, name: 'addons' });
  const motor = useWatch({ control: form.control, name: 'motor' });
  const factorValuesRow = useWatch({
    control: form.control,
    name: path(index, 'factor_values'),
  }) as Record<string, string | number | boolean> | undefined;
  const sumInsured = useWatch({
    control: form.control,
    name: path(index, 'sum_insured'),
  }) as string | undefined;
  const discounts = useWatch({
    control: form.control,
    name: path(index, 'discounts_offered'),
  });
  const taxes = useWatch({
    control: form.control,
    name: path(index, 'taxes_charged'),
  });
  const riskCode = useWatch({
    control: form.control,
    name: path(index, 'risk_code'),
  }) as string | undefined;
  const pricingMetadata = useWatch({
    control: form.control,
    name: path(index, 'rating_result_metadata'),
  });

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
  const currentPricingSignature = useMemo(
    () =>
      buildSingleRiskPricingSignature({
        quotation_type: quotationType,
        product_id: productId,
        valid_from: validFrom,
        valid_until: validUntil,
        currency,
        exchange_rate: exchangeRate,
        motor,
        addons,
        risk: {
          risk_id: riskId,
          risk_code: riskCode,
          sum_insured: sumInsured,
          factor_values: factorValuesRow ?? {},
          discounts_offered: discounts ?? [],
          taxes_charged: taxes ?? [],
        },
      }),
    [
      addons,
      currency,
      discounts,
      exchangeRate,
      factorValuesRow,
      motor,
      productId,
      quotationType,
      riskCode,
      riskId,
      sumInsured,
      taxes,
      validFrom,
      validUntil,
    ],
  );

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

  useEffect(() => {
    const metadata = readPricingQuoteMetadata(pricingMetadata);
    if (!metadata?.pricing_quote_id || !metadata.pricing_input_signature) {
      return;
    }

    if (metadata.pricing_input_signature === currentPricingSignature) {
      return;
    }

    if (metadata.pricing_is_stale && metadata.stale_reason) {
      return;
    }

    form.setValue(path(index, 'rating_result_metadata'), {
      ...metadata,
      pricing_quote_id: null,
      pricing_status: 'STALE',
      pricing_is_stale: true,
      stale_reason:
        'Risk data changed after the last calculation. Recalculate premium before continuing.',
      pricing_input_signature: currentPricingSignature,
    });
  }, [currentPricingSignature, form, index, pricingMetadata]);

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
      const requestedDiscountRate = Number(
        (
          form.getValues(
            path(index, 'discounts_offered.0.discount_rate'),
          ) as string | undefined
        ) || 0,
      );

      calculateMutateRef.current(
        {
          risk_id: riskId,
          sum_insured:
            Number(form.getValues(path(index, 'sum_insured')) as string) ||
            Number(factorValues.sum_insured) ||
            0,
          factors: factorValues,
          effective_date: form.getValues('valid_from') as string,
          currency_code:
            ((form.getValues('currency') as string) || 'TZS')
              .trim()
              .toUpperCase(),
          exchange_rate:
            (((form.getValues('currency') as string) || 'TZS')
              .trim()
              .toUpperCase() === 'TZS'
              ? 1
              : Number(form.getValues('exchange_rate') as string) || 1),
          // Only a requested discount RATE is sent — the backend computes
          // discount_amount from it; the frontend never sends a
          // pre-calculated amount as a trusted value. Loading and
          // tax_rule_ids are intentionally omitted here: this wizard has no
          // loading-request UI yet, and every currently active tax rule for
          // the product should apply by default (unchanged behavior).
          discount:
            requestedDiscountRate > 0
              ? { rate: requestedDiscountRate }
              : undefined,
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
              path(index, 'discounts_offered'),
              updatedRow.discounts_offered,
            );
            form.setValue(
              path(index, 'premium_after_discount'),
              updatedRow.premium_after_discount,
            );
            form.setValue(
              path(index, 'premium_excluding_tax_equivalent'),
              updatedRow.premium_excluding_tax_equivalent,
            );
            form.setValue(
              path(index, 'taxes_charged'),
              updatedRow.taxes_charged,
            );
            form.setValue(
              path(index, 'premium_including_tax'),
              updatedRow.premium_including_tax,
            );
            form.setValue(
              path(index, 'rating_result_metadata'),
              {
                ...updatedRow.rating_result_metadata,
                pricing_status: updatedRow.rating_result_metadata?.pricing_status ?? 'CALCULATED',
                pricing_input_signature: currentPricingSignature,
                pricing_is_stale: false,
                stale_reason: null,
              },
            );
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
    currentPricingSignature,
  ]);

  return {
    requiredFactorsQuery,
    ruleListQuery,
    calculateMutation,
    handleSumInsuredBlur,
  };
}
