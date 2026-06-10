import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { requiredFactorsApi } from '@/api/product-engine/required-factors'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { CreateRequiredFactorDto, UpdateRequiredFactorDto } from '@/types/product-engine'

export function useRequiredFactorsByRisk(riskId: string) {
  return useQuery({
    queryKey: peKeys.requiredFactors.byRisk(riskId),
    queryFn: () => requiredFactorsApi.getByRisk(riskId),
    staleTime: 30_000,
    enabled: !!riskId,
  })
}

export function useAddRequiredFactor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequiredFactorDto) => requiredFactorsApi.create(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: peKeys.requiredFactors.byRisk(vars.risk_id) })
      toast.success('Factor added')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useUpdateRequiredFactor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data, riskId }: { id: string; data: UpdateRequiredFactorDto; riskId: string }) =>
      requiredFactorsApi.update(id, data).then((r) => ({ ...r, riskId })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: peKeys.requiredFactors.byRisk(r.riskId) })
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRemoveRequiredFactor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, riskId }: { id: string; riskId: string }) =>
      requiredFactorsApi.delete(id).then(() => riskId),
    onSuccess: (riskId) => {
      qc.invalidateQueries({ queryKey: peKeys.requiredFactors.byRisk(riskId) })
      toast.success('Factor removed')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
