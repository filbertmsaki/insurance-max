import { useParams } from 'react-router-dom';
import { UnderwriteLine } from '@insurance-max/contracts';
import { createEmptyFleetItemRow } from '@/modules/tenant/quotations/schemas';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import { FleetSetupStep } from '@/modules/tenant/quotations/wizard/steps/FleetSetupStep';
import { MotorFleetDetailsStep } from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { SummaryReviewStep } from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import type { QuotationWizardStepId } from '@/modules/tenant/quotations/wizard/types';
import type { FleetCsvRow } from '@/modules/tenant/quotations/wizard/utils/fleetCsvImport';
import { getUnderwriteLineMeta } from '../lines';
import { BusinessSourceStep } from '../wizard/steps/BusinessSourceStep';
import { ProductCoverStep } from '../wizard/steps/ProductCoverStep';
import { UnderwriteWizardShell } from '../wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '../wizard/useUnderwriteQuotationWizard';
import { FleetPremiumStep } from './FleetPremiumStep';

const FLEET = getUnderwriteLineMeta(UnderwriteLine.FLEET);

/*
 * Product & Cover comes before Vehicles (unlike the order first proposed):
 * each vehicle is priced against the product's covers as it is captured, so
 * the product has to be known before vehicles are added.
 */
const FLEET_WIZARD_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'customer',
    label: 'Customer & Fleet',
    description: 'Fleet owner, fleet reference and type',
    fields: ['customer_id', 'policyholder', 'fleet.header'],
  },
  {
    id: 'cover',
    label: 'Product & Cover',
    description: 'Product, cover period and default vehicle cover',
    fields: [
      'category_id',
      'product_id',
      'currency',
      'exchange_rate',
      'cover_note_type',
      'valid_from',
      'valid_until',
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    description: 'Add, import and price each vehicle',
    fields: ['fleet.items'],
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Vehicle premiums, taxes and fleet totals',
    fields: [],
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
    description: 'Check the fleet before completing',
    fields: ['payment_mode_tira'],
  },
];

function fleetStepFor(step: QuotationWizardStepId): string {
  switch (step) {
    case 'fleet-setup':
    case 'policyholder':
      return 'customer';
    default:
      return 'vehicles';
  }
}

/** Vehicle list operations; behaviour matches the legacy fleet wizard. */
function useFleetVehicleActions(wizard: UnderwriteQuotationWizard) {
  const { form, fleetFieldArray, riskOptions } = wizard;

  const renumber = () =>
    form
      .getValues('fleet.items')
      .forEach((_, index) =>
        form.setValue(`fleet.items.${index}.fleet_entry`, String(index + 1)),
      );

  return {
    add: () =>
      fleetFieldArray.append({
        ...createEmptyFleetItemRow(),
        fleet_entry: String(fleetFieldArray.fields.length + 1),
      }),
    remove: (index: number) => {
      if (fleetFieldArray.fields.length === 1) return;
      if (!window.confirm('Remove this vehicle from the fleet quotation?')) {
        return;
      }
      fleetFieldArray.remove(index);
      renumber();
    },
    duplicate: (index: number) => {
      const source = form.getValues(`fleet.items.${index}`);
      fleetFieldArray.insert(index + 1, {
        ...structuredClone(source),
        risks_covered: source.risks_covered.map((risk) => ({
          ...risk,
          client_ref: createEmptyFleetItemRow().risks_covered[0].client_ref,
          rating_result_metadata: null,
        })),
        subject_matters_covered: [
          { subject_matter_reference: '', subject_matter_desc: '' },
        ],
        fleet_entry: String(index + 2),
        cover_note_number: '',
        motor_dtl: {
          ...source.motor_dtl,
          registration_number: '',
          chassis_number: '',
          engine_number: '',
        },
      });
      renumber();
    },
    importRows: (rows: FleetCsvRow[]) => {
      const start = fleetFieldArray.fields.length;
      fleetFieldArray.append(
        rows.map((row, rowIndex) => {
          const base = createEmptyFleetItemRow();
          const matchedRisk = riskOptions.find(
            (risk) => risk.risk_code === row.risk_code,
          );
          return {
            ...base,
            fleet_entry: String(start + rowIndex + 1),
            risks_covered: [
              {
                ...base.risks_covered[0],
                risk_code: row.risk_code || form.getValues('risks.0.risk_code'),
                risk_id: matchedRisk?.id ?? form.getValues('risks.0.risk_id'),
                sum_insured:
                  row.sum_insured || form.getValues('risks.0.sum_insured'),
                sum_insured_equivalent: row.sum_insured,
              },
            ],
            subject_matters_covered: row.subject_matter_reference.trim()
              ? [
                  {
                    subject_matter_reference: row.subject_matter_reference,
                    subject_matter_desc: row.subject_matter_desc,
                  },
                ]
              : base.subject_matters_covered,
            motor_dtl: {
              ...base.motor_dtl,
              registration_number: row.registration_number,
              chassis_number: row.chassis_number,
              engine_number: row.engine_number,
              make: row.make,
              model: row.model,
              body_type: row.body_type,
              color: row.color,
              year_of_manufacture: row.year_of_manufacture,
              sitting_capacity: row.sitting_capacity,
              owner_name: row.owner_name,
              owner_address: row.owner_address,
            },
          };
        }),
      );
    },
  };
}

export function FleetQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: FLEET,
    quotationId: id,
    steps: FLEET_WIZARD_STEPS,
    // Drafts saved before Customer and Fleet Details were merged.
    stepAliases: { fleet: 'customer' },
  });
  const actions = useFleetVehicleActions(wizard);
  const { form } = wizard;

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit fleet quotation' : 'New fleet quotation'}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'customer':
            return (
              <div className="space-y-6">
                {/* Same select / create / edit behaviour as the motor wizard. */}
                <PolicyholderStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  newCustomerInDialog
                  hideNewCustomerButton
                  compactOnMobile
                />
                <FleetSetupStep
                  form={form}
                  comprehensive={wizard.fleetComprehensive}
                  categoryOptions={wizard.categoryOptions}
                  productOptions={wizard.productOptions}
                  isHydrating={wizard.isHydrating}
                  headerOnly
                />
              </div>
            );
          case 'cover':
            return (
              <div className="space-y-6">
                <ProductCoverStep wizard={wizard} />
                <StepSection
                  title="Default vehicle cover"
                  description="Applied to vehicles as they are added; each vehicle can be changed individually."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WizardInput
                      form={form}
                      name="risks.0.risk_id"
                      label="Default cover"
                      options={wizard.riskOptions.map((risk) => ({
                        value: risk.id,
                        label: risk.risk_name,
                      }))}
                    />
                    <WizardInput
                      form={form}
                      name="risks.0.sum_insured"
                      label="Default sum insured (optional)"
                      type="number"
                    />
                  </div>
                </StepSection>
              </div>
            );
          case 'vehicles':
            return (
              <MotorFleetDetailsStep
                form={form}
                customerOptions={wizard.customerOptions}
                riskOptions={wizard.riskOptions}
                vehicleOptions={wizard.vehicleOptions}
                fieldArray={wizard.fleetFieldArray}
                onAddVehicle={actions.add}
                onRemoveVehicle={actions.remove}
                onDuplicateVehicle={actions.duplicate}
                onImportVehicles={actions.importRows}
                factorContext={wizard.factorContext}
              />
            );
          case 'premium':
            return (
              <FleetPremiumStep
                wizard={wizard}
                onEditVehicles={() => wizard.setStep('vehicles')}
              />
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
                riskCount={wizard.fleetFieldArray.fields.length}
                onEditStep={(step) => wizard.setStep(fleetStepFor(step))}
              />
            );
          default:
            return null;
        }
      }}
    />
  );
}
