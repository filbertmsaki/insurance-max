import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      return 'customer';
    case 'addons':
      return 'addons';
    default:
      return 'sum-insured';
  }
}

export function NonMotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const [riskState, setRiskState] =
    useState<RiskDetailsState>(EMPTY_RISK_DETAILS);
  const [showRiskErrors, setShowRiskErrors] = useState(false);

  // Steps close over the latest risk state through this ref.
  const riskRef = useRef({ state: riskState, fields: [] as FieldsList });
  type FieldsList = NonNullable<ReturnType<typeof useRiskFields>['data']>;

  const steps: UnderwriteWizardStep[] = [
    {
      id: 'customer',
      label: 'Customer',
      description: 'Select or capture the policyholder',
      fields: ['customer_id', 'policyholder'],
    },
    {
      id: 'class',
      label: 'Insurance Class',
      description: 'Class, product, cover type and period',
      fields: [
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
      ],
    },
    {
      id: 'risk',
      label: 'Risk Details',
      description: 'Class-specific risk information',
      fields: [],
      validate: () => {
        const errors = riskDataErrors(
          riskRef.current.fields,
          riskRef.current.state.risk_data,
          true,
        );
        const first = Object.values(errors)[0];
        if (first) setShowRiskErrors(true);
        return first ?? null;
      },
    },
    {
      id: 'sum-insured',
      label: 'Sum Insured & Limits',
      description: 'Insured risks, sums insured and limits',
      fields: ['risks', 'nonMotor'],
      validate: () => {
        const limit = riskRef.current.state.limit_of_liability.trim();
        return limit !== '' && !(Number(limit) >= 0)
          ? 'Limit of liability must be a positive amount'
          : null;
      },
    },
    {
      id: 'addons',
      label: 'Add-ons',
      description: 'Extensions and optional covers',
      fields: ['addons'],
    },
    {
      id: 'premium',
      label: 'Premium & Taxes',
      description: 'Premium, taxes and payable total',
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
      id: 'documents',
      label: 'Documents',
      description: 'Product-required documents',
      fields: [],
    },
    {
      id: 'review',
      label: 'Review & Submit',
      description: 'Check everything before completing',
      fields: ['payment_mode_tira'],
    },
  ];

  const wizard = useUnderwriteQuotationWizard({
    line: NON_MOTOR,
    quotationId: id,
    steps,
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
          wizard.setStep('risk');
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

  useEffect(() => {
    riskRef.current = { state: riskState, fields: riskFields.data ?? [] };
  });

  // Edit: hydrate risk details once from the server.
  const hydratedRef = useRef(false);
  const savedRisk = useQuery({
    queryKey: [...underwriteKeys.all, 'non-motor', 'risk-details', id ?? ''],
    queryFn: () => nonMotorApi.getRiskDetails(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
  useEffect(() => {
    if (!savedRisk.data || hydratedRef.current) return;
    hydratedRef.current = true;
    setRiskState({
      risk_data: savedRisk.data.risk_data ?? {},
      risk_location: savedRisk.data.risk_location ?? '',
      limit_of_liability:
        savedRisk.data.limit_of_liability == null
          ? ''
          : String(savedRisk.data.limit_of_liability),
    });
  }, [savedRisk.data]);

  const riskErrors = showRiskErrors
    ? riskDataErrors(riskFields.data ?? [], riskState.risk_data, true)
    : riskDataErrors(riskFields.data ?? [], riskState.risk_data, false);

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit non-motor quotation' : 'New non-motor quotation'}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'customer':
            return (
              <PolicyholderStep
                form={form}
                customerOptions={wizard.customerOptions}
              />
            );
          case 'class':
            return (
              <div className="space-y-6">
                <ProductCoverStep wizard={wizard} />
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
              </div>
            );
          case 'risk':
            return (
              <RiskDetailsStep
                fields={riskFields.data ?? []}
                loading={riskFields.isLoading}
                hasProduct={Boolean(productId)}
                state={riskState}
                errors={riskErrors}
                onChange={setRiskState}
              />
            );
          case 'sum-insured':
            return (
              <div className="space-y-6">
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
                />
                <StepSection title="Limits">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="limit-of-liability">
                        Limit of liability / indemnity
                      </Label>
                      <Input
                        id="limit-of-liability"
                        type="number"
                        min={0}
                        step="any"
                        value={riskState.limit_of_liability}
                        onChange={(event) =>
                          setRiskState({
                            ...riskState,
                            limit_of_liability: event.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-slate-500">
                        Optional. Recorded with the risk; premiums are
                        calculated from the sums insured above.
                      </p>
                    </div>
                  </div>
                </StepSection>
              </div>
            );
          case 'addons':
            return (
              <AddOnsStep form={form} fieldArray={wizard.addonFieldArray} />
            );
          case 'premium':
            return (
              <NonMotorPremiumStep
                wizard={wizard}
                onEditRisks={() => wizard.setStep('sum-insured')}
              />
            );
          case 'source':
            return <BusinessSourceStep wizard={wizard} />;
          case 'documents':
            return (
              <NonMotorDocumentsStep
                quotationId={wizard.draftId}
                productId={productId}
                subClassId={subClassId}
              />
            );
          case 'review':
            return (
              <div className="space-y-6">
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
                      onClick={() => wizard.setStep('risk')}
                    >
                      Edit
                    </button>
                  }
                >
                  <KeyValueGrid
                    items={[
                      {
                        label: 'Location',
                        value: riskState.risk_location || '—',
                      },
                      {
                        label: 'Limit of liability',
                        value: riskState.limit_of_liability || '—',
                      },
                      ...(riskFields.data ?? []).map((field) => ({
                        label: field.label,
                        value: formatRiskValue(
                          field,
                          riskState.risk_data[field.field_key],
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
                      Mandatory documents not yet attached:
                    </p>
                    <p>
                      {missingDocuments.map((item) => item.name).join(', ')}
                    </p>
                    <button
                      type="button"
                      className="mt-1 font-medium underline"
                      onClick={() => {
                        wizard.setStep('documents');
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
