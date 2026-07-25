import { Check, CircleAlert } from 'lucide-react';

type StepLike = { id: string; label?: string; title?: string; description?: string };

type Props = {
  steps: StepLike[];
  currentStep: string;
  completedSteps?: string[];
  errorSteps?: string[];
  onStepClick?: (step: string) => void;
};

const descriptions: Record<string, string> = {
  'cover-note': 'Set up quotation and cover period',
  'fleet-setup': 'Define the fleet context',
  policyholder: 'Select or create the policyholder',
  'risk-premium': 'Capture insured risks and values',
  addons: 'Add optional covers and adjustments',
  motor: 'Complete vehicle and motor details',
  'fleet-vehicles': 'Add and validate fleet vehicles',
  summary: 'Review before submission',
};

export function QuotationJourneyProgress({ steps, currentStep, completedSteps = [], errorSteps = [], onStepClick }: Props) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));
  return (
    <nav aria-label="Quotation progress" className="quotation-stepper">
      <div className="quotation-stepper__desktop">
        {steps.map((step, index) => {
          const active = step.id === currentStep;
          const complete = completedSteps.includes(step.id) || index < activeIndex;
          const error = errorSteps.includes(step.id);
          return (
            <button
              aria-current={active ? 'step' : undefined}
              className={`quotation-stepper__step ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''} ${error ? 'has-error' : ''}`}
              disabled={!onStepClick || (!active && !complete)}
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              type="button"
            >
              <span className="quotation-stepper__index">{error ? <CircleAlert size={15} /> : complete ? <Check size={15} /> : index + 1}</span>
              <span className="quotation-stepper__copy">
                <span className="quotation-stepper__title">{step.title ?? step.label ?? step.id}</span>
                <span className="quotation-stepper__description">{step.description ?? descriptions[step.id]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="quotation-stepper__mobile">
        <div className="d-flex justify-content-between align-items-center gap-3">
          <div><div className="small text-body-secondary">Step {activeIndex + 1} of {steps.length}</div><div className="fw-semibold">{steps[activeIndex]?.label}</div></div>
          <span className="small text-body-secondary">{Math.round(((activeIndex + 1) / Math.max(steps.length, 1)) * 100)}%</span>
        </div>
        <div aria-valuemax={steps.length} aria-valuemin={0} aria-valuenow={activeIndex + 1} className="progress mt-3" role="progressbar"><div className="progress-bar" style={{ width: `${((activeIndex + 1) / Math.max(steps.length, 1)) * 100}%` }} /></div>
      </div>
    </nav>
  );
}
