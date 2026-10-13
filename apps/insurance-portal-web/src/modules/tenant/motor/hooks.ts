import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/modules/tenant/customers/api';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { getApiErrorMessage } from '@/lib/api-error';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { motorApi } from './api';
import {
  buildMotorFleetPayload,
  buildMotorPolicyDetailPayload,
  buildMotorVehiclePayload,
  type MotorFleetFormValues,
  type MotorPolicyDetailFormValues,
  type MotorVehicleFormValues,
} from './schemas';
import type {
  MotorFleetRecord,
  MotorPolicyDetailRecord,
  MotorVehicleRecord,
  MotorCustomerOption,
  QuotationOption,
  PolicyOption,
} from './types';

const motorKeys = {
  all: ['motor'] as const,
  vehicles: () => [...motorKeys.all, 'vehicles'] as const,
  vehicle: (id: string) => [...motorKeys.all, 'vehicle', id] as const,
  vehicleVersions: (id: string) =>
    [...motorKeys.vehicle(id), 'versions'] as const,
  vehicleAudit: (id: string) => [...motorKeys.vehicle(id), 'audit'] as const,
  vehicleInsuranceHistory: (id: string) =>
    [...motorKeys.vehicle(id), 'insurance-history'] as const,
  fleets: () => [...motorKeys.all, 'fleets'] as const,
  fleet: (id: string) => [...motorKeys.all, 'fleet', id] as const,
  policyDetails: () => [...motorKeys.all, 'policy-details'] as const,
  policyDetail: (id: string) =>
    [...motorKeys.all, 'policy-detail', id] as const,
  customers: () => [...motorKeys.all, 'customers'] as const,
  quotations: () => [...motorKeys.all, 'quotations'] as const,
  policies: () => [...motorKeys.all, 'policies'] as const,
  policyRisks: (policyId: string) =>
    [...motorKeys.all, 'policy-risks', policyId] as const,
};

export function useMotorVehicle(id?: string) {
  return useQuery({
    queryKey: id ? motorKeys.vehicle(id) : motorKeys.vehicle(''),
    queryFn: () => motorApi.getVehicle(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Latest vehicles for a customer (preview); total comes from the server. */
export function useMotorVehiclesByCustomer(customerId?: string, limit = 5) {
  return useQuery({
    queryKey: [...motorKeys.vehicles(), 'customer', customerId ?? '', limit],
    queryFn: ({ signal }) =>
      motorApi.getVehicles(
        {
          page: 1,
          limit,
          customer_id: customerId,
          sortBy: 'created_at',
          sortOrder: 'DESC',
        },
        signal,
      ),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useMotorVehicleVersions(id?: string) {
  return useQuery({
    queryKey: id
      ? motorKeys.vehicleVersions(id)
      : motorKeys.vehicleVersions(''),
    queryFn: () => motorApi.getVehicleVersions(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMotorVehicleAuditHistory(id?: string) {
  return useQuery({
    queryKey: id ? motorKeys.vehicleAudit(id) : motorKeys.vehicleAudit(''),
    queryFn: () => motorApi.getVehicleAuditHistory(id!),
    enabled: !!id,
    retry: false,
    staleTime: 30_000,
  });
}

export function useMotorVehicleInsuranceHistory(id?: string) {
  return useQuery({
    queryKey: id
      ? motorKeys.vehicleInsuranceHistory(id)
      : motorKeys.vehicleInsuranceHistory(''),
    queryFn: () => motorApi.getVehicleInsuranceHistory(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateMotorVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorVehicleFormValues) =>
      motorApi.createVehicle(buildMotorVehiclePayload(values)),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: motorKeys.vehicles() });
      qc.setQueryData(motorKeys.vehicle(created.id), created);
      toast.success('Motor vehicle created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateMotorVehicle(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorVehicleFormValues) =>
      motorApi.updateVehicle(id!, buildMotorVehiclePayload(values)),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: motorKeys.vehicles() });
      if (id) qc.setQueryData(motorKeys.vehicle(id), updated);
      toast.success('Motor vehicle updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteMotorVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => motorApi.deleteVehicle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.vehicles() });
      toast.success('Motor vehicle archived');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRestoreMotorVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => motorApi.restoreVehicle(id),
    onSuccess: (restored) => {
      qc.invalidateQueries({ queryKey: motorKeys.vehicles() });
      qc.setQueryData(motorKeys.vehicle(restored.id), restored);
      toast.success('Motor vehicle restored');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useMotorFleet(id?: string) {
  return useQuery({
    queryKey: id ? motorKeys.fleet(id) : motorKeys.fleet(''),
    queryFn: () => motorApi.getFleet(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateMotorFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorFleetFormValues) =>
      motorApi.createFleet(buildMotorFleetPayload(values)),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: motorKeys.fleets() });
      qc.setQueryData(motorKeys.fleet(created.id), created);
      toast.success('Motor fleet created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateMotorFleet(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorFleetFormValues) =>
      motorApi.updateFleet(id!, buildMotorFleetPayload(values)),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: motorKeys.fleets() });
      if (id) qc.setQueryData(motorKeys.fleet(id), updated);
      toast.success('Motor fleet updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteMotorFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => motorApi.deleteFleet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.fleets() });
      toast.success('Motor fleet deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useMotorPolicyDetails(policyId?: string) {
  return useQuery({
    queryKey: [...motorKeys.policyDetails(), policyId ?? 'all'],
    queryFn: () => motorApi.getPolicyDetails(policyId),
    staleTime: 30_000,
  });
}

export function useMotorPolicyDetail(id?: string) {
  return useQuery({
    queryKey: id ? motorKeys.policyDetail(id) : motorKeys.policyDetail(''),
    queryFn: () => motorApi.getPolicyDetail(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateMotorPolicyDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorPolicyDetailFormValues) =>
      motorApi.createPolicyDetail(buildMotorPolicyDetailPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.policyDetails() });
      toast.success('Motor policy detail created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateMotorPolicyDetail(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MotorPolicyDetailFormValues) =>
      motorApi.updatePolicyDetail(id!, buildMotorPolicyDetailPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.policyDetails() });
      toast.success('Motor policy detail updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteMotorPolicyDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => motorApi.deletePolicyDetail(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.policyDetails() });
      toast.success('Motor policy detail deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRestoreMotorPolicyDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => motorApi.restorePolicyDetail(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: motorKeys.policyDetails() });
      toast.success('Motor policy detail restored');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useMotorCustomers() {
  return useQuery({
    queryKey: motorKeys.customers(),
    queryFn: async () => {
      const response = await customersApi.getCustomers({
        limit: API_MAX_LIST_LIMIT,
      });
      return response.data;
    },
    staleTime: 60_000,
  });
}

export function useMotorQuotations() {
  return useQuery({
    queryKey: motorKeys.quotations(),
    queryFn: motorApi.getQuotations,
    staleTime: 60_000,
  });
}

export function useMotorPolicies() {
  return useQuery({
    queryKey: motorKeys.policies(),
    queryFn: motorApi.getPolicies,
    staleTime: 60_000,
  });
}

export function useMotorPolicyRisks(policyId?: string) {
  return useQuery({
    queryKey: policyId
      ? motorKeys.policyRisks(policyId)
      : motorKeys.policyRisks(''),
    queryFn: () => motorApi.getPolicyRisks(policyId!),
    enabled: !!policyId,
    staleTime: 30_000,
  });
}

export { motorKeys, getCustomerDisplayName };
export type {
  MotorVehicleRecord,
  MotorFleetRecord,
  MotorPolicyDetailRecord,
  MotorCustomerOption,
  QuotationOption,
  PolicyOption,
};
