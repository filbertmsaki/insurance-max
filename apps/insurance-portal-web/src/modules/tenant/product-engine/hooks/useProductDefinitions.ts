import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productDefinitionsApi } from '@/modules/tenant/product-engine/api/product-definitions';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type { UpsertProductVersionDto } from '@/types/product-engine';

export function useProductVersions(productId: string) {
  return useQuery({
    queryKey: peKeys.productVersions.byProduct(productId),
    queryFn: () => productDefinitionsApi.listVersions(productId),
    enabled: Boolean(productId),
    staleTime: 15_000,
  });
}

export function useProductVersion(productId: string, versionId: string) {
  return useQuery({
    queryKey: peKeys.productVersions.detail(productId, versionId),
    queryFn: () => productDefinitionsApi.findVersion(productId, versionId),
    enabled: Boolean(productId && versionId),
  });
}

export function usePublishedProductDefinition(
  productId: string | undefined,
  params?: { sub_class_id?: string; effective_date?: string },
) {
  return useQuery({
    queryKey: peKeys.productVersions.published(productId ?? '', params),
    queryFn: () =>
      productDefinitionsApi.publishedDefinition(productId!, params),
    enabled: Boolean(productId),
    retry: false,
  });
}

export function useCreateProductVersion(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => productDefinitionsApi.createVersion(productId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.byProduct(productId),
      });
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('New draft version created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateProductVersionDraft(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      data,
    }: {
      versionId: string;
      data: UpsertProductVersionDto;
    }) => productDefinitionsApi.updateDraft(productId, versionId, data),
    onSuccess: (_data, { versionId }) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      toast.success('Draft saved');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useSubmitProductVersionForReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      productDefinitionsApi.submitReview(productId, versionId),
    onSuccess: (_data, versionId) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      toast.success('Submitted for review');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRejectProductVersion(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      comments,
    }: {
      versionId: string;
      comments: string;
    }) => productDefinitionsApi.reject(productId, versionId, comments),
    onSuccess: (_data, { versionId }) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      toast.success('Version rejected');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useReturnProductVersionToDraft(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      productDefinitionsApi.returnDraft(productId, versionId),
    onSuccess: (_data, versionId) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      toast.success('Returned to draft');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePublishProductVersion(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      productDefinitionsApi.publish(productId, versionId),
    onSuccess: (_data, versionId) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.byProduct(productId),
      });
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('Product version published');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRetireProductVersion(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      productDefinitionsApi.retire(productId, versionId),
    onSuccess: (_data, versionId) => {
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.detail(productId, versionId),
      });
      qc.invalidateQueries({
        queryKey: peKeys.productVersions.byProduct(productId),
      });
      qc.invalidateQueries({ queryKey: peKeys.products.all() });
      toast.success('Product version retired');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
