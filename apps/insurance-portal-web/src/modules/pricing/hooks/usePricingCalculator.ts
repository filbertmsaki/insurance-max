import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuleList } from '@/modules/tenant/product-engine/hooks/useRatingRules';
import { pricingApi } from '../api/pricing';

export function usePricingCalculator() {
  const calculateSingleMutation = useMutation({
    mutationFn: pricingApi.calculateSingle,
  });

  const calculateMultiMutation = useMutation({
    mutationFn: pricingApi.calculateMulti,
  });

  const calculateFleetMutation = useMutation({
    mutationFn: pricingApi.calculateFleet,
  });

  return {
    calculateSingleMutation,
    calculateMultiMutation,
    calculateFleetMutation,
  };
}

export function usePricingRatingRequirements(riskId?: string) {
  return useQuery({
    queryKey: ['pricing', 'rating-requirements', riskId ?? 'none'],
    queryFn: () => pricingApi.getRatingRequirements(riskId!),
    enabled: !!riskId,
    staleTime: 30_000,
  });
}

export function usePricingRequiredFactors(riskId: string) {
  return useQuery({
    queryKey: ['pricing', 'required-factors', riskId || 'none'],
    queryFn: () => pricingApi.getRatingRequirements(riskId),
    select: (data) => data.required_factors,
    enabled: !!riskId,
    staleTime: 30_000,
  });
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
