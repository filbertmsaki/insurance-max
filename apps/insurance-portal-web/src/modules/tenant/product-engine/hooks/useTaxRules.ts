import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { taxRulesApi } from '@/modules/tenant/product-engine/api/tax-rules';
import { getApiErrorMessage } from '@/lib/api-error';
import { useServerTable } from '@/components/data-table';
import { peKeys } from './query-keys';
import type { CreateTaxRuleDto, ProductTaxRule } from '@/types/product-engine';

/** Tax rules, paged/searched/sorted on the server (company-scoped by the API). */
export function useTaxRulesTable() {
  return useServerTable<ProductTaxRule>({
    queryKey: [...peKeys.taxRules.all(), 'table'],
    fetcher: (params, signal) => taxRulesApi.page(params, signal),
    defaultSortBy: 'effective_from',
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
