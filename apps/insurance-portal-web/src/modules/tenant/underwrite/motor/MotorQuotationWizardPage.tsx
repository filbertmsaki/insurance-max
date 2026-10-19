import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { UnderwriteLine } from '@insurance-max/contracts';
import { AddOnsStep } from '@/modules/tenant/quotations/wizard/steps/AddOnsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '@/modules/tenant/quotations/wizard/steps/RiskPremiumStep';
import {
  SummaryReviewStep,
  type SummarySection,
} from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import { useProductAddonDefinitions } from '@/modules/tenant/quotations/wizard/hooks/useProductAddonDefinitions';
import { getUnderwriteLineMeta } from '../lines';
import { BusinessSourceStep } from '../wizard/steps/BusinessSourceStep';
import { ProductCoverStep } from '../wizard/steps/ProductCoverStep';
import { UnderwriteWizardShell } from '../wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '../wizard/useUnderwriteQuotationWizard';
import { MotorVehicleSection } from './MotorVehicleSection';

const MOTOR = getUnderwriteLineMeta(UnderwriteLine.MOTOR);

/**
 * Two steps: everything the underwriter decides on one screen (customer,
 * vehicle, cover, premium inputs, business source), then the review. Field
 * order follows the screen so validation focuses the first problem.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const MOTOR_WIZARD_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'details',
    label: 'Quote details',
    description: 'Customer, vehicle and cover',
    fields: [
      'customer_id',
      'policyholder',
      'motor',
      'product_id',
      'risks.0.risk_id',
      'payment_mode_tira',
      'currency',
      'exchange_rate',
      'cover_note_type',
      'valid_from',
      'valid_until',
      'cover_note_desc',
      'operative_clause',
      'risks.0.sum_insured',
      'addons',
      'channel_type',
      'intermediary_company_id',
      'commission_rate',
      'commission_paid',
    ],
  },
  {
    id: 'review',
    label: 'Review & submit',
    description: 'Check the premium and create the quotation',
    fields: [],
  },
];

/** Step IDs saved by the earlier four- and six-step Motor layouts. */
// eslint-disable-next-line react-refresh/only-export-components
export const LEGACY_MOTOR_STEP_MAP: Record<string, string> = {
  'product-cover': 'details',
  'customer-vehicle': 'details',
  'premium-source': 'details',
  customer: 'details',
  vehicle: 'details',
  cover: 'details',
  premium: 'details',
  source: 'details',
  'review-submit': 'review',
};

const SECTION_ANCHORS: Record<SummarySection, string> = {
  customer: 'motor-quote-customer',
  vehicle: 'motor-quote-vehicle',
  cover: 'motor-quote-cover',
  premium: 'motor-quote-premium',
};

export function MotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: MOTOR,
    quotationId: id,
    steps: MOTOR_WIZARD_STEPS,
    stepAliases: LEGACY_MOTOR_STEP_MAP,
    deferDraftUntilStepId: 'details',
  });
  const { form } = wizard;
  const productId = useWatch({ control: form.control, name: 'product_id' });
  const { data: addonDefinitions = [] } = useProductAddonDefinitions(
    productId || undefined,
  );
  const showAddOns =
    addonDefinitions.length > 0 || wizard.addonFieldArray.fields.length > 0;

  useEffect(() => {
    const risks = form.getValues('risks');
    if (risks.length > 1) {
      wizard.riskFieldArray.replace([risks[0]]);
    }
  }, [form, wizard.riskFieldArray, wizard.riskFieldArray.fields.length]);

  function editSection(section: SummarySection) {
    wizard.setStep('details');
    // After the step is shown (the shell scrolls to the top on step change).
    window.setTimeout(() => {
      document
        .getElementById(SECTION_ANCHORS[section])
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit motor quotation' : 'New motor quotation'}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'details':
            return (
              <div className="space-y-3">
                <div className="grid items-start gap-6 md:grid-cols-2">
                  <div id={SECTION_ANCHORS.customer} className="min-w-0">
                    <PolicyholderStep
                      form={form}
                      customerOptions={wizard.customerOptions}
                      newCustomerInDialog
                      hideSectionTitle
                      hideNewCustomerButton
                    />
                  </div>
                  <div id={SECTION_ANCHORS.vehicle} className="min-w-0">
                    <MotorVehicleSection
                      form={form}
                      customer={wizard.customerOptions[0] ?? null}
                    />
                  </div>
                </div>
                <div id={SECTION_ANCHORS.cover}>
                  <ProductCoverStep
                    wizard={wizard}
                    compact
                    first
                  />
                </div>
                <div id={SECTION_ANCHORS.premium}>
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
                    title=""
                    riskTitle="Premium calculation"
                    collapseAdjustments
                    first={false}
                  />
                </div>
                {showAddOns && (
                  <AddOnsStep form={form} fieldArray={wizard.addonFieldArray} />
                )}
                <BusinessSourceStep wizard={wizard} />
              </div>
            );
          case 'review':
            return (
              <SummaryReviewStep
                form={form}
                customerOptions={wizard.customerOptions}
                categoryOptions={wizard.categoryOptions}
                productOptions={wizard.productOptions}
                riskOptions={wizard.riskOptions}
                riskCount={wizard.riskFieldArray.fields.length}
                onEditStep={() => editSection('cover')}
                onEditSection={editSection}
                showPaymentMode
              />
            );
          default:
            return null;
        }
      }}
    />
  );
}
