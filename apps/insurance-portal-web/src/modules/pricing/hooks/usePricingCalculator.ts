import { useMutation, useQuery } from '@tanstack/react-query';
import { useRequiredFactorsByRisk } from '@/modules/tenant/product-engine/hooks/useRequiredFactors';
import { useRuleList } from '@/modules/tenant/product-engine/hooks/useRatingRules';
import { pricingApi } from '../api/pricing';

export function usePricingCalculator() {
  const calculateSingleMutation = useMutation({
    mutationFn: pricingApi.calculateSingle,
  });

  const calculateMultiMutation = useMutation({
    mutationFn: pricingApi.calculateMulti,
  });

  return {
    calculateSingleMutation,
    calculateMultiMutation,
  };
}

export function usePricingRequiredFactors(riskId: string) {
  return useRequiredFactorsByRisk(riskId);
}

export function usePricingRulePreview(riskId: string) {
  return useRuleList({ risk_id: riskId || undefined });
}

export function usePricingExplanation(riskId?: string) {
  return useQuery({
    queryKey: ['pricing', 'explain', riskId ?? 'none'],
    queryFn: () => pricingApi.explainRisk(riskId!),
    enabled: !!riskId,
    staleTime: 30_000,
  });
}
