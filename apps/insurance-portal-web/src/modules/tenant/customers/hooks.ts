import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from './api';
import { buildCustomerPayload } from './schemas';
import { type CustomerFormValues, type CustomerListParams } from './types';
import { getApiErrorMessage } from '@/lib/api-error';

const customersKeys = {
  all: ['customers'] as const,
  lists: () => [...customersKeys.all, 'list'] as const,
  list: (params: CustomerListParams) =>
    [...customersKeys.lists(), params] as const,
  detail: (id: string) => [...customersKeys.all, 'detail', id] as const,
  versions: (id: string) => [...customersKeys.detail(id), 'versions'] as const,
  audit: (id: string) => [...customersKeys.detail(id), 'audit'] as const,
};

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: id ? customersKeys.detail(id) : customersKeys.detail(''),
    queryFn: () => customersApi.getCustomer(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCustomerVersions(id?: string) {
  return useQuery({
    queryKey: id ? customersKeys.versions(id) : customersKeys.versions(''),
    queryFn: () => customersApi.getCustomerVersions(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCustomerAuditHistory(id?: string) {
  return useQuery({
    queryKey: id ? customersKeys.audit(id) : customersKeys.audit(''),
    queryFn: () => customersApi.getCustomerAuditHistory(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) =>
      customersApi.createCustomer(buildCustomerPayload(values)),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      queryClient.setQueryData(customersKeys.detail(created.id), created);
      toast.success('Customer created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateCustomer(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) =>
      customersApi.updateCustomer(id!, buildCustomerPayload(values)),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      if (id) queryClient.setQueryData(customersKeys.detail(id), updated);
      toast.success('Customer updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      toast.success('Customer deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.restoreCustomer(id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      queryClient.setQueryData(customersKeys.detail(restored.id), restored);
      toast.success('Customer restored');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export { customersKeys };
export { getCustomerDisplayName } from './types';
