import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ratingRulesApi } from '@/modules/tenant/product-engine/api/rating-rules'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { RuleQueryParams, CreateRuleDto, UpdateRuleDto } from '@/types/product-engine'

export function useRuleList(params: RuleQueryParams) {
  return useQuery({
    queryKey: peKeys.rules.lists(params),
    queryFn: () => ratingRulesApi.getList(params),
    staleTime: 30_000,
    enabled: !!params.risk_id,
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRuleDto) => ratingRulesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rules.all() })
      toast.success('Rating rule created')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRuleDto }) =>
      ratingRulesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rules.all() })
      toast.success('Rating rule updated')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ratingRulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rules.all() })
      toast.success('Rating rule deleted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
