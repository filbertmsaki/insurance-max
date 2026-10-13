import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/modules/tenant/customers/api';
import { motorApi } from '@/modules/tenant/motor/api';
import { useAllFactors } from '@/modules/tenant/product-engine/hooks';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { nonMotorApi } from './api';
import {
  buildNonMotorPolicyDetailPayload,
  buildSubjectMatterFactorValuePayload,
  buildSubjectMatterPayload,
  type NonMotorPolicyDetailFormValues,
  type SubjectMatterFactorValueFormValues,
  type SubjectMatterFormValues,
} from './schemas';
import type {
  NonMotorPolicyDetailRecord,
  SubjectMatterFactorValueRecord,
  SubjectMatterRecord,
} from './types';

const nonMotorKeys = {
  all: ['non-motor'] as const,
  subjectMatters: () => [...nonMotorKeys.all, 'subject-matters'] as const,
  subjectMatter: (id: string) =>
    [...nonMotorKeys.all, 'subject-matter', id] as const,
  factorValues: (subjectMatterId?: string) =>
    [...nonMotorKeys.all, 'factor-values', subjectMatterId ?? 'all'] as const,
  policyDetails: (policyId?: string) =>
    [...nonMotorKeys.all, 'policy-details', policyId ?? 'all'] as const,
  customers: () => [...nonMotorKeys.all, 'customers'] as const,
  quotations: () => [...nonMotorKeys.all, 'quotations'] as const,
  policies: () => [...nonMotorKeys.all, 'policies'] as const,
  policyRisks: (policyId: string) =>
    [...nonMotorKeys.all, 'policy-risks', policyId] as const,
  factors: () => [...nonMotorKeys.all, 'factors'] as const,
};

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
  NonMotorPolicyDetailRecord,
};
