import { useMemo, useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { claimsApi } from '../api';
import { useInvalidateClaim, usePolicyDetail } from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimDetail } from '../types';
import { claimErrorLines } from '../utils';
import {
  claimFormSchema,
  defaultClaimValues,
  toClaimantPayload,
  toCreatePayload,
  toIncidentPayload,
  valuesFromClaim,
  type ClaimFormValues,
} from './schema';

export const CLAIM_WIZARD_STEPS = [
  { id: 'policy', label: 'Policy', description: 'Find the policy' },
  { id: 'risk', label: 'Risk', description: 'Vehicle or insured item' },
  { id: 'incident', label: 'Incident', description: 'What happened' },
  { id: 'claimants', label: 'Claimants', description: 'Who is claiming' },
  { id: 'review', label: 'Review', description: 'Check and submit' },
] as const;

export type ClaimWizardStepId = (typeof CLAIM_WIZARD_STEPS)[number]['id'];

const STEP_FIELDS: Record<ClaimWizardStepId, FieldPath<ClaimFormValues>[]> = {
  policy: ['policy_id'],
  risk: ['policy_risk_id'],
  incident: [
    'loss_date',
    'claim_report_date',
    'loss_nature',
    'loss_type',
    'loss_location',
    'description',
    'claim_title',
    'cause_of_loss',
    'police_report_number',
    'estimated_amount',
    'reporter_name',
    'reporter_phone',
    'reporter_email',
    'internal_notes',
  ],
  claimants: ['claimants'],
  review: [],
};

const EDITABLE_STATUSES = new Set(['DRAFT', 'NOTIFICATION_FAILED']);

/** The loss and report date rules the backend enforces (validateLossDate). */
export function lossDateProblem(
  lossDate: string,
  reportDate: string,
): { field: 'loss_date' | 'claim_report_date'; text: string } | null {
  const loss = new Date(lossDate).getTime();
  const report = new Date(reportDate).getTime();

  if (Number.isFinite(loss) && loss > Date.now()) {
    return { field: 'loss_date', text: 'Loss date cannot be in the future' };
  }

  if (Number.isFinite(loss) && Number.isFinite(report) && report < loss) {
    return {
      field: 'claim_report_date',
      text: 'Report date cannot be before the loss date',
    };
  }

  return null;
}

export interface DuplicateClaim {
  id: string;
  claim_no: string;
}

/** Claims in these statuses may be edited (EDITABLE_CLAIM_STATUSES). */
export function isClaimEditable(claim: Pick<ClaimDetail, 'status'>) {
  return EDITABLE_STATUSES.has(claim.status);
}

/**
 * Wizard state for registering a claim, or for editing `existingClaim`
 * (loaded by the page before this mounts, so the form starts from it).
 */
export function useClaimWizard(existingClaim?: ClaimDetail | null) {
  const navigate = useNavigate();
  const invalidate = useInvalidateClaim();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isEditMode = !!existingClaim;

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: existingClaim
      ? valuesFromClaim(existingClaim)
      : defaultClaimValues(),
    mode: 'onTouched',
  });

  const [stepId, setStepId] = useState<ClaimWizardStepId>(
    isEditMode ? 'risk' : 'policy',
  );
  const [completed, setCompleted] = useState<ClaimWizardStepId[]>(
    isEditMode ? ['policy'] : [],
  );
  const [errorSteps, setErrorSteps] = useState<ClaimWizardStepId[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [duplicate, setDuplicate] = useState<DuplicateClaim | null>(null);

  const policyId = useWatch({ control: form.control, name: 'policy_id' });
  const policy = usePolicyDetail(policyId || undefined);

  const stepIndex = CLAIM_WIZARD_STEPS.findIndex((step) => step.id === stepId);
  const canSubmitNotification = hasPermission(
    ClaimsPermissions.NOTIFICATION_SUBMIT,
  );

  /** Checks one step's fields plus the rules that depend on the policy. */
  async function validateStep(step: ClaimWizardStepId) {
    const valid = await form.trigger(STEP_FIELDS[step], { shouldFocus: true });
    let extraValid = true;

    if (step === 'risk') {
      const risks = policy.data?.risks ?? [];
      const selected = form.getValues('policy_risk_id');

      if (risks.length > 1 && !selected) {
        form.setError('policy_risk_id', {
          message:
            policy.data?.business_line === 'FLEET'
              ? 'Select the fleet vehicle involved in the loss'
              : 'Select the risk the loss relates to',
        });
        extraValid = false;
      }
    }

    // Object-level zod refinements only run once every field parses, so the
    // cross-field rules are repeated here to show them on their own step.
    if (step === 'incident') {
      const message = lossDateProblem(
        form.getValues('loss_date'),
        form.getValues('claim_report_date'),
      );

      if (message) {
        form.setError(message.field, { message: message.text });
        extraValid = false;
      }
    }

    if (step === 'claimants') {
      const claimants = form.getValues('claimants');

      if (claimants.length === 0) {
        form.setError('claimants', { message: 'Add at least one claimant' });
        extraValid = false;
      } else if (
        claimants.filter((claimant) => claimant.is_primary).length > 1
      ) {
        form.setError('claimants', {
          message: 'Only one claimant can be primary',
        });
        extraValid = false;
      }
    }

    const ok = valid && extraValid;
    setErrorSteps((current) =>
      ok
        ? current.filter((id) => id !== step)
        : [...new Set([...current, step])],
    );
    return ok;
  }

  async function goToStep(next: string) {
    const target = CLAIM_WIZARD_STEPS.findIndex((step) => step.id === next);
    if (target < 0) return;
    if (isEditMode && next === 'policy') return;

    // Moving forward validates every step in between.
    for (let index = stepIndex; index < target; index += 1) {
      const step = CLAIM_WIZARD_STEPS[index].id;
      if (!(await validateStep(step))) {
        setStepId(step);
        return;
      }
      setCompleted((current) => [...new Set([...current, step])]);
    }

    setStepId(CLAIM_WIZARD_STEPS[target].id);
  }

  const goNext = () => {
    const next = CLAIM_WIZARD_STEPS[stepIndex + 1];
    if (next) void goToStep(next.id);
  };

  const goBack = () => {
    const previous = CLAIM_WIZARD_STEPS[stepIndex - 1];
    if (!previous || (isEditMode && previous.id === 'policy')) return;
    setStepId(previous.id);
  };

  async function validateAll() {
    for (const step of CLAIM_WIZARD_STEPS) {
      if (isEditMode && step.id === 'policy') continue;
      if (!(await validateStep(step.id))) {
        setStepId(step.id);
        return false;
      }
    }
    return true;
  }

  /** Applies claimant adds, edits and removals through their own routes. */
  async function syncClaimants(claim: ClaimDetail, values: ClaimFormValues) {
    const kept = new Set(values.claimants.map((claimant) => claimant.id));
    const current = (claim.claimants ?? []).filter(
      (claimant) => claimant.status !== 'REMOVED',
    );

    // Add first so a claim never drops to zero claimants in between.
    for (const claimant of values.claimants.filter((item) => !item.id)) {
      await claimsApi.addClaimant(claim.id, toClaimantPayload(claimant));
    }
    for (const claimant of values.claimants.filter((item) => item.id)) {
      await claimsApi.updateClaimant(claimant.id!, toClaimantPayload(claimant));
    }
    for (const claimant of current.filter((item) => !kept.has(item.id))) {
      await claimsApi.removeClaimant(claimant.id);
    }
  }

  /** Creates or updates the draft; returns it, or null when saving failed. */
  async function persist(): Promise<ClaimDetail | null> {
    const values = form.getValues();
    setSaveError(null);

    try {
      if (existingClaim) {
        const { policy_risk_id, ...incident } = toIncidentPayload(values);
        await claimsApi.update(existingClaim.id, {
          ...incident,
          // Only send the risk when it changed; the policy stays fixed.
          ...(policy_risk_id !== (existingClaim.policy_risk_id ?? undefined)
            ? { policy_risk_id }
            : {}),
        });
        await syncClaimants(existingClaim, values);
        invalidate(existingClaim.id);
        return claimsApi.get(existingClaim.id);
      }

      const created = await claimsApi.create(toCreatePayload(values));
      setDuplicate(null);
      invalidate(created.id);
      return created;
    } catch (error) {
      const parsed = claimErrorLines(error);

      if (parsed.code === 'CLAIM_POSSIBLE_DUPLICATE') {
        const duplicateOf = parsed.details?.duplicate_of as
          | DuplicateClaim
          | undefined;
        setDuplicate(duplicateOf ?? { id: '', claim_no: 'an existing claim' });
        setStepId('review');
      }

      setSaveError(error);
      return null;
    }
  }

  async function saveDraft() {
    if (!(await validateAll())) return;
    setIsSaving(true);
    const claim = await persist();
    setIsSaving(false);

    if (claim) {
      toast.success(
        isEditMode
          ? `Claim ${claim.claim_no} updated`
          : `Claim ${claim.claim_no} saved as draft`,
      );
      navigate(claimsPaths.detail(claim.id));
    }
  }

  /**
   * Saves, then reports the notification to TIRAMIS (§9). The claim is kept
   * as a draft when the submission is refused, so nothing entered is lost.
   */
  async function saveAndSubmit() {
    if (!(await validateAll())) return;
    setIsSaving(true);
    const claim = await persist();

    if (!claim) {
      setIsSaving(false);
      return;
    }

    try {
      const retry = claim.status === 'NOTIFICATION_FAILED';
      await (retry
        ? claimsApi.retryNotification(claim.id)
        : claimsApi.submitNotification(claim.id));
      toast.success(
        `Claim ${claim.claim_no} submitted to TIRAMIS. The claim reference arrives when TIRA responds.`,
      );
    } catch (error) {
      const { message, lines } = claimErrorLines(error);
      toast.error(`Claim ${claim.claim_no} was saved but not submitted`, {
        description: [message, ...lines].join('\n'),
      });
    } finally {
      invalidate(claim.id);
      setIsSaving(false);
      navigate(claimsPaths.detail(claim.id));
    }
  }

  const steps = useMemo(
    () =>
      CLAIM_WIZARD_STEPS.map((step) => ({
        id: step.id,
        label: step.label,
        description: step.description,
      })),
    [],
  );

  return {
    form,
    steps,
    stepId,
    stepIndex,
    completedSteps: completed,
    errorSteps,
    isFirstStep: stepIndex === (isEditMode ? 1 : 0),
    isLastStep: stepIndex === CLAIM_WIZARD_STEPS.length - 1,
    isEditMode,
    existingClaim: existingClaim ?? null,
    policy,
    isSaving,
    saveError,
    duplicate,
    canSubmitNotification,
    goToStep,
    goNext,
    goBack,
    saveDraft,
    saveAndSubmit,
  };
}

export type ClaimWizard = ReturnType<typeof useClaimWizard>;
