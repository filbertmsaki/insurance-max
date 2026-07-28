import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  usePricingCalculator,
  usePricingRequiredFactors,
  usePricingRulePreview,
} from '@/modules/pricing';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  resolveFactorValues,
  type QuotationFactorContext,
} from '../utils/riskFactorResolver';
import { applyRiskPremiumResult, toNumber } from '../utils/premiumAggregation';
import { readPricingQuoteMetadata } from '@/modules/pricing';
import { buildSingleRiskPricingSignature } from '../utils/pricingStaleness';

const CALCULATION_DEBOUNCE_MS = 400;

interface ProductTaxRuleRecord {
  id: string;
  category_id: string | null;
  product_id: string | null;
  risk_id: string | null;
  tax_code: string;
  status: string;
  effective_from: string;
  effective_to: string;
}

function normalizeUppercase(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase();
}

function resolveRequestedDiscountRate(
  discounts:
    | QuotationFormSchemaValues['risks'][number]['discounts_offered']
    | undefined,
) {
  const firstRequestedDiscount = (discounts ?? []).find(
    (discount) => Number(discount.discount_rate) > 0,
  );
  return Number(firstRequestedDiscount?.discount_rate ?? 0);
}

function resolveSelectedTaxCodes(
  taxes:
    | QuotationFormSchemaValues['risks'][number]['taxes_charged']
    | undefined,
) {
  return Array.from(
    new Set(
      (taxes ?? [])
        .filter((tax) => !tax.is_tax_exempted)
        .map((tax) => normalizeUppercase(tax.tax_code))
        .filter(Boolean),
    ),
  );
}

function resolveApplicableTaxRuleIds({
  taxRules,
  selectedTaxCodes,
  categoryId,
  productId,
  riskId,
  effectiveDate,
}: {
  taxRules: ProductTaxRuleRecord[];
  selectedTaxCodes: string[];
  categoryId: string | undefined;
  productId: string | undefined;
  riskId: string | undefined;
  effectiveDate: string | undefined;
}) {
  if (selectedTaxCodes.length === 0) return [];

  return taxRules
    .filter((rule) => normalizeUppercase(rule.status) === 'ACTIVE')
    .filter((rule) => selectedTaxCodes.includes(normalizeUppercase(rule.tax_code)))
    .filter(
      (rule) => !rule.category_id || rule.category_id === (categoryId || null),
    )
    .filter(
      (rule) => !rule.product_id || rule.product_id === (productId || null),
    )
    .filter((rule) => !rule.risk_id || rule.risk_id === (riskId || null))
    .filter(
      (rule) =>
        !effectiveDate ||
        (rule.effective_from <= effectiveDate && rule.effective_to >= effectiveDate),
    )
    .map((rule) => rule.id);
}

function path(
  index: number,
  name: string,
): FieldPath<QuotationFormSchemaValues> {
  return `risks.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function setValueIfChanged(
  form: UseFormReturn<QuotationFormSchemaValues>,
  fieldPath: FieldPath<QuotationFormSchemaValues>,
  nextValue: unknown,
) {
  const currentValue = form.getValues(fieldPath);
  if (JSON.stringify(currentValue) === JSON.stringify(nextValue)) return;
  form.setValue(fieldPath, nextValue as never);
}

/**
 * Drives premium calculation for a single risk row, generically across any
 * risk (Motor, Marine, Fire, Engineering, GIT, Misc) — required factors and
 * rating rules both come from the product engine, keyed off the selected risk.
 */
export function useRiskPremiumCalculation(
  form: UseFormReturn<QuotationFormSchemaValues>,
  index: number,
  factorContext?: QuotationFactorContext,
) {
  const riskId = useWatch({ control: form.control, name: path(index, 'risk_id') }) as string;
  const categoryId = useWatch({ control: form.control, name: 'category_id' }) as string;
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
  }) as QuotationFormSchemaValues['risks'][number]['discounts_offered'] | undefined;
  const taxes = useWatch({
    control: form.control,
    name: path(index, 'taxes_charged'),
  }) as QuotationFormSchemaValues['risks'][number]['taxes_charged'] | undefined;
  const riskCode = useWatch({
    control: form.control,
    name: path(index, 'risk_code'),
  }) as string | undefined;
  const pricingMetadata = useWatch({
    control: form.control,
    name: path(index, 'rating_result_metadata'),
  });
  const companyId = useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId ?? '',
  );

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
  const taxRulesQuery = useQuery({
    queryKey: ['product-distribution', 'tax-rules', companyId || 'none'],
    queryFn: () =>
      apiClient
        .get<ProductTaxRuleRecord[]>('/product-distribution/tax-rules')
        .then((response) => response.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

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

    return resolveFactorValues(
      requiredFactors,
      { ...form.getValues(), ...pseudoFormValues },
      0,
      factorContext,
    );
  }, [
    requiredFactors,
    quotationType,
    motor,
    committedSumInsured,
    factorValuesRow,
    factorContext,
  ]);
  const factorValuesKey = JSON.stringify(factorValues);
  const requestedDiscountRate = useMemo(
    () => resolveRequestedDiscountRate(discounts ?? undefined),
    [discounts],
  );
  const selectedTaxCodes = useMemo(
    () => resolveSelectedTaxCodes(taxes ?? undefined),
    [taxes],
  );
  const applicableTaxRuleIds = useMemo(
    () =>
      resolveApplicableTaxRuleIds({
        taxRules: taxRulesQuery.data ?? [],
        selectedTaxCodes,
        categoryId,
        productId,
        riskId,
        effectiveDate: validFrom,
      }),
    [
      categoryId,
      productId,
      riskId,
      selectedTaxCodes,
      taxRulesQuery.data,
      validFrom,
    ],
  );
  const applicableTaxRuleIdsKey = JSON.stringify(applicableTaxRuleIds);
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
  useEffect(() => {
    if (!riskId) return;

    // This is only a *preview* for before the user has entered a sum
    // insured (per the comment above). Once a sum insured is committed, the
    // real calculation (below) owns these fields. The previous guard here
    // was `pricing_quote_id` truthy, but this backend doesn't return a
    // pricing_quote_id for every risk/product — so for those, the guard
    // never engaged, and this effect kept re-asserting the rule's flat
    // minimum onto premium_including_tax etc. while the real calculation
    // (and RiskRow's own tax recompute) kept correcting it back to the
    // actual, tax-inclusive figure — an infinite tug-of-war between two
    // effects that disagreed on the value (not merely a formatting
    // mismatch), which crashed the wizard with "Maximum update depth
    // exceeded" right after entering Sum Insured.
    if (committedSumInsured) return;

    const rules = ruleListQuery.data?.data ?? [];
    const activeRules = rules.filter((rule) => rule.is_active);
    if (activeRules.length === 0) return;

    const topRule = [...activeRules].sort((a, b) => a.priority - b.priority)[0];
    const minimumAmount = String(topRule.minimum_amount ?? 0);
    const minimumRate = String(topRule.percentage_rate ?? 0);

    const currentMetadata = readPricingQuoteMetadata(
      form.getValues(path(index, 'rating_result_metadata')),
    );
    if (currentMetadata?.pricing_quote_id) return;

    const currentMinimumAmount = form.getValues(
      path(index, 'minimum_amount'),
    ) as string;
    if (toNumber(currentMinimumAmount) !== toNumber(minimumAmount)) {
      form.setValue(path(index, 'minimum_amount'), minimumAmount);
    }

    const previewFields = [
      ['premium_rate', minimumRate],
      ['premium_before_discount', minimumAmount],
      ['premium_after_discount', minimumAmount],
      ['premium_excluding_tax_equivalent', minimumAmount],
      ['premium_including_tax', minimumAmount],
    ] as const;
    previewFields.forEach(([fieldName, value]) => {
      const fieldPath = path(index, fieldName);
      if (toNumber(form.getValues(fieldPath) as string) !== toNumber(value)) {
        form.setValue(fieldPath, value);
      }
    });
  }, [form, index, riskId, ruleListQuery.data, committedSumInsured]);

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

    setValueIfChanged(form, path(index, 'rating_result_metadata'), {
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
    if (selectedTaxCodes.length > 0 && taxRulesQuery.isLoading) return undefined;

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
          tax_rule_ids:
            applicableTaxRuleIds.length > 0 ? applicableTaxRuleIds : undefined,
        },
        {
          onSuccess: (result) => {
            if (!mountedRef.current || token !== requestTokenRef.current) {
              return;
            }

            const currentRow = form.getValues(`risks.${index}`);
            const updatedRow = applyRiskPremiumResult(currentRow, result);

            setValueIfChanged(form, path(index, 'sum_insured'), updatedRow.sum_insured);
            setValueIfChanged(
              form,
              path(index, 'sum_insured_equivalent'),
              updatedRow.sum_insured_equivalent,
            );
            setValueIfChanged(form, path(index, 'premium_rate'), updatedRow.premium_rate);
            setValueIfChanged(
              form,
              path(index, 'premium_before_discount'),
              updatedRow.premium_before_discount,
            );
            setValueIfChanged(
              form,
              path(index, 'discounts_offered'),
              updatedRow.discounts_offered,
            );
            setValueIfChanged(
              form,
              path(index, 'premium_after_discount'),
              updatedRow.premium_after_discount,
            );
            setValueIfChanged(
              form,
              path(index, 'premium_excluding_tax_equivalent'),
              updatedRow.premium_excluding_tax_equivalent,
            );
            setValueIfChanged(
              form,
              path(index, 'taxes_charged'),
              updatedRow.taxes_charged,
            );
            setValueIfChanged(
              form,
              path(index, 'premium_including_tax'),
              updatedRow.premium_including_tax,
            );
            setValueIfChanged(
              form,
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
          onError: () => {
            if (!mountedRef.current || token !== requestTokenRef.current) {
              return;
            }

            // The pricing_quote_id is invalidated on failure so a stale,
            // possibly-no-longer-accurate quote can never be submitted —
            // the last-known premium figures stay visible alongside the
            // error banner (PricingStatusAlert), they just no longer carry
            // a usable quote reference.
            const existingMetadata = form.getValues(
              path(index, 'rating_result_metadata'),
            ) as Record<string, unknown> | null;
            setValueIfChanged(
              form,
              path(index, 'rating_result_metadata'),
              {
                ...(existingMetadata ?? {}),
                pricing_quote_id: null,
                pricing_status: 'ERROR',
                pricing_input_signature: currentPricingSignature,
              } as never,
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
    requestedDiscountRate,
    selectedTaxCodes.length,
    taxRulesQuery.isLoading,
    applicableTaxRuleIdsKey,
    currentPricingSignature,
  ]);

  return {
    requiredFactorsQuery,
    ruleListQuery,
    calculateMutation,
    handleSumInsuredBlur,
  };
}
