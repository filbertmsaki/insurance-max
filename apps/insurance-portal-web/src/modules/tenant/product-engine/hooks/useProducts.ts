import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productsApi } from '@/modules/tenant/product-engine/api/products';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  ProductQueryParams,
  CreateProductDto,
  UpdateProductDto,
} from '@/types/product-engine';

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: peKeys.products.detail(id ?? ''),
    queryFn: () => productsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useAllActiveProducts(
  params?:
    | string
    | {
        category_id?: string;
        business_line?: ProductQueryParams['business_line'];
        supports_fleet?: boolean;
      },
) {
  const normalizedParams =
    typeof params === 'string' ? { category_id: params } : params;
  return useQuery({
    queryKey: peKeys.products.allActive(normalizedParams),
    queryFn: () => productsApi.getAllActive(normalizedParams),
    staleTime: 60_000,
    enabled: true,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('Product created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('Product updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('Product deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
