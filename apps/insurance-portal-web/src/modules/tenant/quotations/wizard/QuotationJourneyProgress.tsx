import { Check, CircleAlert } from 'lucide-react';
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

type StepStatus = 'error' | 'active' | 'complete' | 'upcoming';

function getStatusLabel(status: StepStatus) {
  switch (status) {
    case 'error':
      return 'Needs attention';
    case 'active':
      return 'Current step';
    case 'complete':
      return 'Completed';
    default:
      return 'Upcoming';
  }
}

const MARKER_CLASSES: Record<StepStatus, string> = {
  active: 'border-sky-500 bg-sky-500 text-white shadow-[0_0_0_4px_rgba(14,165,233,0.15)]',
  complete: 'border-emerald-500 bg-emerald-500 text-white',
  error: 'border-rose-500 bg-rose-500 text-white',
  upcoming: 'border-slate-300 bg-white text-slate-400',
};

const LABEL_CLASSES: Record<StepStatus, string> = {
  active: 'font-semibold text-sky-700',
  complete: 'font-medium text-emerald-700',
  error: 'font-medium text-rose-700',
  upcoming: 'text-slate-400',
};

const LINE_FILLED_CLASSES = 'bg-emerald-400';
const LINE_UPCOMING_CLASSES = 'bg-slate-200';

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

  const isPassed = steps.map(
    (step, index) => completedSteps.includes(step.id) || index < activeIndex,
  );

  return (
    <nav aria-label="Quotation progress">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Step {activeIndex + 1} of {steps.length}
        </p>
        <p className="text-[11px] font-medium text-slate-400">
          {Math.round(progressPercent)}% complete
        </p>
      </div>

      <ol
        className="grid overflow-x-auto pb-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(2.75rem, 1fr))` }}
      >
        {steps.map((step, index) => {
          const active = step.id === currentStep;
          const complete = isPassed[index];
          const error = errorSteps.includes(step.id);
          const status: StepStatus = error
            ? 'error'
            : active
              ? 'active'
              : complete
                ? 'complete'
                : 'upcoming';
          const clickable = Boolean(onStepClick && (active || complete));
          const label = step.title ?? step.label ?? step.id;
          const leftFilled = index > 0 && isPassed[index - 1];
          const rightFilled = index < steps.length - 1 && isPassed[index];

          return (
            <li key={step.id} className="flex min-w-0 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  aria-hidden="true"
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors duration-300',
                    index === 0
                      ? 'invisible'
                      : leftFilled
                        ? LINE_FILLED_CLASSES
                        : LINE_UPCOMING_CLASSES,
                  )}
                />
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${label} — ${getStatusLabel(status)}`}
                  disabled={!clickable}
                  onClick={() => onStepClick?.(step.id)}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                    clickable ? 'cursor-pointer' : 'cursor-default',
                    MARKER_CLASSES[status],
                  )}
                >
                  {status === 'error' ? (
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  ) : status === 'complete' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </button>
                <div
                  aria-hidden="true"
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors duration-300',
                    index === steps.length - 1
                      ? 'invisible'
                      : rightFilled
                        ? LINE_FILLED_CLASSES
                        : LINE_UPCOMING_CLASSES,
                  )}
                />
              </div>
              <span
                className={cn(
                  'mt-2 hidden max-w-[6.5rem] truncate text-center text-[11px] leading-tight transition-colors duration-300 sm:block',
                  LABEL_CLASSES[status],
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
