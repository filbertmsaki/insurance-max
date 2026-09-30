import { useParams } from 'react-router-dom';
import { UnderwriteLine } from '@insurance-max/contracts';
import { createEmptyRiskRow } from '@/modules/tenant/quotations/schemas';
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
    id: 'customer',
    label: 'Customer',
    description: 'Select or capture the policyholder',
    fields: ['customer_id', 'policyholder'],
  },
  {
    id: 'vehicle',
    label: 'Vehicle',
    description: 'Look up or capture the vehicle',
    fields: ['motor'],
  },
  {
    id: 'cover',
    label: 'Product & Cover',
    description: 'Insurance class, product and cover period',
    fields: [
      'category_id',
      'product_id',
      'currency',
      'exchange_rate',
      'cover_note_type',
      'valid_from',
      'valid_until',
      'cover_note_desc',
      'operative_clause',
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Cover, rates, add-ons, discounts and taxes',
    fields: ['risks', 'addons'],
  },
  {
    id: 'source',
    label: 'Business Source',
    description: 'Channel, intermediary and branch',
    fields: [
      'channel_type',
      'intermediary_company_id',
      'commission_rate',
      'commission_paid',
    ],
  },
  {
    id: 'review',
    label: 'Review & Submit',
    description: 'Check everything before completing',
    fields: ['payment_mode_tira'],
  },
];

/** Maps the legacy summary's "edit" targets onto the Motor steps. */
function motorStepFor(step: QuotationWizardStepId): string {
  switch (step) {
    case 'motor':
      return 'vehicle';
    case 'policyholder':
      return 'customer';
    case 'risk-premium':
    case 'addons':
      return 'premium';
    default:
      return 'cover';
  }
}

export function MotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: MOTOR,
    quotationId: id,
    steps: MOTOR_WIZARD_STEPS,
  });
  const { form } = wizard;

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit motor quotation' : 'New motor quotation'}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'customer':
            return (
              <PolicyholderStep
                form={form}
                customerOptions={wizard.customerOptions}
              />
            );
          case 'vehicle':
            return (
              <MotorDetailsStep
                form={form}
                vehicleOptions={wizard.vehicleOptions}
              />
            );
          case 'cover':
            return <ProductCoverStep wizard={wizard} />;
          case 'premium':
            return (
              <div className="space-y-6">
                <RiskPremiumStep
                  form={form}
                  riskOptions={wizard.riskOptions}
                  fieldArray={wizard.riskFieldArray}
                  flow="MOTOR_SINGLE"
                  onAddRisk={() =>
                    wizard.riskFieldArray.append(createEmptyRiskRow())
                  }
                  onRemoveRisk={(index) => {
                    if (wizard.riskFieldArray.fields.length > 1) {
                      wizard.riskFieldArray.remove(index);
                    }
                  }}
                  factorContext={wizard.factorContext}
                />
                <AddOnsStep form={form} fieldArray={wizard.addonFieldArray} />
              </div>
            );
          case 'source':
            return <BusinessSourceStep wizard={wizard} />;
          case 'review':
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
