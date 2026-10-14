import { useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import { PageHeader } from '@/components/shared/PageHeader';
import { QuotationJourneyProgress } from '@/modules/tenant/quotations/wizard/QuotationJourneyProgress';
import { useClaim } from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimDetail } from '../types';
import { ClaimantsStep } from './steps/ClaimantsStep';
import { IncidentStep } from './steps/IncidentStep';
import { PolicyStep, PolicySummary } from './steps/PolicyStep';
import { ReviewStep } from './steps/ReviewStep';
import { RiskStep } from './steps/RiskStep';
import {
  isClaimEditable,
  useClaimWizard,
  type ClaimWizard,
} from './useClaimWizard';

function StepContent({
  wizard,
  stepId,
}: {
  wizard: ClaimWizard;
  stepId: string;
}) {
  switch (stepId) {
    case 'policy':
      return <PolicyStep wizard={wizard} />;
    case 'risk':
      return <RiskStep wizard={wizard} />;
    case 'incident':
      return <IncidentStep wizard={wizard} />;
    case 'claimants':
      return <ClaimantsStep wizard={wizard} />;
    default:
      return <ReviewStep wizard={wizard} />;
  }
}

function ClaimWizardView({ existing }: { existing: ClaimDetail | null }) {
  const navigate = useNavigate();
  const wizard = useClaimWizard(existing);
  const containerRef = useRef<HTMLDivElement>(null);
  // The footer is rendered by AppShell through usePageFooter; it must only
  // change when its visible state does, otherwise setting it re-renders this
  // page and loops. Handlers read the latest wizard through this ref.
  const latest = useRef(wizard);
  const {
    stepId,
    isSaving,
    isFirstStep,
    isLastStep,
    isEditMode,
    canSubmitNotification,
  } = wizard;

  useLayoutEffect(() => {
    latest.current = wizard;
  });

  useLayoutEffect(() => {
    containerRef.current
      ?.closest('main')
      ?.scrollTo({ top: 0, behavior: 'instant' });
  }, [stepId]);

  const footer = useMemo(
    () => (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => latest.current.goBack()}
            disabled={isFirstStep || isSaving}
          >
            Back
          </Button>
          {isSaving ? (
            <span className="text-xs text-slate-500">Saving...</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() =>
              navigate(
                existing ? claimsPaths.detail(existing.id) : claimsPaths.list,
              )
            }
          >
            Cancel
          </Button>
          {isLastStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void latest.current.saveDraft()}
              >
                {isEditMode ? 'Save changes' : 'Save draft'}
              </Button>
              {canSubmitNotification ? (
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void latest.current.saveAndSubmit()}
                >
                  Save & submit to TIRA
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              type="button"
              onClick={() => latest.current.goNext()}
              disabled={isSaving}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    ),
    [
      canSubmitNotification,
      existing,
      isEditMode,
      isFirstStep,
      isLastStep,
      isSaving,
      navigate,
    ],
  );
  usePageFooter(footer);

  return (
    <div ref={containerRef} className="pb-8">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
        <PageHeader
          eyebrow="Claims"
          title={existing ? `Edit claim ${existing.claim_no}` : 'New claim'}
        />

        {existing && wizard.policy.data ? (
          <div className="rounded-[5px] border border-slate-200/80 bg-white p-4 shadow-sm">
            <PolicySummary policy={wizard.policy.data} />
          </div>
        ) : null}

        <div className="rounded-[5px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <QuotationJourneyProgress
            steps={existing ? wizard.steps.slice(1) : wizard.steps}
            currentStep={stepId}
            completedSteps={wizard.completedSteps}
            errorSteps={wizard.errorSteps}
            onStepClick={(next) => void wizard.goToStep(next)}
          />
          <div className="mt-3 border-t border-slate-100 pt-4 sm:mt-4">
            <Form {...wizard.form}>
              <form
                className="space-y-6"
                onSubmit={(event) => event.preventDefault()}
              >
                <StepContent wizard={wizard} stepId={stepId} />
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Register a claim: policy → risk/vehicle →
 * incident → claimants → review. With `:id` it edits a draft, or a claim whose
 * notification TIRA refused; the claim is loaded first so the form starts
 * from it.
 */
export function ClaimWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const claim = useClaim(id);

  if (!id) return <ClaimWizardView existing={null} />;

  if (claim.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (claim.isError || !claim.data) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>This claim could not be loaded.</p>
        <Button variant="outline" onClick={() => navigate(claimsPaths.list)}>
          Back to claims
        </Button>
      </div>
    );
  }

  if (!isClaimEditable(claim.data)) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-slate-600">
        <p>
          Claim {claim.data.claim_no} has been reported to TIRA and can no
          longer be edited here.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(claimsPaths.detail(id))}
        >
          Open the claim
        </Button>
      </div>
    );
  }

  return <ClaimWizardView key={claim.data.id} existing={claim.data} />;
}
