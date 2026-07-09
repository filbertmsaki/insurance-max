import { Check } from 'lucide-react';
import type { QuotationWizardStepDef, QuotationWizardStepId } from './types';

interface Props {
  steps: QuotationWizardStepDef[];
  value: QuotationWizardStepId;
  completed: QuotationWizardStepId[];
  onChange: (step: QuotationWizardStepId) => void;
}

export function QuotationWizardStepper({ steps, value, completed, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      {steps.map((step, index) => {
        const isActive = value === step.id;
        const isDone = completed.includes(step.id);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onChange(step.id)}
            className={[
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-slate-900 text-white'
                : isDone
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {isDone && !isActive ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <span className="text-xs opacity-70">{index + 1}.</span>
            )}
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
