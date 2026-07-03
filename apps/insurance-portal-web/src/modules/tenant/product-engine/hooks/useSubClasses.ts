import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { subClassesApi } from '@/modules/tenant/product-engine/api/sub-classes';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  SubClassQueryParams,
  CreateSubClassDto,
  UpdateSubClassDto,
} from '@/types/product-engine';

export function useSubClassList(params: SubClassQueryParams) {
  return useQuery({
    queryKey: peKeys.subClasses.lists(params),
    queryFn: () => subClassesApi.getList(params),
    staleTime: 30_000,
  });
}

export function useSubClassesByProduct(productId: string) {
  return useQuery({
    queryKey: peKeys.subClasses.byProduct(productId),
    queryFn: () => subClassesApi.getAllByProduct(productId),
    staleTime: 60_000,
    enabled: !!productId,
  });
}

export function useCreateSubClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubClassDto) => subClassesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.subClasses.all() });
      toast.success('Sub-class created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateSubClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubClassDto }) =>
      subClassesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.subClasses.all() });
      toast.success('Sub-class updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteSubClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subClassesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.subClasses.all() });
      toast.success('Sub-class deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
