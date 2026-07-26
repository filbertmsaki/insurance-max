import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const quotationType = useWatch({ control: form.control, name: 'quotation_type' });
  const motor = useWatch({ control: form.control, name: 'motor' });

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
      risks: [{ sum_insured: committedSumInsured }],
    } as QuotationFormSchemaValues;

    return resolveFactorValues(requiredFactors, pseudoFormValues, 0);
  }, [requiredFactors, quotationType, motor, committedSumInsured]);
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
      // The user may have already switched this row to a different risk
      // while this calculation was in flight — discard a now-stale result
      // rather than clobbering the row the user is now looking at.
      const currentRiskId = form.getValues(path(index, 'risk_id')) as string;
      if (result.risk_id !== currentRiskId) return;

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
    if (!riskId || !committedSumInsured) return undefined;

    // Sum insured only ever reaches here once committed on blur; still gate
    // on the risk's minimum here (rather than in the blur handler) so this
    // is the single source of truth regardless of how committedSumInsured
    // got its value (blur, or a future re-trigger from a factor change).
    const minimumAmount =
      Number(form.getValues(path(index, 'minimum_amount')) as string) || 0;
    if (Number(committedSumInsured) <= minimumAmount) return undefined;

    timeoutRef.current = setTimeout(() => {
      calculateMutateRef.current({
        risk_id: riskId,
        sum_insured: Number(committedSumInsured) || 0,
        factors: factorValues,
      });
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // factorValues is intentionally tracked via its stable JSON key so the
    // debounce doesn't restart on every render from a new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, index, riskId, committedSumInsured, factorValuesKey]);

  return {
    requiredFactorsQuery,
    ruleListQuery,
    calculateMutation,
    handleSumInsuredBlur,
  };
}
