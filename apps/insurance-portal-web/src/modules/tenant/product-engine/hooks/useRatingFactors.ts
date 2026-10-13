import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ratingFactorsApi } from '@/modules/tenant/product-engine/api/rating-factors';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  CreateFactorDto,
  UpdateFactorDto,
} from '@/types/product-engine';

export function useAllFactors() {
  return useQuery({
    queryKey: peKeys.factors.allActive(),
    queryFn: ratingFactorsApi.getAll,
    staleTime: 60_000,
  });
}

export function useCreateFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFactorDto) => ratingFactorsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.factors.all() });
      toast.success('Rating factor created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFactorDto }) =>
      ratingFactorsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.factors.all() });
      toast.success('Rating factor updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ratingFactorsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.factors.all() });
      toast.success('Rating factor deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
