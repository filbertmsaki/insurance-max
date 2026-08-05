import { Check, Circle } from 'lucide-react';
import type { QuotationWizardStepDef, QuotationWizardStepId } from './types';

interface Props {
  steps: QuotationWizardStepDef[];
  value: QuotationWizardStepId;
  completed: QuotationWizardStepId[];
  onChange: (step: QuotationWizardStepId) => void;
}

export function QuotationWizardStepper({
  steps,
  value,
  completed,
  onChange,
}: Props) {
  return (
    <nav
      aria-label="Quotation progress"
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = value === step.id;
          const isDone = completed.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onChange(step.id)}
                className={[
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-900'
                    : isDone
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600',
                  ].join(' ')}
                >
                  {isDone && !isActive ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : isActive ? (
                    index + 1
                  ) : (
                    <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-60">
                    Step {index + 1}
                  </span>
                  <span className="block truncate font-medium">
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
