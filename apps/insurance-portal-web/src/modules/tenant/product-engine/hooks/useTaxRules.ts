import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { taxRulesApi } from '@/modules/tenant/product-engine/api/tax-rules';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type { CreateTaxRuleDto } from '@/types/product-engine';

export function useTaxRuleList() {
  return useQuery({
    queryKey: peKeys.taxRules.all(),
    queryFn: () => taxRulesApi.getList(),
    staleTime: 30_000,
  });
}

export function useCreateTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaxRuleDto) => taxRulesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.taxRules.all() });
      toast.success('Tax rule created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taxRulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.taxRules.all() });
      toast.success('Tax rule deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRestoreTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taxRulesApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.taxRules.all() });
      toast.success('Tax rule restored');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
