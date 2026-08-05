import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { customersApi } from '@/modules/tenant/customers/api';
import { motorApi } from '@/modules/tenant/motor/api';
import { useAllFactors } from '@/modules/tenant/product-engine/hooks';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { nonMotorApi } from './api';
import {
  buildNonMotorPolicyDetailPayload,
  buildNonMotorQuotationDetailPayload,
  buildSubjectMatterFactorValuePayload,
  buildSubjectMatterPayload,
  type NonMotorPolicyDetailFormValues,
  type NonMotorQuotationDetailFormValues,
  type SubjectMatterFactorValueFormValues,
  type SubjectMatterFormValues,
} from './schemas';
import type {
  NonMotorPolicyDetailRecord,
  NonMotorQuotationDetailRecord,
  SubjectMatterFactorValueRecord,
  SubjectMatterListParams,
  SubjectMatterRecord,
} from './types';

const nonMotorKeys = {
  all: ['non-motor'] as const,
  subjectMatters: () => [...nonMotorKeys.all, 'subject-matters'] as const,
  subjectMatter: (id: string) =>
    [...nonMotorKeys.all, 'subject-matter', id] as const,
  factorValues: (subjectMatterId?: string) =>
    [...nonMotorKeys.all, 'factor-values', subjectMatterId ?? 'all'] as const,
  quotationDetails: (quotationId?: string) =>
    [...nonMotorKeys.all, 'quotation-details', quotationId ?? 'all'] as const,
  policyDetails: (policyId?: string) =>
    [...nonMotorKeys.all, 'policy-details', policyId ?? 'all'] as const,
  customers: () => [...nonMotorKeys.all, 'customers'] as const,
  quotations: () => [...nonMotorKeys.all, 'quotations'] as const,
  policies: () => [...nonMotorKeys.all, 'policies'] as const,
  quotationRisks: (quotationId: string) =>
    [...nonMotorKeys.all, 'quotation-risks', quotationId] as const,
  policyRisks: (policyId: string) =>
    [...nonMotorKeys.all, 'policy-risks', policyId] as const,
  factors: () => [...nonMotorKeys.all, 'factors'] as const,
};

export function useSubjectMattersList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('q') ?? '';

  const queryParams = useMemo<SubjectMatterListParams>(
    () => ({
      page,
      limit,
      search: search || undefined,
    }),
    [page, limit, search],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: [...nonMotorKeys.subjectMatters(), queryParams],
    queryFn: () => nonMotorApi.getSubjectMatters(queryParams),
    staleTime: 30_000,
  });

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

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    search,
    setSearch: (value: string) => setParam('q', value),
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

export function useSubjectMatter(id?: string) {
  return useQuery({
    queryKey: id
      ? nonMotorKeys.subjectMatter(id)
      : nonMotorKeys.subjectMatter(''),
    queryFn: () => nonMotorApi.getSubjectMatter(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateSubjectMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SubjectMatterFormValues) =>
      nonMotorApi.createSubjectMatter(buildSubjectMatterPayload(values)),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: nonMotorKeys.subjectMatters() });
      qc.setQueryData(nonMotorKeys.subjectMatter(created.id), created);
      toast.success('Subject matter created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateSubjectMatter(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SubjectMatterFormValues) =>
      nonMotorApi.updateSubjectMatter(id!, buildSubjectMatterPayload(values)),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: nonMotorKeys.subjectMatters() });
      if (id) qc.setQueryData(nonMotorKeys.subjectMatter(id), updated);
      toast.success('Subject matter updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteSubjectMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => nonMotorApi.deleteSubjectMatter(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nonMotorKeys.subjectMatters() });
      toast.success('Subject matter deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSubjectMatterFactorValues(subjectMatterId?: string) {
  return useQuery({
    queryKey: nonMotorKeys.factorValues(subjectMatterId),
    queryFn: () => nonMotorApi.getSubjectMatterFactorValues(subjectMatterId),
    enabled: !!subjectMatterId,
    staleTime: 30_000,
  });
}

export function useSubjectMatterOptions() {
  return useQuery({
    queryKey: [...nonMotorKeys.subjectMatters(), 'options'] as const,
    queryFn: async () =>
      (
        await nonMotorApi.getSubjectMatters({
          page: 1,
          limit: API_MAX_LIST_LIMIT,
        })
      ).data,
    staleTime: 60_000,
  });
}

export function useCreateSubjectMatterFactorValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SubjectMatterFactorValueFormValues) =>
      nonMotorApi.createSubjectMatterFactorValue(
        buildSubjectMatterFactorValuePayload(values),
      ),
    onSuccess: (_created, variables) => {
      qc.invalidateQueries({
        queryKey: nonMotorKeys.factorValues(variables.subject_matter_id),
      });
      qc.invalidateQueries({
        queryKey: nonMotorKeys.subjectMatter(variables.subject_matter_id),
      });
      toast.success('Factor value added');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useNonMotorQuotationDetails(quotationId?: string) {
  return useQuery({
    queryKey: nonMotorKeys.quotationDetails(quotationId),
    queryFn: () => nonMotorApi.getQuotationDetails(quotationId),
    enabled: !!quotationId,
    staleTime: 30_000,
  });
}

export function useCreateNonMotorQuotationDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: NonMotorQuotationDetailFormValues) =>
      nonMotorApi.createQuotationDetail(
        buildNonMotorQuotationDetailPayload(values),
      ),
    onSuccess: (_created, variables) => {
      qc.invalidateQueries({
        queryKey: nonMotorKeys.quotationDetails(variables.quotation_id),
      });
      toast.success('Non-motor quotation detail created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useNonMotorPolicyDetails(policyId?: string) {
  return useQuery({
    queryKey: nonMotorKeys.policyDetails(policyId),
    queryFn: () => nonMotorApi.getPolicyDetails(policyId),
    enabled: !!policyId,
    staleTime: 30_000,
  });
}

export function useCreateNonMotorPolicyDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: NonMotorPolicyDetailFormValues) =>
      nonMotorApi.createPolicyDetail(buildNonMotorPolicyDetailPayload(values)),
    onSuccess: (_created, variables) => {
      qc.invalidateQueries({
        queryKey: nonMotorKeys.policyDetails(variables.policy_id),
      });
      toast.success('Non-motor policy detail created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useNonMotorCustomers() {
  return useQuery({
    queryKey: nonMotorKeys.customers(),
    queryFn: async () =>
      (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useNonMotorQuotations() {
  return useQuery({
    queryKey: nonMotorKeys.quotations(),
    queryFn: motorApi.getQuotations,
    staleTime: 60_000,
  });
}

export function useNonMotorPolicies() {
  return useQuery({
    queryKey: nonMotorKeys.policies(),
    queryFn: motorApi.getPolicies,
    staleTime: 60_000,
  });
}

export function useNonMotorQuotationRisks(quotationId?: string) {
  return useQuery({
    queryKey: quotationId
      ? nonMotorKeys.quotationRisks(quotationId)
      : nonMotorKeys.quotationRisks(''),
    queryFn: () => motorApi.getQuotationRisks(quotationId!),
    enabled: !!quotationId,
    staleTime: 30_000,
  });
}

export function useNonMotorPolicyRisks(policyId?: string) {
  return useQuery({
    queryKey: policyId
      ? nonMotorKeys.policyRisks(policyId)
      : nonMotorKeys.policyRisks(''),
    queryFn: () => motorApi.getPolicyRisks(policyId!),
    enabled: !!policyId,
    staleTime: 30_000,
  });
}

export function useNonMotorFactors() {
  return useAllFactors();
}

export { nonMotorKeys };
export type {
  SubjectMatterRecord,
  SubjectMatterFactorValueRecord,
  NonMotorQuotationDetailRecord,
  NonMotorPolicyDetailRecord,
};
