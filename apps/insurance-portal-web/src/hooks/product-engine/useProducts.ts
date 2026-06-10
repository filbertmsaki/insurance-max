import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '@/api/product-engine/products'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { ProductQueryParams, CreateProductDto, UpdateProductDto } from '@/types/product-engine'

export function useProductList(params: ProductQueryParams) {
  return useQuery({
    queryKey: peKeys.products.lists(params),
    queryFn: () => productsApi.getList(params),
    staleTime: 30_000,
  })
}

export function useAllActiveProducts(category_id?: string) {
  return useQuery({
    queryKey: peKeys.products.allActive(category_id),
    queryFn: () => productsApi.getAllActive(category_id),
    staleTime: 60_000,
    enabled: true,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() })
      toast.success('Product created')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() })
      toast.success('Product updated')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() })
      toast.success('Product deleted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
