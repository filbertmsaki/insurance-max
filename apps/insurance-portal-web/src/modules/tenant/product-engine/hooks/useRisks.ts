import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { risksApi } from '@/modules/tenant/product-engine/api/risks';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  CreateRiskDto,
  UpdateRiskDto,
} from '@/types/product-engine';

export function useRisksByProduct(filters: {
  product_id?: string;
  category_id?: string;
}) {
  const { product_id, category_id } = filters;
  return useQuery({
    queryKey: peKeys.risks.byFilter(filters),
    queryFn: () => risksApi.getAllActive(filters),
    staleTime: 60_000,
    enabled: !!product_id || !!category_id,
  });
}

export function useCreateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRiskDto) => risksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.risks.all() });
      toast.success('Risk created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRiskDto }) =>
      risksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.risks.all() });
      toast.success('Risk updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => risksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.risks.all() });
      toast.success('Risk deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
