import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  tiramisIntegrationApi,
  type TiramisCertificateKind,
  type TiramisIntegrationPermission,
  type TiramisProfileUpdate,
  type TiramisEnvironment,
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

export function useUpdateTiramisProfile() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (data: TiramisProfileUpdate) =>
      tiramisIntegrationApi.updateProfile(data),
    onSuccess: () => void invalidate(),
  });
}

export function useUploadTiramisCertificate() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (data: {
      kind: TiramisCertificateKind;
      contentBase64: string;
      password?: string;
    }) => tiramisIntegrationApi.uploadCertificate(data),
    onSuccess: () => void invalidate(),
  });
}

export function useValidateTiramisProfile() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: () => tiramisIntegrationApi.validate(),
    onSettled: () => void invalidate(),
  });
}

export function useGenerateTiramisServiceKey() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (params: {
      allowedIps: string[];
      environment?: TiramisEnvironment;
    }) =>
      tiramisIntegrationApi.generateServiceApiKey(
        params.allowedIps,
        params.environment,
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useRotateTiramisWebhookKey() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: () => tiramisIntegrationApi.rotateWebhookApiKey(),
    onSuccess: () => void invalidate(),
  });
}

export function useTiramisConnectionMutations() {
  const invalidate = useInvalidateTiramisIntegration();
  return {
    update: useMutation({
      mutationFn: (vars: {
        environment: TiramisEnvironment;
        data: {
          baseUrl?: string;
          webhookSourceIp?: string;
        };
      }) => tiramisIntegrationApi.updateConnection(vars.environment, vars.data),
      onSuccess: () => void invalidate(),
    }),
    test: useMutation({
      mutationFn: (environment: TiramisEnvironment) =>
        tiramisIntegrationApi.testConnection(environment),
      onSettled: () => void invalidate(),
    }),
    detectIps: useMutation({
      mutationFn: (environment: TiramisEnvironment) =>
        tiramisIntegrationApi.detectConnectionIps(environment),
    }),
    activate: useMutation({
      mutationFn: (environment: TiramisEnvironment) =>
        tiramisIntegrationApi.activateConnection(environment),
      onSuccess: () => void invalidate(),
    }),
  };
}

export function useUpdateTiramisSettings() {
  const invalidate = useInvalidateTiramisIntegration();
  return useMutation({
    mutationFn: (integrationPermissions: TiramisIntegrationPermission[]) =>
      tiramisIntegrationApi.updateSettings({ integrationPermissions }),
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
