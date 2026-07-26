import { useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { useRequiredFactorsByRisk } from '@/modules/tenant/product-engine/hooks/useRequiredFactors';
import { useRuleList } from '@/modules/tenant/product-engine/hooks/useRatingRules';
import { calculatorApi } from '@/modules/tenant/product-engine/api/calculator';
import type { QuotationFormSchemaValues } from '../../schemas';
import { resolveFactorValues } from '../utils/riskFactorResolver';
import { applyRiskPremiumResult } from '../utils/premiumAggregation';

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
  const sumInsured = useWatch({ control: form.control, name: path(index, 'sum_insured') }) as string;
  const quotationType = useWatch({ control: form.control, name: 'quotation_type' });
  const motor = useWatch({ control: form.control, name: 'motor' });

  const requiredFactorsQuery = useRequiredFactorsByRisk(riskId ?? '');
  const requiredFactors = useMemo(
    () => requiredFactorsQuery.data ?? [],
    [requiredFactorsQuery.data],
  );

  const ruleListQuery = useRuleList({ risk_id: riskId || undefined });

  const factorValues = useMemo(() => {
    const pseudoFormValues = {
      quotation_type: quotationType,
      motor,
      risks: [{ sum_insured: sumInsured }],
    } as QuotationFormSchemaValues;

    return resolveFactorValues(requiredFactors, pseudoFormValues, 0);
  }, [requiredFactors, quotationType, motor, sumInsured]);
  const factorValuesKey = JSON.stringify(factorValues);

  // Deselecting a risk clears its stale minimum immediately.
  useEffect(() => {
    if (riskId) return;
    form.setValue(path(index, 'minimum_amount'), '');
  }, [form, index, riskId]);

  // The moment the rule list for the selected risk resolves — before sum
  // insured is entered or any calculation call fires — surface the minimum
  // premium from the highest-priority (lowest priority number) active rule,
  // and pre-fill premium_rate/premium_before_discount from it too, but only
  // when this row doesn't already carry a premium (a brand-new row). Rows
  // hydrated from an existing quotation, or already calculated, are left
  // alone; once the debounced calculation below succeeds, its result
  // overwrites these with the real figures regardless.
  useEffect(() => {
    if (!riskId) return;

    const rules = ruleListQuery.data?.data ?? [];
    const activeRules = rules.filter((rule) => rule.is_active);
    if (activeRules.length === 0) return;

    const topRule = [...activeRules].sort((a, b) => a.priority - b.priority)[0];
    const minimumAmount = topRule.minimum_amount ?? 0;
    form.setValue(path(index, 'minimum_amount'), String(minimumAmount));

    const hasExistingPremium = !!(
      form.getValues(path(index, 'premium_before_discount')) as string
    );
    if (!hasExistingPremium) {
      form.setValue(
        path(index, 'premium_rate'),
        String(topRule.percentage_rate ?? 0),
      );
      form.setValue(path(index, 'premium_before_discount'), String(minimumAmount));
    }
  }, [form, index, riskId, ruleListQuery.data]);

  const calculateMutation = useMutation({
    mutationFn: calculatorApi.calculateSingle,
    onSuccess: (result) => {
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
        path(index, 'premium_after_discount'),
        updatedRow.premium_after_discount,
      );
      form.setValue(
        path(index, 'premium_excluding_tax_equivalent'),
        updatedRow.premium_excluding_tax_equivalent,
      );
      form.setValue(
        path(index, 'premium_including_tax'),
        updatedRow.premium_including_tax,
      );
      form.setValue(
        path(index, 'rating_result_metadata'),
        updatedRow.rating_result_metadata,
      );
    },
  });

  // Keep the mutate function reachable without making it an effect
  // dependency — mutate() itself is expected to be stable, but routing it
  // through a ref means the debounce below can never be re-armed by
  // anything other than the inputs that actually matter.
  const calculateMutateRef = useRef(calculateMutation.mutate);
  useEffect(() => {
    calculateMutateRef.current = calculateMutation.mutate;
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!riskId || !sumInsured) return undefined;

    timeoutRef.current = setTimeout(() => {
      calculateMutateRef.current({
        risk_id: riskId,
        sum_insured: Number(sumInsured) || 0,
        factors: factorValues,
      });
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // factorValues is intentionally tracked via its stable JSON key so the
    // debounce doesn't restart on every render from a new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskId, sumInsured, factorValuesKey]);

  return {
    requiredFactorsQuery,
    ruleListQuery,
    calculateMutation,
  };
}
