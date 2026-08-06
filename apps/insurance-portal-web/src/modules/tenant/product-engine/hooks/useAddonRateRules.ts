import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addonRateRulesApi } from '@/modules/tenant/product-engine/api/addon-rate-rules';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  CreateAddonRateRuleDto,
  UpdateAddonRateRuleDto,
} from '@/types/product-engine';

export function useAddonRateRulesByRateBook(rateBookId: string) {
  return useQuery({
    queryKey: peKeys.addonRateRules.byRateBook(rateBookId),
    queryFn: () => addonRateRulesApi.list(rateBookId),
    staleTime: 30_000,
    enabled: !!rateBookId,
  });
}

export function useCreateAddonRateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rateBookId,
      data,
    }: {
      rateBookId: string;
      data: CreateAddonRateRuleDto;
    }) => addonRateRulesApi.create(rateBookId, data),
    onSuccess: (_data, { rateBookId }) => {
      qc.invalidateQueries({
        queryKey: peKeys.addonRateRules.byRateBook(rateBookId),
      });
      toast.success('Add-on rate rule created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateAddonRateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rateBookId,
      ruleId,
      data,
    }: {
      rateBookId: string;
      ruleId: string;
      data: UpdateAddonRateRuleDto;
    }) => addonRateRulesApi.update(rateBookId, ruleId, data),
    onSuccess: (_data, { rateBookId }) => {
      qc.invalidateQueries({
        queryKey: peKeys.addonRateRules.byRateBook(rateBookId),
      });
      toast.success('Add-on rate rule updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteAddonRateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rateBookId,
      ruleId,
    }: {
      rateBookId: string;
      ruleId: string;
    }) => addonRateRulesApi.delete(rateBookId, ruleId),
    onSuccess: (_data, { rateBookId }) => {
      qc.invalidateQueries({
        queryKey: peKeys.addonRateRules.byRateBook(rateBookId),
      });
      toast.success('Add-on rate rule removed');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
