import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { categoriesApi } from '@/modules/tenant/product-engine/api/categories';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  CreateCategoryDto,
  InsuranceBusinessLine,
  UpdateCategoryDto,
} from '@/types/product-engine';

export function useAllActiveCategories(business_line?: InsuranceBusinessLine) {
  return useQuery({
    queryKey: peKeys.categories.allActive(business_line),
    queryFn: () => categoriesApi.getAllActive(business_line),
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryDto) => categoriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() });
      toast.success('Category created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDto }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() });
      toast.success('Category updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() });
      toast.success('Category deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
