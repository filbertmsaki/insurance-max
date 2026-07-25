import { ArrowRight, Check, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepLike = {
  id: string;
  label?: string;
  title?: string;
  description?: string;
};

type Props = {
  steps: StepLike[];
  currentStep: string;
  completedSteps?: string[];
  errorSteps?: string[];
  onStepClick?: (step: string) => void;
};

const descriptions: Record<string, string> = {
  'cover-note': 'Set up quotation details and cover period.',
  'fleet-setup': 'Define the fleet context before adding vehicles.',
  policyholder: 'Select or create the policyholder profile.',
  'risk-premium': 'Capture risks, values, and premium figures.',
  addons: 'Add optional covers, taxes, and adjustments.',
  motor: 'Complete vehicle and motor-specific details.',
  'fleet-vehicles': 'Add fleet vehicles and validate each record.',
  summary: 'Review the full quotation before saving or submitting.',
};

function getStatusLabel(active: boolean, complete: boolean, error: boolean) {
  if (error) return 'Needs attention';
  if (active) return 'Current step';
  if (complete) return 'Completed';
  return 'Upcoming';
}

export function QuotationJourneyProgress({
  steps,
  currentStep,
  completedSteps = [],
  errorSteps = [],
  onStepClick,
}: Props) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep),
  );
  const progressPercent =
    ((activeIndex + 1) / Math.max(steps.length, 1)) * 100;

  return (
    <nav
      aria-label="Quotation progress"
      className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Workflow Progress
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Build the quotation step by step
          </h3>
        </div>
        <div className="min-w-[12rem] text-right">
          <p className="text-sm font-semibold text-slate-900">
            Step {activeIndex + 1} of {steps.length}
          </p>
          <p className="text-xs text-slate-500">
            {Math.round(progressPercent)}% complete
          </p>
        </div>
      </div>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        {steps.map((step, index) => {
          const active = step.id === currentStep;
          const complete =
            completedSteps.includes(step.id) || index < activeIndex;
          const error = errorSteps.includes(step.id);
          const clickable = Boolean(onStepClick && (active || complete));
          const label = step.title ?? step.label ?? step.id;
          const description = step.description ?? descriptions[step.id];

          return (
            <button
              key={step.id}
              type="button"
              aria-current={active ? 'step' : undefined}
              disabled={!clickable}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                'group relative flex min-h-[148px] flex-col justify-between rounded-[24px] border px-4 py-4 text-left transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                clickable ? 'cursor-pointer' : 'cursor-default',
                active &&
                  'border-sky-300 bg-gradient-to-br from-sky-50 via-cyan-50 to-white shadow-[0_18px_40px_-30px_rgba(14,165,233,0.9)]',
                complete &&
                  !active &&
                  'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50',
                error &&
                  'border-rose-200 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-50',
                !active &&
                  !complete &&
                  !error &&
                  'border-slate-200 bg-slate-50/70 text-slate-500',
              )}
            >
              {index < steps.length - 1 ? (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 xl:block"
                />
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold',
                    active && 'border-sky-500 bg-sky-500 text-white',
                    complete &&
                      !active &&
                      'border-emerald-300 bg-emerald-100 text-emerald-700',
                    error && 'border-rose-300 bg-rose-100 text-rose-700',
                    !active &&
                      !complete &&
                      !error &&
                      'border-slate-300 bg-white text-slate-500',
                  )}
                >
                  {error ? (
                    <CircleAlert className="h-4 w-4" />
                  ) : complete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium',
                    active && 'bg-sky-100 text-sky-700',
                    complete && !active && 'bg-emerald-100 text-emerald-700',
                    error && 'bg-rose-100 text-rose-700',
                    !active &&
                      !complete &&
                      !error &&
                      'bg-slate-200/80 text-slate-600',
                  )}
                >
                  {getStatusLabel(active, complete, error)}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 lg:hidden">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Current Step
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {steps[activeIndex]?.title ??
                  steps[activeIndex]?.label ??
                  steps[activeIndex]?.id}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {steps[activeIndex]?.description ??
                  descriptions[steps[activeIndex]?.id ?? '']}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              {Math.round(progressPercent)}%
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => {
            const active = step.id === currentStep;
            const complete =
              completedSteps.includes(step.id) || index < activeIndex;
            const error = errorSteps.includes(step.id);

            return (
              <button
                key={step.id}
                type="button"
                disabled={!onStepClick || (!active && !complete)}
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-colors',
                  active && 'border-sky-300 bg-sky-50 text-sky-800',
                  complete &&
                    !active &&
                    'border-emerald-200 bg-emerald-50 text-emerald-800',
                  error && 'border-rose-200 bg-rose-50 text-rose-800',
                  !active &&
                    !complete &&
                    !error &&
                    'border-slate-200 bg-white text-slate-500',
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
                  {error ? (
                    <CircleAlert className="h-4 w-4" />
                  ) : complete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {step.title ?? step.label ?? step.id}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {getStatusLabel(active, complete, error)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
