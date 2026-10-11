import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { UnderwriteLine } from '@insurance-max/contracts';
import { AddOnsStep } from '@/modules/tenant/quotations/wizard/steps/AddOnsStep';
import { MotorDetailsStep } from '@/modules/tenant/quotations/wizard/steps/MotorDetailsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '@/modules/tenant/quotations/wizard/steps/RiskPremiumStep';
import { SummaryReviewStep } from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import type { QuotationWizardStepId } from '@/modules/tenant/quotations/wizard/types';
import { getUnderwriteLineMeta } from '../lines';
import { BusinessSourceStep } from '../wizard/steps/BusinessSourceStep';
import { ProductCoverStep } from '../wizard/steps/ProductCoverStep';
import { UnderwriteWizardShell } from '../wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '../wizard/useUnderwriteQuotationWizard';

const MOTOR = getUnderwriteLineMeta(UnderwriteLine.MOTOR);

const MOTOR_WIZARD_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'product-cover',
    label: 'Product & Cover',
    description: 'Select a motor product and set the cover period',
    fields: [
      'product_id',
      'currency',
      'exchange_rate',
      'cover_note_type',
      'valid_from',
      'valid_until',
      'cover_note_desc',
      'operative_clause',
      'risks.0.risk_id',
    ],
  },
  {
    id: 'customer-vehicle',
    label: 'Customer & Vehicle',
    description: 'Select the policyholder and capture the insured vehicle',
    fields: ['customer_id', 'policyholder', 'motor', 'risks.0.sum_insured'],
  },
  {
    id: 'premium-source',
    label: 'Premium & Business Source',
    description: 'Set the premium, covers, channel and intermediary',
    fields: [
      'addons',
      'channel_type',
      'intermediary_company_id',
      'commission_rate',
      'commission_paid',
    ],
  },
  {
    id: 'review-submit',
    label: 'Review & Submit',
    description: 'Check everything before completing',
    fields: ['payment_mode_tira'],
  },
];

/** Map saved step IDs from the six-step layout to their new combined steps. */
const LEGACY_MOTOR_STEP_MAP: Record<string, string> = {
  customer: 'customer-vehicle',
  vehicle: 'customer-vehicle',
  cover: 'product-cover',
  premium: 'premium-source',
  source: 'premium-source',
  review: 'review-submit',
};

/** Maps the legacy summary's "edit" targets onto the Motor steps. */
function motorStepFor(step: QuotationWizardStepId): string {
  switch (step) {
    case 'motor':
      return 'customer-vehicle';
    case 'policyholder':
      return 'customer-vehicle';
    case 'risk-premium':
    case 'addons':
      return 'premium-source';
    default:
      return 'product-cover';
  }
}

export function MotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: MOTOR,
    quotationId: id,
    steps: MOTOR_WIZARD_STEPS,
    stepAliases: LEGACY_MOTOR_STEP_MAP,
    deferDraftUntilStepId: 'premium-source',
  });
  const { form } = wizard;

  useEffect(() => {
    const risks = form.getValues('risks');
    if (risks.length > 1) {
      wizard.riskFieldArray.replace([risks[0]]);
    }
  }, [form, wizard.riskFieldArray, wizard.riskFieldArray.fields.length]);

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit motor quotation' : 'New motor quotation'}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'product-cover':
            return <ProductCoverStep wizard={wizard} />;
          case 'customer-vehicle':
            return (
              <div className="space-y-6">
                <PolicyholderStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  newCustomerInDialog
                />
                <MotorDetailsStep
                  form={form}
                  vehicleOptions={wizard.vehicleOptions}
                  factorContext={wizard.factorContext}
                />
              </div>
            );
          case 'premium-source':
            return (
              <div className="space-y-6">
                <RiskPremiumStep
                  form={form}
                  riskOptions={wizard.riskOptions}
                  fieldArray={wizard.riskFieldArray}
                  flow="MOTOR_SINGLE"
                  onAddRisk={() => undefined}
                  onRemoveRisk={(index) => {
                    if (wizard.riskFieldArray.fields.length > 1) {
                      wizard.riskFieldArray.remove(index);
                    }
                  }}
                  factorContext={wizard.factorContext}
                  allowMultipleRisks={false}
                  showRiskSelector={false}
                  showSumInsured={false}
                />
                <AddOnsStep form={form} fieldArray={wizard.addonFieldArray} />
                <BusinessSourceStep wizard={wizard} />
              </div>
            );
          case 'review-submit':
            return (
              <SummaryReviewStep
                form={form}
                customerOptions={wizard.customerOptions}
                categoryOptions={wizard.categoryOptions}
                productOptions={wizard.productOptions}
                riskOptions={wizard.riskOptions}
                riskCount={wizard.riskFieldArray.fields.length}
                onEditStep={(step) => wizard.setStep(motorStepFor(step))}
              />
            );
          default:
            return null;
        }
      }}
    />
  );
}
