import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import { policiesApi } from '@/modules/tenant/policies/api';
import { quotationsApi } from '@/modules/tenant/quotations/api';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { billingApi } from './api';
import {
  buildCommissionPaymentPayload,
  buildCommissionTransactionPayload,
  buildInvoicePayload,
  buildPaymentTransactionPayload,
  buildReceiptPayload,
  type CommissionPaymentFormValues,
  type CommissionTransactionFormValues,
  type InvoiceFormValues,
  type PaymentTransactionFormValues,
  type ReceiptFormValues,
} from './schemas';
import type {
  BillingListParams,
  CommissionPaymentRecord,
  CommissionTransactionRecord,
  InvoiceRecord,
  PaymentTransactionRecord,
  ReceiptRecord,
} from './types';

const billingKeys = {
  all: ['billing'] as const,
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  invoice: (id: string) => [...billingKeys.all, 'invoice', id] as const,
  receipts: () => [...billingKeys.all, 'receipts'] as const,
  receipt: (id: string) => [...billingKeys.all, 'receipt', id] as const,
  paymentTransactions: () =>
    [...billingKeys.all, 'payment-transactions'] as const,
  paymentTransaction: (id: string) =>
    [...billingKeys.all, 'payment-transaction', id] as const,
  commissionTransactions: () =>
    [...billingKeys.all, 'commission-transactions'] as const,
  commissionTransaction: (id: string) =>
    [...billingKeys.all, 'commission-transaction', id] as const,
  commissionPayments: () =>
    [...billingKeys.all, 'commission-payments'] as const,
  commissionPayment: (id: string) =>
    [...billingKeys.all, 'commission-payment', id] as const,
};

function useListParams(defaultSearchKey = 'search') {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get(defaultSearchKey) ?? '';

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
        return next;
      });
    },
    [setParams],
  );

  return { params, setParams, page, limit, search, setParam };
}

export function useInvoicesList() {
  const { page, limit, search, setParam, setParams } = useListParams();
  const queryParams = useMemo<BillingListParams>(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search],
  );
  const query = useQuery({
    queryKey: [...billingKeys.invoices(), queryParams],
    queryFn: () => billingApi.getInvoices(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('search', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
}

export function useInvoiceDetail(id?: string) {
  return useQuery({
    queryKey: id ? billingKeys.invoice(id) : billingKeys.invoice(''),
    queryFn: () => billingApi.getInvoice(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const companyId = useAuthStore(
    (s) => s.company?.id ?? s.user?.companyId ?? '',
  );
  return useMutation({
    mutationFn: (values: InvoiceFormValues) =>
      billingApi.createInvoice(
        buildInvoicePayload({
          ...values,
          insurer_company_id: values.insurer_company_id || companyId,
        }),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.invoices() });
      qc.setQueryData(billingKeys.invoice(record.id), record);
      toast.success('Invoice created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateInvoice(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: InvoiceFormValues) =>
      billingApi.updateInvoice(id!, buildInvoicePayload(values)),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.invoices() });
      if (id) qc.setQueryData(billingKeys.invoice(id), record);
      toast.success('Invoice updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.invoices() });
      toast.success('Invoice deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useReceiptsList() {
  const { page, limit, search, setParam, setParams } = useListParams();
  const queryParams = useMemo<BillingListParams>(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search],
  );
  const query = useQuery({
    queryKey: [...billingKeys.receipts(), queryParams],
    queryFn: () => billingApi.getReceipts(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('search', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
}

export function useReceiptDetail(id?: string) {
  return useQuery({
    queryKey: id ? billingKeys.receipt(id) : billingKeys.receipt(''),
    queryFn: () => billingApi.getReceipt(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ReceiptFormValues) =>
      billingApi.createReceipt(buildReceiptPayload(values)),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.receipts() });
      qc.setQueryData(billingKeys.receipt(record.id), record);
      toast.success('Receipt created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateReceipt(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ReceiptFormValues) =>
      billingApi.updateReceipt(id!, buildReceiptPayload(values)),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.receipts() });
      if (id) qc.setQueryData(billingKeys.receipt(id), record);
      toast.success('Receipt updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.deleteReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.receipts() });
      toast.success('Receipt deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePaymentTransactionsList() {
  const { page, limit, search, setParam, setParams } = useListParams();
  const queryParams = useMemo<BillingListParams>(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search],
  );
  const query = useQuery({
    queryKey: [...billingKeys.paymentTransactions(), queryParams],
    queryFn: () => billingApi.getPaymentTransactions(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('search', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
}

export function usePaymentTransactionDetail(id?: string) {
  return useQuery({
    queryKey: id
      ? billingKeys.paymentTransaction(id)
      : billingKeys.paymentTransaction(''),
    queryFn: () => billingApi.getPaymentTransaction(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreatePaymentTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PaymentTransactionFormValues) =>
      billingApi.createPaymentTransaction(
        buildPaymentTransactionPayload(values),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.paymentTransactions() });
      qc.setQueryData(billingKeys.paymentTransaction(record.id), record);
      toast.success('Payment transaction created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdatePaymentTransaction(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PaymentTransactionFormValues) =>
      billingApi.updatePaymentTransaction(
        id!,
        buildPaymentTransactionPayload(values),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.paymentTransactions() });
      if (id) qc.setQueryData(billingKeys.paymentTransaction(id), record);
      toast.success('Payment transaction updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeletePaymentTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.deletePaymentTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.paymentTransactions() });
      toast.success('Payment transaction deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCommissionTransactionsList() {
  const { page, limit, search, setParam, setParams } = useListParams();
  const queryParams = useMemo<BillingListParams>(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search],
  );
  const query = useQuery({
    queryKey: [...billingKeys.commissionTransactions(), queryParams],
    queryFn: () => billingApi.getCommissionTransactions(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('search', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
}

export function useCommissionTransactionDetail(id?: string) {
  return useQuery({
    queryKey: id
      ? billingKeys.commissionTransaction(id)
      : billingKeys.commissionTransaction(''),
    queryFn: () => billingApi.getCommissionTransaction(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateCommissionTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CommissionTransactionFormValues) =>
      billingApi.createCommissionTransaction(
        buildCommissionTransactionPayload(values),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionTransactions() });
      qc.setQueryData(billingKeys.commissionTransaction(record.id), record);
      toast.success('Commission transaction created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateCommissionTransaction(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CommissionTransactionFormValues) =>
      billingApi.updateCommissionTransaction(
        id!,
        buildCommissionTransactionPayload(values),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionTransactions() });
      if (id) qc.setQueryData(billingKeys.commissionTransaction(id), record);
      toast.success('Commission transaction updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteCommissionTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.deleteCommissionTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionTransactions() });
      toast.success('Commission transaction deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCommissionPaymentsList() {
  const { page, limit, search, setParam, setParams } = useListParams();
  const queryParams = useMemo<BillingListParams>(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search],
  );
  const query = useQuery({
    queryKey: [...billingKeys.commissionPayments(), queryParams],
    queryFn: () => billingApi.getCommissionPayments(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('search', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
}

export function useCommissionPaymentDetail(id?: string) {
  return useQuery({
    queryKey: id
      ? billingKeys.commissionPayment(id)
      : billingKeys.commissionPayment(''),
    queryFn: () => billingApi.getCommissionPayment(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateCommissionPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CommissionPaymentFormValues) =>
      billingApi.createCommissionPayment(buildCommissionPaymentPayload(values)),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionPayments() });
      qc.setQueryData(billingKeys.commissionPayment(record.id), record);
      toast.success('Commission payment created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateCommissionPayment(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CommissionPaymentFormValues) =>
      billingApi.updateCommissionPayment(
        id!,
        buildCommissionPaymentPayload(values),
      ),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionPayments() });
      if (id) qc.setQueryData(billingKeys.commissionPayment(id), record);
      toast.success('Commission payment updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteCommissionPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.deleteCommissionPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.commissionPayments() });
      toast.success('Commission payment deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useBillingCustomers() {
  return useQuery({
    queryKey: [...billingKeys.all, 'customers'],
    queryFn: async () =>
      (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useBillingPolicies() {
  return useQuery({
    queryKey: [...billingKeys.all, 'policies'],
    queryFn: async () =>
      (await policiesApi.getList({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useBillingQuotations() {
  return useQuery({
    queryKey: [...billingKeys.all, 'quotations'],
    queryFn: async () =>
      (await quotationsApi.getList({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: [...billingKeys.all, 'invoices', 'all'],
    queryFn: async () =>
      (await billingApi.getInvoices({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useBillingCurrentCompanyId() {
  return useAuthStore((s) => s.company?.id ?? s.user?.companyId ?? '');
}

export { billingKeys };
export type {
  InvoiceRecord,
  ReceiptRecord,
  PaymentTransactionRecord,
  CommissionTransactionRecord,
  CommissionPaymentRecord,
};
