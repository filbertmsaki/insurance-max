import type { TiramisWizardStepId } from '../types';

const steps: Array<{ id: TiramisWizardStepId; label: string }> = [
  { id: 'quotation', label: 'Quotation' },
  { id: 'context', label: 'Context' },
  { id: 'policyholders', label: 'Policyholders' },
  { id: 'details', label: 'Details' },
  { id: 'risk', label: 'Risk & Pricing' },
  { id: 'review', label: 'Review' },
];

export function TiramisWizardStepper({
  value,
  onChange,
}: {
  value: TiramisWizardStepId;
  onChange: (step: TiramisWizardStepId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onChange(step.id)}
          className={[
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            value === step.id
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
