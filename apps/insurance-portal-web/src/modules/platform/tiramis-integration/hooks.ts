import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  tiramisIntegrationApi,
  type TiramisCertificateKind,
  type TiramisEnvironment,
  type TiramisIntegrationPermission,
  type TiramisProfileUpdate,
} from './api';

export const tiramisIntegrationKeys = {
  all: ['platform', 'tiramis-integration'] as const,
  overview: () => [...tiramisIntegrationKeys.all, 'overview'] as const,
  companies: () => [...tiramisIntegrationKeys.all, 'companies'] as const,
};

export function useTiramisIntegrationOverview() {
  return useQuery({
    queryKey: tiramisIntegrationKeys.overview(),
    queryFn: tiramisIntegrationApi.getOverview,
  });
}

export function useTiramisIntegrationCompanies(enabled = true) {
  return useQuery({
    queryKey: tiramisIntegrationKeys.companies(),
    queryFn: tiramisIntegrationApi.listCompanies,
    enabled,
  });
}

function useInvalidateTiramisIntegration() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: tiramisIntegrationKeys.all });
}

export function useUpdateTiramisProfile(env: TiramisEnvironment) {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (data: TiramisProfileUpdate) =>
      tiramisIntegrationApi.updateProfile(env, data),
    onSuccess: () => void invalidate(),
  });
}

export function useUploadTiramisCertificate(env: TiramisEnvironment) {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (data: {
      kind: TiramisCertificateKind;
      contentBase64: string;
      password?: string;
    }) => tiramisIntegrationApi.uploadCertificate(env, data),
    onSuccess: () => void invalidate(),
  });
}

export function useValidateTiramisProfile(env: TiramisEnvironment) {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: () => tiramisIntegrationApi.validate(env),
    onSettled: () => void invalidate(),
  });
}

export function useGenerateTiramisServiceKey(env: TiramisEnvironment) {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (allowedIps: string[]) =>
      tiramisIntegrationApi.generateServiceApiKey(env, allowedIps),
    onSuccess: () => void invalidate(),
  });
}

export function useRotateTiramisWebhookKey(env: TiramisEnvironment) {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: () => tiramisIntegrationApi.rotateWebhookApiKey(env),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateTiramisSettings() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (integrationPermissions: TiramisIntegrationPermission[]) =>
      tiramisIntegrationApi.updateSettings({ integrationPermissions }),
    onSuccess: () => void invalidate(),
  });
}

export function useSwitchTiramisEnvironment() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (vars: {
      environment: TiramisEnvironment;
      confirmLive?: boolean;
    }) =>
      tiramisIntegrationApi.switchEnvironment(
        vars.environment,
        vars.confirmLive,
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useTiramisCompanyAccessMutations() {
  const invalidate = useInvalidateTiramisIntegration();
  const onSuccess = () => void invalidate();
  return {
    link: useMutation({
      mutationFn: (vars: {
        companyId: string;
        insurerCompanyCode: string;
        insurerCompanyName?: string;
      }) =>
        tiramisIntegrationApi.linkCompany(vars.companyId, {
          insurerCompanyCode: vars.insurerCompanyCode,
          insurerCompanyName: vars.insurerCompanyName,
        }),
      onSuccess,
    }),
    activate: useMutation({
      mutationFn: (companyId: string) =>
        tiramisIntegrationApi.activateCompany(companyId),
      onSuccess,
    }),
    revoke: useMutation({
      mutationFn: (vars: { companyId: string; reason: string }) =>
        tiramisIntegrationApi.revokeCompany(vars.companyId, vars.reason),
      onSuccess,
    }),
    restore: useMutation({
      mutationFn: (companyId: string) =>
        tiramisIntegrationApi.restoreCompany(companyId),
      onSuccess,
    }),
  };
}
