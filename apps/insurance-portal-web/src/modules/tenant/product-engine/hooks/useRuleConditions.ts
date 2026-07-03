import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ruleConditionsApi } from '@/modules/tenant/product-engine/api/rule-conditions';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  CreateConditionDto,
  UpdateConditionDto,
} from '@/types/product-engine';

export function useConditionsByRule(ruleId: string) {
  return useQuery({
    queryKey: peKeys.conditions.byRule(ruleId),
    queryFn: () => ruleConditionsApi.getByRule(ruleId),
    staleTime: 30_000,
    enabled: !!ruleId,
  });
}

export function useCreateCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConditionDto) => ruleConditionsApi.create(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: peKeys.conditions.byRule(vars.rule_id),
      });
      toast.success('Condition added');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
      ruleId,
    }: {
      id: string;
      data: UpdateConditionDto;
      ruleId: string;
    }) => ruleConditionsApi.update(id, data).then((r) => ({ ...r, ruleId })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: peKeys.conditions.byRule(r.ruleId) });
      toast.success('Condition updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ruleId }: { id: string; ruleId: string }) =>
      ruleConditionsApi.delete(id).then(() => ruleId),
    onSuccess: (ruleId) => {
      qc.invalidateQueries({ queryKey: peKeys.conditions.byRule(ruleId) });
      toast.success('Condition removed');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
