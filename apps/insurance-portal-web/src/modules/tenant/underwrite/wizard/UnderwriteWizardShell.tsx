import { WizardSectionTitleContext } from '@/modules/tenant/quotations/wizard/components/WizardSectionTitleContext';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useWatch } from 'react-hook-form';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { QuotationPageHeader } from './QuotationPageHeader';
import { QuotationJourneyProgress } from '@/modules/tenant/quotations/wizard/QuotationJourneyProgress';
import { useWizardNavigation } from './wizardNavigation';
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
  showHeader = true,
  renderStep,
  additionalHydrating = false,
  additionalLoadError,
  onRetryAdditionalLoad,
}: {
  wizard: UnderwriteQuotationWizard;
  title: string;
  showHeader?: boolean;
  renderStep: (stepId: string) => ReactNode;
  /** Gates the form on line-specific edit data loaded outside the shared wizard. */
  additionalHydrating?: boolean;
  additionalLoadError?: unknown;
  onRetryAdditionalLoad?: () => void;
}) {
  const navigate = useNavigate();
  const wizardNav = useWizardNavigation();
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

  const loadError = wizard.loadError ?? additionalLoadError;
  const ready =
    !wizard.isLoading &&
    !(isEditMode && wizard.isHydrating) &&
    !additionalHydrating;

  const currentValues = useWatch({ control: wizard.form.control });
  const isFleet = line.slug === 'fleet';
  const selectedCustomer = wizard.customerOptions.find(
    (customer) => customer.id === currentValues.customer_id,
  );
  const customerName =
    currentValues.policyholder_mode === 'existing'
      ? selectedCustomer
        ? getCustomerDisplayName(selectedCustomer)
        : ''
      : currentValues.policyholder?.policy_holder_name;
  const draftHelp = !hasProduct
    ? 'Select a product to save a draft.'
    : !canSaveDraft
      ? 'Continue to the next step to save a draft.'
      : '';
  const footer = useMemo(
    () =>
      ready && !loadError ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 [&_button]:min-h-11">
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
                      ? 'Continue to the next step to save a draft'
                      : undefined
                }
                onClick={() => void wizard.saveDraft()}
              >
                Save draft
              </Button>
              <ActionMenu
                ariaLabel="Draft actions"
                className="h-11 w-11"
                items={[
                  {
                    label: 'Delete draft',
                    destructive: true,
                    disabled: isSaving,
                    onClick: () => setIsDeleteOpen(true),
                  },
                ]}
              />
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
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={wizard.goNext}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
          {draftHelp && <p className="text-xs text-slate-600">{draftHelp}</p>}
        </div>
      ) : null,
    [
      draftHelp,
      companyId,
      hasProduct,
      canSaveDraft,
      isEditMode,
      isFirstStep,
      isLastStep,
      isSaving,
      loadError,
      ready,
      wizard,
    ],
  );
  usePageFooter(footer);

  if (!ready && !loadError) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>This quotation data could not be loaded for editing.</p>
        <div className="flex justify-center gap-2">
          {onRetryAdditionalLoad && (
            <Button variant="outline" onClick={onRetryAdditionalLoad}>
              Retry loading
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate(wizardNav.quotations(line.slug))}
          >
            {wizardNav.backLabel ?? `Back to ${line.label} quotations`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WizardSectionTitleContext.Provider value={!isFleet}>
      <div ref={containerRef} className="pb-8">
        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
          {showHeader && (
            <div className="space-y-3">
              <QuotationPageHeader
                eyebrow={`Underwrite · ${line.label}`}
                title={title}
                badge={wizardNav.headerBadge}
                backLabel={
                  wizardNav.backLabel ?? `Back to ${line.label} quotations`
                }
                onBack={() => navigate(wizardNav.quotations(line.slug))}
              />
              {isFleet && (wizard.existingQuotation || customerName) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-14 text-sm text-slate-600 sm:pl-13">
                  {wizard.existingQuotation && (
                    <>
                      <span className="font-medium text-slate-900">
                        {wizard.existingQuotation.quotation_no}
                      </span>
                      <span>
                        {wizard.existingQuotation.status.replaceAll('_', ' ')}
                      </span>
                    </>
                  )}
                  {customerName && <span>{customerName}</span>}
                </div>
              )}
            </div>
          )}
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
                  className="space-y-6 [&_input]:min-h-11 [&_input]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_textarea]:text-sm"
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
    </WizardSectionTitleContext.Provider>
  );
}
