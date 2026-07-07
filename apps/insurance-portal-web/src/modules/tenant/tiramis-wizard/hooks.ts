import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import type { TiramisWizardFlow, TiramisWizardFormValues, TiramisWizardReferenceData } from './types';
import { createDefaultWizardValues } from './schemas';
import { toPortalTiramisSubmitPayload } from './adapters';

const DRAFT_STORAGE_KEY = 'insurance-portal:tiramis-wizard:draft';

export function useTiramisWizardReferenceData(flow: TiramisWizardFlow): TiramisWizardReferenceData {
  const company = useAuthStore((state) => state.company);

  return useMemo(() => ({
    companyCode: company?.slug?.toUpperCase?.() ?? company?.id ?? '',
    insurerCompanyCode: company?.slug?.toUpperCase?.() ?? company?.id ?? '',
    clientCode: company?.id ?? '',
    clientKey: company?.slug ?? company?.id ?? '',
    systemCode: 'INSURANCE_PORTAL',
    branchCode: '',
    salePointCode: '',
    salePointName: '',
    callbackUrl: `${window.location.origin}/api/tiramis/callback`,
    tranCompanyCode: company?.slug?.toUpperCase?.() ?? company?.id ?? '',
  }), [company, flow]);
}

export function useTiramisWizardDraft(flow: TiramisWizardFlow) {
  const [draft, setDraft] = useState<TiramisWizardFormValues>(() => {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_KEY}:${flow}`);
    if (!raw) return createDefaultWizardValues(flow);
    try {
      const parsed = JSON.parse(raw) as TiramisWizardFormValues;
      return { ...createDefaultWizardValues(flow), ...parsed, flow };
    } catch {
      return createDefaultWizardValues(flow);
    }
  });

  useEffect(() => {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_KEY}:${flow}`);
    if (!raw) {
      setDraft(createDefaultWizardValues(flow));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as TiramisWizardFormValues;
      setDraft({ ...createDefaultWizardValues(flow), ...parsed, flow });
    } catch {
      setDraft(createDefaultWizardValues(flow));
    }
  }, [flow]);

  const saveDraft = (next: TiramisWizardFormValues) => {
    localStorage.setItem(`${DRAFT_STORAGE_KEY}:${flow}`, JSON.stringify(next));
  };

  const clearDraft = () => {
    localStorage.removeItem(`${DRAFT_STORAGE_KEY}:${flow}`);
    setDraft(createDefaultWizardValues(flow));
  };

  return { draft, saveDraft, clearDraft };
}

export function useTiramisWizardSubmit() {
  return useMutation({
    mutationFn: async (values: TiramisWizardFormValues) => {
      const payload = toPortalTiramisSubmitPayload(values);
      return tiramisApi.submit(payload);
    },
    onSuccess: () => {
      toast.success('TIRAMIS submission started');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Unable to submit to TIRAMIS');
    },
  });
}

export function useBranchReferenceData() {
  return useMutation({
    mutationFn: () => branchesApi.getAllBranches(),
  });
}
