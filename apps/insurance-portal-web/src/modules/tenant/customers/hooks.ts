import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
};

export type CustomerSortKey = NonNullable<CustomerListParams['sortBy']>;

export function useCustomersList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = Number(searchParams.get('limit') ?? '10');
  const customerType = (searchParams.get('customer_type') ?? 'all') as
    | CustomerListParams['customer_type']
    | 'all';
  const status = (searchParams.get('status') ?? 'all') as
    | CustomerListParams['status']
    | 'all';
  const kycStatus = (searchParams.get('kyc_status') ?? 'all') as
    | CustomerListParams['kyc_status']
    | 'all';
  const sortBy =
    (searchParams.get('sortBy') as CustomerSortKey) ?? 'created_at';
  const sortOrder =
    (searchParams.get('sortOrder') as NonNullable<
      CustomerListParams['sortOrder']
    >) ?? 'DESC';

  const [liveSearch, setLiveSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryParams: CustomerListParams = {
    page,
    limit,
    search: search || undefined,
    customer_type: customerType !== 'all' ? customerType : undefined,
    status: status !== 'all' ? status : undefined,
    kyc_status: kycStatus !== 'all' ? kycStatus : undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: customersKeys.list(queryParams),
    queryFn: () => customersApi.getCustomers(queryParams),
    placeholderData: (prev) => prev,
  });

  const setSearch = useCallback(
    (value: string) => {
      setLiveSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('q', value);
          else next.delete('q');
          next.set('page', '1');
          return next;
        });
      }, 350);
    },
    [setSearchParams],
  );

  const setFilter = useCallback(
    (key: 'customer_type' | 'status' | 'kyc_status', value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (value: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      });
    },
    [setSearchParams],
  );

  const setLimit = useCallback(
    (value: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (
      key: CustomerSortKey,
      order: NonNullable<CustomerListParams['sortOrder']>,
    ) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sortBy', key);
        next.set('sortOrder', order);
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setLiveSearch('');
    setSearchParams({});
  }, [setSearchParams]);

  return {
    customers: data?.data ?? [],
    pagination: data?.pagination,
    total: data?.pagination?.total ?? 0,
    totalPages: data?.pagination?.totalPages ?? 1,
    isLoading,
    isFetching,
    error,
    liveSearch,
    search,
    customerType,
    status,
    kycStatus,
    sortBy,
    sortOrder,
    page,
    limit,
    hasActiveFilters: !!(
      search ||
      customerType !== 'all' ||
      status !== 'all' ||
      kycStatus !== 'all' ||
      sortBy !== 'created_at' ||
      sortOrder !== 'DESC'
    ),
    setSearch,
    setFilter,
    setPage,
    setLimit,
    setSort,
    clearFilters,
  };
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: id ? customersKeys.detail(id) : customersKeys.detail(''),
    queryFn: () => customersApi.getCustomer(id!),
    enabled: !!id,
    staleTime: 30_000,
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
