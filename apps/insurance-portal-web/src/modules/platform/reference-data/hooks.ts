import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { referenceDataApi } from './api';
import type { ReferenceKind, ReferenceListParams } from './types';

export const referenceDataKeys = {
  all: ['reference-data'] as const,
  countries: (params?: ReferenceListParams) =>
    [...referenceDataKeys.all, 'countries', params ?? {}] as const,
  regions: (params?: ReferenceListParams) =>
    [...referenceDataKeys.all, 'regions', params ?? {}] as const,
  districts: (params?: ReferenceListParams) =>
    [...referenceDataKeys.all, 'districts', params ?? {}] as const,
  currencies: (params?: ReferenceListParams) =>
    [...referenceDataKeys.all, 'currencies', params ?? {}] as const,
};

export function useReferenceCountries(params?: ReferenceListParams) {
  return useQuery({
    queryKey: referenceDataKeys.countries(params),
    queryFn: () => referenceDataApi.countries(params),
    staleTime: 5 * 60_000,
  });
}

export function useReferenceRegions(params?: ReferenceListParams) {
  return useQuery({
    queryKey: referenceDataKeys.regions(params),
    queryFn: () => referenceDataApi.regions(params),
    staleTime: 5 * 60_000,
    enabled: params?.country_id !== '',
  });
}

export function useReferenceDistricts(params?: ReferenceListParams) {
  return useQuery({
    queryKey: referenceDataKeys.districts(params),
    queryFn: () => referenceDataApi.districts(params),
    staleTime: 5 * 60_000,
    enabled: params?.region_id !== '',
  });
}

export function useReferenceCurrencies(params?: ReferenceListParams) {
  return useQuery({
    queryKey: referenceDataKeys.currencies(params),
    queryFn: () => referenceDataApi.currencies(params),
    staleTime: 5 * 60_000,
  });
}

export function useReferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      kind,
      id,
      data,
    }: {
      action: 'create' | 'update' | 'activate' | 'deactivate' | 'delete';
      kind: ReferenceKind;
      id?: string;
      data?: Record<string, unknown>;
    }) => {
      if (action === 'create') return referenceDataApi.create(kind, data ?? {});
      if (action === 'update')
        return referenceDataApi.update(kind, id!, data ?? {});
      if (action === 'activate') return referenceDataApi.activate(kind, id!);
      if (action === 'deactivate')
        return referenceDataApi.deactivate(kind, id!);
      return referenceDataApi.remove(kind, id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      toast.success('Reference data updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
