import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import { calculatorApi } from '@/modules/tenant/product-engine/api/calculator';
import { useAllActiveCategories, useAllActiveProducts, useSubClassesByProduct, useRisksByProduct } from '@/modules/tenant/product-engine/hooks';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { motorApi } from '@/modules/tenant/motor/api';
import { quotationsApi } from './api';
import { buildQuotationPayload } from './schemas';
import type { QuotationFormSchemaValues } from './schemas';
import type { QuotationListParams, QuotationRecord } from './types';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { buildQuotationTiramisPayload } from '@/modules/tenant/tiramis/utils';

const quotationKeys = {
  all: ['quotations'] as const,
  list: (params: QuotationListParams) => ['quotations', 'list', params] as const,
  detail: (id: string) => ['quotations', 'detail', id] as const,
  risks: (quotationId: string) => ['quotations', 'risks', quotationId] as const,
  breakdowns: (quotationId: string) => ['quotations', 'breakdowns', quotationId] as const,
  history: (quotationId: string) => ['quotations', 'history', quotationId] as const,
};

export function useQuotationsList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? 'all';
  const quotationType = params.get('quotation_type') ?? 'all';
  const customerId = params.get('customer_id') ?? 'all';
  const productId = params.get('product_id') ?? 'all';

  const queryParams = useMemo<QuotationListParams>(() => ({
    page,
    limit,
    search: search || undefined,
    status: status === 'all' ? undefined : (status as QuotationListParams['status']),
    quotation_type: quotationType === 'all' ? undefined : (quotationType as QuotationListParams['quotation_type']),
    customer_id: customerId === 'all' ? undefined : customerId,
    product_id: productId === 'all' ? undefined : productId,
  }), [page, limit, search, status, quotationType, customerId, productId]);

  const { data, isLoading, error } = useQuery({
    queryKey: quotationKeys.list(queryParams),
    queryFn: () => quotationsApi.getList(queryParams),
    staleTime: 30_000,
  });

  const setParam = useCallback((key: string, value: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key);
      else next.set(key, value);
      next.set('page', '1');
      return next;
    });
  }, [setParams]);

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    search,
    status,
    quotationType,
    customerId,
    productId,
    setSearch: (value: string) => setParam('search', value),
    setStatus: (value: string) => setParam('status', value === 'all' ? null : value),
    setQuotationType: (value: string) => setParam('quotation_type', value === 'all' ? null : value),
    setCustomerId: (value: string) => setParam('customer_id', value === 'all' ? null : value),
    setProductId: (value: string) => setParam('product_id', value === 'all' ? null : value),
    setPage: (value: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('page', String(value)); return next; }),
    setLimit: (value: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('limit', String(value)); next.set('page', '1'); return next; }),
  };
}

export function useQuotationDetail(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.detail(id) : quotationKeys.detail(''),
    queryFn: () => quotationsApi.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: QuotationFormSchemaValues) => quotationsApi.create(buildQuotationPayload(values)),
    onSuccess: (quotation) => {
      qc.invalidateQueries({ queryKey: quotationKeys.all });
      qc.setQueryData(quotationKeys.detail(quotation.id), quotation);
      toast.success('Quotation created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCreateQuotationAndSubmitToTiramis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: QuotationFormSchemaValues) => {
      const quotation = await quotationsApi.create(buildQuotationPayload(values));
      try {
        const submissionResult = await tiramisApi.submit(buildQuotationTiramisPayload(quotation)) as { submission?: { id: string } };
        return { quotation, submission: submissionResult.submission ?? null, submissionError: null };
      } catch (error) {
        return { quotation, submission: null, submissionError: getApiErrorMessage(error) };
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: quotationKeys.all });
      qc.invalidateQueries({ queryKey: ['tiramis', 'tenant-submissions'] });
      if (result.submission) {
        toast.success('Quotation created and submitted to TIRAMIS');
      } else {
        toast.warning(result.submissionError ? `Quotation created, but TIRAMIS submission needs attention: ${result.submissionError}` : 'Quotation created, but TIRAMIS submission needs attention');
      }
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateQuotation(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: QuotationFormSchemaValues) => quotationsApi.update(id!, buildQuotationPayload(values)),
    onSuccess: (quotation) => {
      qc.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) qc.setQueryData(quotationKeys.detail(id), quotation);
      toast.success('Quotation updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotationKeys.all });
      toast.success('Quotation deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRestoreQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotationKeys.all });
      toast.success('Quotation restored');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useQuotationCustomers() {
  return useQuery({
    queryKey: ['quotations', 'customers'],
    queryFn: async () => (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useQuotationCategories() {
  return useAllActiveCategories();
}

export function useQuotationProducts(categoryId?: string) {
  return useAllActiveProducts(categoryId && categoryId !== 'all' ? categoryId : undefined);
}

export function useQuotationSubClasses(productId?: string) {
  return useSubClassesByProduct(productId && productId !== 'all' ? productId : '');
}

export function useQuotationRisks(productId?: string) {
  return useRisksByProduct({ product_id: productId && productId !== 'all' ? productId : undefined });
}

export function useQuotationBranches() {
  return useQuery({
    queryKey: ['quotations', 'branches'],
    queryFn: () => branchesApi.getAllBranches(),
    staleTime: 60_000,
  });
}

export function useQuotationDepartments(branchId?: string) {
  return useQuery({
    queryKey: ['quotations', 'departments', branchId ?? 'all'],
    queryFn: async () => {
      const page = await departmentsApi.getDepartments({ page: 1, limit: API_MAX_LIST_LIMIT });
      const all = page.data;
      if (!branchId) return all;
      return all.filter((dept) => (dept.branch_id ?? dept.branch?.id ?? '') === branchId);
    },
    staleTime: 60_000,
  });
}

/**
 * Active TIRAMIS sale points for a branch. The wizard must let the user pick
 * one explicitly whenever there's more than one — the backend's own auto-pick
 * (`tiramis-integration.service.ts`) throws if a branch has multiple active
 * sale points with no default, so relying on server-side resolution silently
 * working is not safe (see Phase 0 backend gap #5 in the wizard plan).
 */
export function useQuotationSalePoints(branchId?: string) {
  return useQuery({
    queryKey: ['quotations', 'sale-points', branchId ?? 'none'],
    queryFn: () => tiramisApi.getSalePoints(branchId),
    enabled: !!branchId,
    staleTime: 30_000,
  });
}

/**
 * Vehicles already linked to the policyholder's customer record, for the
 * Motor Details step's "existing vehicle" picker. There's no server-side
 * customer_id filter on the motor vehicles endpoint (FilterMotorDto only has
 * `search`) so — mirroring the standalone motor module's own list hook — this
 * fetches the full company vehicle list once and filters client-side.
 */
export function useQuotationVehicles(customerId?: string) {
  return useQuery({
    queryKey: ['quotations', 'vehicles', customerId ?? 'none'],
    queryFn: async () => {
      const page = await motorApi.getVehicles({ limit: API_MAX_LIST_LIMIT });
      if (!customerId) return page.data;
      return page.data.filter((vehicle) => vehicle.customer_id === customerId);
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useQuotationCalculator() {
  return useMutation({
    mutationFn: (data: { risk_id: string; sum_insured: number; factors: Record<string, string | number | boolean> }) =>
      calculatorApi.calculateSingle(data),
  });
}

export function useQuotationCurrentCompanyId() {
  const companyId = useAuthStore((state) => state.company?.id ?? state.user?.companyId ?? '');
  return companyId;
}

export { quotationKeys };
export type { QuotationRecord };
