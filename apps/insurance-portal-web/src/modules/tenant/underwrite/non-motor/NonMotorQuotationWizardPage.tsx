import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { UnderwriteLine } from '@insurance-max/contracts';
import { KeyValueGrid } from '@/components/shared/DetailSections';
import { useQuotationSubClasses } from '@/modules/tenant/quotations/hooks';
import { createEmptyRiskRow } from '@/modules/tenant/quotations/schemas';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import { AddOnsStep } from '@/modules/tenant/quotations/wizard/steps/AddOnsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '@/modules/tenant/quotations/wizard/steps/RiskPremiumStep';
import { SummaryReviewStep } from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import type { QuotationWizardStepId } from '@/modules/tenant/quotations/wizard/types';
import { nonMotorApi } from '../api';
import { underwriteKeys } from '../hooks';
import { getUnderwriteLineMeta } from '../lines';
import { BusinessSourceStep } from '../wizard/steps/BusinessSourceStep';
import { ProductCoverStep } from '../wizard/steps/ProductCoverStep';
import { UnderwriteWizardShell } from '../wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '../wizard/useUnderwriteQuotationWizard';
import { NonMotorDocumentsStep } from './NonMotorDocumentsStep';
import { NonMotorPremiumStep } from './NonMotorPremiumStep';
import { RiskDetailsStep, type RiskDetailsState } from './RiskDetailsStep';
import { formatRiskValue, riskDataErrors } from './riskFields';
import { useMissingMandatoryDocuments } from './useNonMotorDocuments';

const NON_MOTOR = getUnderwriteLineMeta(UnderwriteLine.NON_MOTOR);

const EMPTY_RISK_DETAILS: RiskDetailsState = {
  risk_data: {},
  risk_location: '',
  limit_of_liability: '',
};

function toPayload(state: RiskDetailsState) {
  const limit = state.limit_of_liability.trim();
  return {
    risk_data: state.risk_data,
    risk_location: state.risk_location.trim() || null,
    limit_of_liability: limit === '' ? null : Number(limit),
  };
}

function nonMotorStepFor(step: QuotationWizardStepId): string {
  switch (step) {
    case 'policyholder':
    case 'risk-premium':
      return 'customer-cover';
    case 'addons':
      return 'addons';
    default:
      return 'customer-cover';
  }
}

const NON_MOTOR_STEP_ALIASES: Record<string, string> = {
  customer: 'customer-cover',
  class: 'customer-cover',
  risk: 'customer-cover',
  'sum-insured': 'customer-cover',
  addons: 'addons',
  'risk-pricing': 'addons',
  premium: 'customer-cover',
  source: 'review',
  documents: 'review',
  'review-submit': 'review',
  review: 'review',
};

export function NonMotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const [riskState, setRiskState] =
    useState<RiskDetailsState>(EMPTY_RISK_DETAILS);
  const [savedRiskState, setSavedRiskState] = useState<{
    quotationId: string;
    state: RiskDetailsState;
  } | null>(null);
  const [showRiskErrors, setShowRiskErrors] = useState(false);

  // Steps close over the latest risk state through this ref.
  type FieldsList = NonNullable<ReturnType<typeof useRiskFields>['data']>;
  const riskRef = useRef({
    state: riskState,
    fields: [] as FieldsList,
    loading: false,
  });

  const steps: UnderwriteWizardStep[] = [
    {
      id: 'customer-cover',
      label: 'Customer, cover & premium',
      description: 'Choose the product, capture its risk and price the cover',
      fields: [
        'customer_id',
        'policyholder',
        'category_id',
        'product_id',
        'sub_class_id',
        'currency',
        'exchange_rate',
        'cover_note_type',
        'valid_from',
        'valid_until',
        'cover_note_desc',
        'operative_clause',
        'risks',
        'nonMotor',
      ],
      validate: () => {
        if (riskRef.current.loading) {
          return 'Risk details are still loading. Please wait a moment.';
        }
        const errors = riskDataErrors(
          riskRef.current.fields,
          riskRef.current.state.risk_data,
          true,
        );
        const first = Object.values(errors)[0];
        if (first) {
          setShowRiskErrors(true);
          return first;
        }
        const limit = riskRef.current.state.limit_of_liability.trim();
        if (limit !== '' && !(Number(limit) >= 0)) {
          return 'Limit of liability must be a positive amount';
        }
        return null;
      },
    },
    {
      id: 'addons',
      label: 'Add-ons & extensions',
      description: 'Select any optional extensions for this quotation',
      fields: ['addons'],
    },
    {
      id: 'review',
      label: 'Review & submit',
      description: 'Documents, business source and final checks',
      fields: [
        'payment_mode_tira',
        'channel_type',
        'intermediary_company_id',
        'commission_rate',
        'commission_paid',
      ],
    },
  ];

  const wizard = useUnderwriteQuotationWizard({
    line: NON_MOTOR,
    quotationId: id,
    steps,
    stepAliases: NON_MOTOR_STEP_ALIASES,
    hooks: {
      afterDraftSaved: async (quotationId) => {
        await nonMotorApi.saveRiskDetails(
          quotationId,
          toPayload(riskRef.current.state),
        );
      },
      beforeFinalize: async (quotationId) => {
        try {
          await nonMotorApi.saveRiskDetails(
            quotationId,
            toPayload(riskRef.current.state),
          );
          return true;
        } catch {
          // The API client already shows the validation error.
          wizard.setStep('customer-cover');
          return false;
        }
      },
    },
  });
  const { form } = wizard;

  const productId = useWatch({ control: form.control, name: 'product_id' });
  const subClassId = useWatch({ control: form.control, name: 'sub_class_id' });
  const riskFields = useRiskFields(productId, subClassId);
  const { data: subClasses = [] } = useQuotationSubClasses(productId);
  const missingDocuments = useMissingMandatoryDocuments(
    wizard.draftId,
    productId,
    subClassId,
  );

  // Edit: hydrate risk details once from the server.
  const savedRisk = useQuery({
    queryKey: [...underwriteKeys.all, 'non-motor', 'risk-details', id ?? ''],
    queryFn: () => nonMotorApi.getRiskDetails(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
  const hydratedRiskState = savedRisk.data
    ? {
        risk_data: savedRisk.data.risk_data ?? {},
        risk_location: savedRisk.data.risk_location ?? '',
        limit_of_liability:
          savedRisk.data.limit_of_liability == null
            ? ''
            : String(savedRisk.data.limit_of_liability),
      }
    : null;
  const currentRiskState =
    id && hydratedRiskState
      ? (savedRiskState?.quotationId === id
          ? savedRiskState.state
          : hydratedRiskState)
      : riskState;
  const hydratedRiskQuotationId =
    id && savedRiskState?.quotationId === id ? id : null;
  const updateRiskState = (
    nextState: RiskDetailsState | ((current: RiskDetailsState) => RiskDetailsState),
  ) => {
    const resolvedState =
      typeof nextState === 'function' ? nextState(currentRiskState) : nextState;
    if (id && hydratedRiskState) {
      setSavedRiskState({ quotationId: id, state: resolvedState });
    } else {
      setRiskState(resolvedState);
    }
  };
  useEffect(() => {
    riskRef.current = {
      state: currentRiskState,
      fields: riskFields.data ?? [],
      loading: riskFields.isLoading,
    };
  });

  const riskErrors = showRiskErrors
    ? riskDataErrors(riskFields.data ?? [], currentRiskState.risk_data, true)
    : riskDataErrors(riskFields.data ?? [], currentRiskState.risk_data, false);
  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit non-motor quotation' : 'New non-motor quotation'}
      additionalHydrating={
        Boolean(id) && hydratedRiskQuotationId !== id && !savedRisk.isError
      }
      additionalLoadError={savedRisk.error}
      onRetryAdditionalLoad={
        wizard.loadError ? undefined : () => void savedRisk.refetch()
      }
      renderStep={(stepId) => {
        switch (stepId) {
          case 'customer-cover':
            return (
              <div className="space-y-6">
                <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  Start with the customer and product. The selected product and
                  cover type determine the risk questions and available cover
                  options below.
                </p>
                <StepSection
                  title="Customer"
                  description="Choose an existing policyholder or capture a new one."
                  first
                >
                  <PolicyholderStep
                    form={form}
                    customerOptions={wizard.customerOptions}
                    hideSectionTitle
                  />
                </StepSection>
                <StepSection
                  title="Product & cover"
                  description="The product and cover type determine the information and options shown below."
                >
                  <ProductCoverStep wizard={wizard} compact />
                  {subClasses.length > 0 && (
                    <StepSection title="Cover type">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <WizardInput
                          form={form}
                          name="sub_class_id"
                          label="Sub-class / cover type"
                          options={subClasses
                            .filter((item) => item.is_active)
                            .map((item) => ({
                              value: item.id,
                              label: item.name,
                            }))}
                        />
                      </div>
                    </StepSection>
                  )}
                </StepSection>
                <StepSection
                  title="Risk details"
                  description={
                    riskFields.isLoading
                      ? 'Loading questions for the selected product…'
                      : productId
                        ? 'Complete the product-specific risk details.'
                        : 'Select a product to load its risk questions.'
                  }
                >
                  <RiskDetailsStep
                    fields={riskFields.data ?? []}
                    loading={riskFields.isLoading}
                    hasProduct={Boolean(productId)}
                    state={currentRiskState}
                    errors={riskErrors}
                    onChange={updateRiskState}
                  />
                </StepSection>
                <StepSection
                  title="Cover & premium"
                  description="Add insured risks and review the calculated premium."
                >
                  <div id="non-motor-cover-inputs">
                    <RiskPremiumStep
                      form={form}
                      riskOptions={wizard.riskOptions}
                      fieldArray={wizard.riskFieldArray}
                      flow="NON_MOTOR"
                      subjectMatterFieldArray={wizard.nonMotorFieldArray}
                      subjectMatterOptions={wizard.subjectMatterOptions}
                      onAddRisk={() =>
                        wizard.riskFieldArray.append(createEmptyRiskRow())
                      }
                      onRemoveRisk={(index) => {
                        if (wizard.riskFieldArray.fields.length > 1) {
                          wizard.riskFieldArray.remove(index);
                        }
                      }}
                      factorContext={wizard.factorContext}
                      title="Insured risks"
                    />
                  </div>
                  <NonMotorPremiumStep
                    wizard={wizard}
                    onEditRisks={() =>
                      document
                        .getElementById('non-motor-cover-inputs')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  />
                </StepSection>
              </div>
            );
          case 'addons':
            return (
              <div className="space-y-6">
                <AddOnsStep form={form} fieldArray={wizard.addonFieldArray} />
              </div>
            );
          case 'review':
            return (
              <div className="space-y-6">
                <div id="non-motor-documents">
                  <NonMotorDocumentsStep
                    quotationId={wizard.draftId}
                    productId={productId}
                    subClassId={subClassId}
                  />
                </div>
                <BusinessSourceStep wizard={wizard} />
                <SummaryReviewStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  categoryOptions={wizard.categoryOptions}
                  productOptions={wizard.productOptions}
                  riskOptions={wizard.riskOptions}
                  riskCount={wizard.riskFieldArray.fields.length}
                  onEditStep={(step) => wizard.setStep(nonMotorStepFor(step))}
                />
                <StepSection
                  title="Risk details"
                  action={
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    onClick={() => wizard.setStep('customer-cover')}
                    >
                      Edit
                    </button>
                  }
                >
                  <KeyValueGrid
                    items={[
                      {
                        label: 'Location',
                        value: currentRiskState.risk_location || '—',
                      },
                      {
                        label: 'Limit of liability',
                        value: currentRiskState.limit_of_liability || '—',
                      },
                      ...(riskFields.data ?? []).map((field) => ({
                        label: field.label,
                        value: formatRiskValue(
                          field,
                          currentRiskState.risk_data[field.field_key],
                        ),
                      })),
                    ]}
                  />
                </StepSection>
                {missingDocuments.length > 0 && (
                  <div
                    role="status"
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <p className="font-medium">
                      Attach these mandatory documents before completing the
                      quotation:
                    </p>
                    <p>
                      {missingDocuments.map((item) => item.name).join(', ')}
                    </p>
                    <button
                      type="button"
                      className="mt-1 font-medium underline"
                      onClick={() => {
                        document
                          .getElementById('non-motor-documents')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        toast.message('Attach the remaining documents');
                      }}
                    >
                      Go to documents
                    </button>
                  </div>
                )}
              </div>
            );
          default:
            return null;
        }
      }}
    />
  );
}

function useRiskFields(productId: string, subClassId: string) {
  return useQuery({
    queryKey: [
      ...underwriteKeys.all,
      'non-motor',
      'risk-fields',
      productId,
      subClassId,
    ],
    queryFn: () => nonMotorApi.getRiskFields(productId, subClassId || null),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}
