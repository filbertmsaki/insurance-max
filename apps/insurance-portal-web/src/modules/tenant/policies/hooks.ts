import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import {
  useQuotationCategories,
  useQuotationProducts,
  useQuotationSubClasses,
} from '@/modules/tenant/quotations/hooks';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { policiesApi } from './api';
import { buildPolicyPayload, type PolicyFormSchemaValues } from './schemas';
import type {
  CreateCancellationPayload,
  CreateEndorsementPayload,
  CreateEndorsementTypePayload,
  PolicyListParams,
  PolicyRecord,
  RecordEndorsementChangePayload,
  UpdateEndorsementTypePayload,
} from './types';

const policyKeys = {
  all: ['policies'] as const,
  list: (params: PolicyListParams) => ['policies', 'list', params] as const,
  detail: (id: string) => ['policies', 'detail', id] as const,
  currentVersion: (id: string) =>
    ['policies', 'detail', id, 'current-version'] as const,
  versions: (id: string) => ['policies', 'detail', id, 'versions'] as const,
  endorsementEligibility: (id: string, effectiveDate?: string) =>
    [
      'policies',
      'detail',
      id,
      'endorsement-eligibility',
      effectiveDate,
    ] as const,
  cancellationEligibility: (id: string, effectiveDate?: string) =>
    [
      'policies',
      'detail',
      id,
      'cancellation-eligibility',
      effectiveDate,
    ] as const,
  cancellationContext: (id: string) =>
    ['policies', 'cancellation-context', id] as const,
  cancellations: (policyId: string) =>
    ['policies', 'detail', policyId, 'cancellations'] as const,
  pendingTransaction: (id: string) =>
    ['policy-transactions', 'detail', id] as const,
  renewalEligibility: (id: string) =>
    ['policies', 'detail', id, 'renewal-eligibility'] as const,
  renewalContext: (id: string) => ['policies', 'renewal-context', id] as const,
  renewals: (policyId: string) =>
    ['policies', 'detail', policyId, 'renewals'] as const,
  endorsementTypes: ['policies', 'endorsement-types'] as const,
  endorsementContext: (id: string) =>
    ['policies', 'endorsement-context', id] as const,
  endorsements: (policyId: string) =>
    ['policies', 'detail', policyId, 'endorsements'] as const,
  endorsementReconciliation: (id: string) =>
    ['policies', 'endorsement-reconciliation', id] as const,
  allEndorsements: ['policies', 'all-endorsements'] as const,
  allRenewals: ['policies', 'all-renewals'] as const,
  risks: (id: string) => ['policies', 'risks', id] as const,
  breakdowns: (id: string) => ['policies', 'breakdowns', id] as const,
  history: (id: string) => ['policies', 'history', id] as const,
};

export function usePoliciesList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const policyStatus = params.get('policy_status') ?? 'all';
  const customerId = params.get('customer_id') ?? 'all';

  const queryParams = useMemo<PolicyListParams>(
    () => ({
      page,
      limit,
      search: search || undefined,
      policy_status: policyStatus === 'all' ? undefined : policyStatus,
      customer_id: customerId === 'all' ? undefined : customerId,
    }),
    [page, limit, search, policyStatus, customerId],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: policyKeys.list(queryParams),
    queryFn: () => policiesApi.getList(queryParams),
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
    policyStatus,
    customerId,
    setSearch: (value: string) => setParam('search', value),
    setPolicyStatus: (value: string) =>
      setParam('policy_status', value === 'all' ? null : value),
    setCustomerId: (value: string) =>
      setParam('customer_id', value === 'all' ? null : value),
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

export function usePolicyDetail(id?: string) {
  return useQuery({
    queryKey: id ? policyKeys.detail(id) : policyKeys.detail(''),
    queryFn: () => policiesApi.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function usePolicyCurrentVersion(id?: string) {
  return useQuery({
    queryKey: id
      ? policyKeys.currentVersion(id)
      : policyKeys.currentVersion(''),
    queryFn: () => policiesApi.getCurrentVersion(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function usePolicyVersions(id?: string) {
  return useQuery({
    queryKey: id ? policyKeys.versions(id) : policyKeys.versions(''),
    queryFn: () => policiesApi.getPolicyVersions(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useEndorsementReconciliation(
  endorsementId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: endorsementId
      ? policyKeys.endorsementReconciliation(endorsementId)
      : policyKeys.endorsementReconciliation(''),
    queryFn: () => policiesApi.getEndorsementReconciliation(endorsementId!),
    enabled: !!endorsementId && enabled,
    staleTime: 15_000,
  });
}

export function useReconcileEndorsement(endorsementId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => policiesApi.reconcileEndorsement(endorsementId!),
    onSuccess: () => {
      if (endorsementId) {
        qc.invalidateQueries({
          queryKey: policyKeys.endorsementReconciliation(endorsementId),
        });
      }
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Endorsement reconciliation completed');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useAllEndorsements() {
  return useQuery({
    queryKey: policyKeys.allEndorsements,
    queryFn: () => policiesApi.listEndorsements(),
    staleTime: 30_000,
  });
}

export function useAllRenewals() {
  return useQuery({
    queryKey: policyKeys.allRenewals,
    queryFn: () => policiesApi.listRenewals(),
    staleTime: 30_000,
  });
}

export function usePolicyEndorsements(policyId?: string, enabled = true) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.endorsements(policyId)
      : policyKeys.endorsements(''),
    queryFn: () => policiesApi.getEndorsements(policyId!),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function usePolicyCancellations(policyId?: string, enabled = true) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.cancellations(policyId)
      : policyKeys.cancellations(''),
    queryFn: () => policiesApi.getPolicyCancellations(policyId!),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function usePendingPolicyTransaction(
  transactionId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: policyKeys.pendingTransaction(transactionId ?? ''),
    queryFn: () => policiesApi.getPolicyTransaction(transactionId!),
    enabled: !!transactionId && enabled,
    staleTime: 30_000,
  });
}

export function useEndorsementEligibility(
  policyId?: string,
  effectiveDate?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.endorsementEligibility(policyId, effectiveDate)
      : policyKeys.endorsementEligibility('', effectiveDate),
    queryFn: () =>
      policiesApi.getEndorsementEligibility(policyId!, effectiveDate),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function useCancellationEligibility(
  policyId?: string,
  effectiveDate?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.cancellationEligibility(policyId, effectiveDate)
      : policyKeys.cancellationEligibility('', effectiveDate),
    queryFn: () =>
      policiesApi.getCancellationEligibility(policyId!, effectiveDate),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function useCreateCancellation(policyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCancellationPayload) =>
      policiesApi.createCancellation(policyId!, payload),
    onSuccess: (cancellation) => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
        qc.invalidateQueries({
          queryKey: policyKeys.cancellationEligibility(policyId),
        });
      }
      qc.setQueryData(
        policyKeys.cancellationContext(cancellation.id),
        cancellation,
      );
      toast.success('Cancellation draft created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePolicyRenewals(policyId?: string, enabled = true) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.renewals(policyId)
      : policyKeys.renewals(''),
    queryFn: () => policiesApi.getPolicyRenewals(policyId!),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function useRenewalEligibility(policyId?: string, enabled = true) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.renewalEligibility(policyId)
      : policyKeys.renewalEligibility(''),
    queryFn: () => policiesApi.getRenewalEligibility(policyId!),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function useCreateRenewal(policyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => policiesApi.createRenewal(policyId!),
    onSuccess: () => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
        qc.invalidateQueries({
          queryKey: policyKeys.renewalEligibility(policyId),
        });
        qc.invalidateQueries({ queryKey: policyKeys.renewals(policyId) });
      }
      toast.success('Renewal candidate created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRenewalContext(renewalId?: string) {
  return useQuery({
    queryKey: renewalId
      ? policyKeys.renewalContext(renewalId)
      : policyKeys.renewalContext(''),
    queryFn: () => policiesApi.getRenewalContext(renewalId!),
    enabled: !!renewalId,
    staleTime: 15_000,
  });
}

export function useCancellationContext(cancellationId?: string) {
  return useQuery({
    queryKey: cancellationId
      ? policyKeys.cancellationContext(cancellationId)
      : policyKeys.cancellationContext(''),
    queryFn: () => policiesApi.getCancellationContext(cancellationId!),
    enabled: !!cancellationId,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const status = query.state.data?.transaction?.submission_status;

      return ['PROCESSING', 'SUBMITTED'].includes(String(status))
        ? 3000
        : false;
    },
  });
}

export function useCompleteCancellation(cancellationId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => policiesApi.completeCancellation(cancellationId!),
    onSuccess: () => {
      if (cancellationId) {
        qc.invalidateQueries({
          queryKey: policyKeys.cancellationContext(cancellationId),
        });
      }
      toast.success('Cancellation completed');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useIssueCancellation(policyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (cancellationId: string) =>
      policiesApi.submitCancellationToTiramis(cancellationId),
    onSuccess: (_data, cancellationId) => {
      qc.invalidateQueries({
        queryKey: policyKeys.cancellationContext(cancellationId),
      });

      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.currentVersion(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.versions(policyId) });
      }
      toast.success('Cancellation issuance started');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useEndorsementTypes() {
  return useQuery({
    queryKey: policyKeys.endorsementTypes,
    queryFn: () => policiesApi.getEndorsementTypes(),
    staleTime: 60_000,
  });
}

export function useCreateEndorsementType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEndorsementTypePayload) =>
      policiesApi.createEndorsementType(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.endorsementTypes });
      toast.success('Endorsement type created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateEndorsementType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateEndorsementTypePayload;
    }) => policiesApi.updateEndorsementType(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.endorsementTypes });
      toast.success('Endorsement type updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useEndorsementContext(endorsementId?: string) {
  return useQuery({
    queryKey: endorsementId
      ? policyKeys.endorsementContext(endorsementId)
      : policyKeys.endorsementContext(''),
    queryFn: () => policiesApi.getEndorsementContext(endorsementId!),
    enabled: !!endorsementId,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const submissionStatus = query.state.data?.transaction?.submission_status;

      if (['PROCESSING', 'SUBMITTED'].includes(String(submissionStatus))) {
        return 3000;
      }

      return false;
    },
  });
}

export function useIssueEndorsement() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (endorsementId: string) =>
      policiesApi.submitEndorsementToTiramis(endorsementId),
    onSuccess: (_data, endorsementId) => {
      qc.invalidateQueries({
        queryKey: policyKeys.endorsementContext(endorsementId),
      });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCreateEndorsement(policyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEndorsementPayload) =>
      policiesApi.createEndorsement(policyId!, payload),
    onSuccess: (endorsement) => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.endorsements(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
      }
      qc.setQueryData(policyKeys.endorsementContext(endorsement.id), undefined);
      toast.success('Endorsement draft created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRecordEndorsementChange(endorsementId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordEndorsementChangePayload) =>
      policiesApi.recordEndorsementChange(endorsementId!, payload),
    onSuccess: () => {
      if (endorsementId) {
        qc.invalidateQueries({
          queryKey: policyKeys.endorsementContext(endorsementId),
        });
      }
      toast.success('Change saved');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRecalculateEndorsement(endorsementId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => policiesApi.recalculateEndorsement(endorsementId!),
    onSuccess: () => {
      if (endorsementId) {
        qc.invalidateQueries({
          queryKey: policyKeys.endorsementContext(endorsementId),
        });
      }
      toast.success('Endorsement recalculated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PolicyFormSchemaValues) =>
      policiesApi.create(buildPolicyPayload(values)),
    onSuccess: (policy) => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      qc.setQueryData(policyKeys.detail(policy.id), policy);
      toast.success('Policy created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdatePolicy(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PolicyFormSchemaValues) =>
      policiesApi.update(id!, buildPolicyPayload(values)),
    onSuccess: (policy) => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      if (id) qc.setQueryData(policyKeys.detail(id), policy);
      toast.success('Policy updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useSubmitPolicyEndorsementToTiramis(policyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endorsementId: string) =>
      policiesApi.submitEndorsementToTiramis(endorsementId),
    onSuccess: () => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.endorsements(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
        qc.invalidateQueries({
          queryKey: policyKeys.currentVersion(policyId),
        });
      }
      toast.success('Endorsement issuance started');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRetryPolicyEndorsementTiramis(policyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endorsementId: string) =>
      policiesApi.retryEndorsementTiramis(endorsementId),
    onSuccess: () => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.endorsements(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
        qc.invalidateQueries({
          queryKey: policyKeys.currentVersion(policyId),
        });
      }
      toast.success('Endorsement issuance retried');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRestorePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy restored');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePolicyCustomers() {
  return useQuery({
    queryKey: ['policies', 'customers'],
    queryFn: async () =>
      (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function usePolicyCategories() {
  return useQuotationCategories();
}

export function usePolicyProducts(categoryId?: string) {
  return useQuotationProducts(categoryId);
}

export function usePolicySubClasses(productId?: string) {
  return useQuotationSubClasses(productId);
}

export function usePolicyCurrentCompanyId() {
  return useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId ?? '',
  );
}

export { policyKeys };
export type { PolicyRecord };
