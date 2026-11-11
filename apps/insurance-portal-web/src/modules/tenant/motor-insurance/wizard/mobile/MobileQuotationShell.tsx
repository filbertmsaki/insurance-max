import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import './mobileQuotation.css';

/** Height of the app's top header (components/layout/Header.tsx). */
const APP_HEADER_HEIGHT = 70;

export interface MobileStepView {
  id: string;
  /** Short name for the top bar, e.g. "Vehicle". */
  label: string;
  /** Primary button text, e.g. "Next: Vehicle". */
  primaryLabel: string;
  /** Primary button looks enabled only when true. */
  ready: boolean;
  /**
   * Checked before moving on. Return false to stay (the step shows its own
   * message, which is scrolled into view).
   */
  beforeNext?: () => boolean | Promise<boolean>;
}

/**
 * Follows the visual viewport so the on-screen keyboard never covers the
 * bottom bar or the focused field (iOS does not resize fixed layers).
 */
function useVisualViewport() {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setBox({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

function scrollToFirstError(container: HTMLElement | null) {
  // Hidden steps stay mounted, so only consider what is on screen.
  const target = Array.from(
    container?.querySelectorAll<HTMLElement>(
      '[aria-invalid="true"], [data-mq-error]',
    ) ?? [],
  ).find((element) => element.getClientRects().length > 0);
  if (!target) return;
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  if (target.matches('input, textarea, button, select')) {
    target.focus({ preventScroll: true });
  }
}

/**
 * Phone layout shared by Single Motor, Fleet and Short-Term quotations:
 * full-screen top bar with step progress, one scrolling content area and a
 * bottom bar with Save draft and the step's primary action (shown once).
 */
export function MobileQuotationShell({
  wizard,
  title,
  steps,
  renderStep,
  onExit,
}: {
  wizard: UnderwriteQuotationWizard;
  title: string;
  steps: MobileStepView[];
  renderStep: (stepId: string) => ReactNode;
  /** Back from step 1 (the type selection screen). */
  onExit: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const stepIdRef = useRef(wizard.stepId);
  const viewport = useVisualViewport();
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === wizard.stepId),
  );
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const [advancing, setAdvancing] = useState(false);
  const busy = wizard.isSaving || advancing;

  useEffect(() => {
    stepIdRef.current = wizard.stepId;
  });

  useLayoutEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0 });
  }, [wizard.stepId]);

  // Keep the focused field visible above the keyboard.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!target.matches('input, textarea, select')) return;
      window.setTimeout(
        () => target.scrollIntoView({ block: 'center', behavior: 'smooth' }),
        300,
      );
    };
    content.addEventListener('focusin', onFocus);
    return () => content.removeEventListener('focusin', onFocus);
  }, []);

  const values = wizard.form.watch();
  const hasCustomer =
    values.policyholder_mode === 'existing'
      ? Boolean(values.customer_id)
      : Boolean(values.policyholder?.policy_holder_name?.trim());
  const canSaveDraft = hasCustomer && wizard.hasProduct && !busy;

  async function handlePrimary() {
    if (busy || !step) return;
    if (isLast) {
      await wizard.complete();
      window.setTimeout(() => scrollToFirstError(contentRef.current), 80);
      return;
    }
    setAdvancing(true);
    try {
      if (step.beforeNext && !(await step.beforeNext())) {
        window.setTimeout(() => scrollToFirstError(contentRef.current), 50);
        return;
      }
      const from = wizard.stepId;
      await wizard.goToStep(steps[index + 1].id);
      window.setTimeout(() => {
        if (stepIdRef.current === from) {
          scrollToFirstError(contentRef.current);
        }
      }, 80);
    } finally {
      setAdvancing(false);
    }
  }

  const ready = !wizard.isLoading && !(wizard.isEditMode && wizard.isHydrating);

  return createPortal(
    <div
      className="mq-flow fixed inset-x-0 top-[70px] z-40 flex flex-col overflow-hidden bg-[#F4F5F9] md:hidden"
      style={{
        // Below the app's 70px top header, which stays visible.
        height: viewport
          ? `${viewport.height - APP_HEADER_HEIGHT}px`
          : `calc(100dvh - ${APP_HEADER_HEIGHT}px)`,
        transform: viewport ? `translateY(${viewport.top}px)` : undefined,
      }}
    >
      <header className="shrink-0 border-b border-[#E6E8EF] bg-white">
        <div className="flex h-14 items-center gap-1 px-1">
          <button
            type="button"
            aria-label={
              index === 0 ? 'Back to quotation type' : 'Back to previous step'
            }
            onClick={() => (index === 0 ? onExit() : wizard.goBack())}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#1B1F2E] focus-visible:outline-2 focus-visible:outline-[#3B4A8C]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#5B6275]">
              Step {index + 1} of {steps.length} · {step?.label}
            </p>
            <h1 className="truncate text-base font-bold text-[#1B1F2E]">
              {title}
            </h1>
          </div>
        </div>
        <div
          className="flex gap-1 px-3 pb-2"
          role="progressbar"
          aria-label="Quotation progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
        >
          {steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                'h-1 flex-1 rounded-full',
                itemIndex <= index ? 'bg-[#3B4A8C]' : 'bg-[#E1E4EC]',
              )}
            />
          ))}
        </div>
      </header>

      <div
        ref={contentRef}
        className="mq-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {!ready ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-sm text-[#5B6275]"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading quotation…
          </div>
        ) : wizard.loadError ? (
          <p role="alert" className="py-16 text-center text-sm text-[#B42318]">
            This quotation could not be loaded for editing.
          </p>
        ) : (
          <Form {...wizard.form}>
            <form
              noValidate
              onSubmit={(event) => event.preventDefault()}
              className="space-y-3"
            >
              {steps.map((item) => (
                <div
                  key={item.id}
                  hidden={item.id !== wizard.stepId}
                  className="space-y-3"
                >
                  {renderStep(item.id)}
                </div>
              ))}
            </form>
          </Form>
        )}
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-[#E6E8EF] bg-white px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!canSaveDraft}
          title={hasCustomer ? undefined : 'Select a customer to save a draft'}
          onClick={() => void wizard.saveDraft()}
          className="h-12 w-1/3 shrink-0 rounded-[10px] border border-[#3B4A8C] bg-white text-[15px] font-semibold text-[#3B4A8C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A8C] disabled:border-[#C9CDD8] disabled:text-[#767D90]"
        >
          Save draft
        </button>
        <button
          type="button"
          aria-disabled={!step?.ready || busy}
          aria-busy={busy}
          onClick={() => void handlePrimary()}
          className={cn(
            'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A8C]',
            step?.ready && !busy ? 'bg-[#3B4A8C]' : 'bg-[#767D90]',
          )}
        >
          {busy && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          <span className="truncate">
            {isLast && wizard.isSaving ? 'Creating…' : step?.primaryLabel}
          </span>
        </button>
      </footer>
    </div>,
    document.body,
  );
}
