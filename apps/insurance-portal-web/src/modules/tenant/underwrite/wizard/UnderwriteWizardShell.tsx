import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { QuotationJourneyProgress } from '@/modules/tenant/quotations/wizard/QuotationJourneyProgress';
import { underwritePaths } from '../paths';
import type { UnderwriteQuotationWizard } from './useUnderwriteQuotationWizard';

/**
 * Layout shared by the line wizards: header, step progress, the active step's
 * content and the sticky footer (Back / Save draft / Delete / Next|Complete).
 * Steps are rendered once and hidden rather than unmounted, so per-risk
 * premium calculation hooks keep their state while moving between steps.
 */
export function UnderwriteWizardShell({
  wizard,
  title,
  renderStep,
}: {
  wizard: UnderwriteQuotationWizard;
  title: string;
  renderStep: (stepId: string) => ReactNode;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const {
    line,
    steps,
    stepId,
    completedSteps,
    errorSteps,
    isFirstStep,
    isLastStep,
    isSaving,
    isEditMode,
    hasProduct,
    canSaveDraft,
    companyId,
  } = wizard;

  useLayoutEffect(() => {
    containerRef.current?.closest('main')?.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, [stepId]);

  const ready = !wizard.isLoading && !(isEditMode && wizard.isHydrating);

  const footer = useMemo(
    () =>
      ready && !wizard.loadError ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={wizard.goBack}
              disabled={isFirstStep}
            >
              Back
            </Button>
            {isSaving && (
              <span className="text-xs text-slate-500">Saving...</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || !hasProduct || !canSaveDraft}
              title={
                !hasProduct
                  ? 'Select a product first'
                  : !canSaveDraft
                    ? 'Complete the premium step before saving a draft'
                    : undefined
              }
              onClick={() => void wizard.saveDraft()}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete draft
            </Button>
            {isLastStep ? (
              <Button
                type="button"
                disabled={isSaving || !companyId}
                onClick={() => void wizard.complete()}
              >
                {isSaving
                  ? 'Saving...'
                  : isEditMode
                    ? 'Complete quotation'
                    : 'Create quotation'}
              </Button>
            ) : (
              <Button type="button" onClick={wizard.goNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      ) : null,
    [
      companyId,
      hasProduct,
      canSaveDraft,
      isEditMode,
      isFirstStep,
      isLastStep,
      isSaving,
      ready,
      wizard,
    ],
  );
  usePageFooter(footer);

  if (!ready && !wizard.loadError) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (wizard.loadError) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>This quotation could not be loaded for editing.</p>
        <Button
          variant="outline"
          onClick={() => navigate(underwritePaths.quotations(line.slug))}
        >
          Back to {line.label} quotations
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="pb-8">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
        <PageHeader eyebrow={`Underwrite · ${line.label}`} title={title} />
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="Delete draft quotation"
          description="This permanently removes the current draft quotation. This action cannot be undone."
          confirmLabel="Delete draft"
          loading={wizard.isDeleting}
          onConfirm={() => {
            setIsDeleteOpen(false);
            wizard.deleteDraft();
          }}
        />

        <div className="rounded-[5px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <QuotationJourneyProgress
            steps={steps}
            currentStep={stepId}
            completedSteps={completedSteps}
            errorSteps={errorSteps}
            onStepClick={(next) => void wizard.goToStep(next)}
          />

          <div className="mt-3 border-t border-slate-100 pt-4 sm:mt-4">
            <Form {...wizard.form}>
              <form
                className="space-y-6"
                onSubmit={(event) => event.preventDefault()}
              >
                {steps.map((step) => (
                  <div key={step.id} hidden={step.id !== stepId}>
                    {renderStep(step.id)}
                  </div>
                ))}
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
