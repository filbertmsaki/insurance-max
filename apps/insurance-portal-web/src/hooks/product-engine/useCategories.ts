import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { categoriesApi } from '@/api/product-engine/categories'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { CategoryQueryParams, CreateCategoryDto, UpdateCategoryDto } from '@/types/product-engine'

export function useCategoryList(params: CategoryQueryParams) {
  return useQuery({
    queryKey: peKeys.categories.lists(params),
    queryFn: () => categoriesApi.getList(params),
    staleTime: 30_000,
  })
}

export function useAllActiveCategories() {
  return useQuery({
    queryKey: peKeys.categories.allActive(),
    queryFn: categoriesApi.getAllActive,
    staleTime: 60_000,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryDto) => categoriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() })
      toast.success('Category created')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDto }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() })
      toast.success('Category updated')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.categories.all() })
      toast.success('Category deleted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
