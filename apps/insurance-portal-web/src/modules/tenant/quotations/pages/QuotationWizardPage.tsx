import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import {
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyFleetItemRow,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyNonMotorItemRow,
  createEmptyRiskRow,
  quotationFormSchema,
  quotationRecordToFormValues,
  type QuotationFormSchemaValues,
} from '../schemas';
import {
  useCreateQuotation,
  useQuotationBranches,
  useQuotationCategories,
  useQuotationCurrentCompanyId,
  useQuotationCustomers,
  useQuotationDetail,
  useQuotationProducts,
  useQuotationRisks,
  useQuotationSalePoints,
  useQuotationVehicles,
  useUpdateQuotation,
} from '../hooks';
import { QuotationWizardStepper } from '../wizard/QuotationWizardStepper';
import { useQuotationWizardDraft } from '../wizard/useQuotationWizardDraft';
import {
  getWizardStepsForFlow,
  type QuotationWizardStepId,
} from '../wizard/types';
import { aggregateRiskTotals } from '../wizard/utils/premiumAggregation';
import { CoverNoteSetupStep } from '../wizard/steps/CoverNoteSetupStep';
import { PolicyholderStep } from '../wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '../wizard/steps/RiskPremiumStep';
import { AddOnsStep } from '../wizard/steps/AddOnsStep';
import { MotorDetailsStep } from '../wizard/steps/MotorDetailsStep';
import { MotorFleetDetailsStep } from '../wizard/steps/MotorFleetDetailsStep';
import { SummaryReviewStep } from '../wizard/steps/SummaryReviewStep';
import { NonMotorDetailsStep } from '../wizard/steps/NonMotorDetailsStep';

const STEP_FIELDS: Partial<
  Record<QuotationWizardStepId, (keyof QuotationFormSchemaValues)[]>
> = {
  'cover-note': [
    'category_id',
    'product_id',
    'branch_id',
    'channel_type',
    'intermediary_company_id',
    'valid_from',
    'valid_until',
    'currency',
    'exchange_rate',
    'cover_note_type',
    'prev_cover_note_reference',
    'sale_point_id',
  ],
  policyholder: ['customer_id', 'policyholder'],
  'risk-premium': ['risks'],
  'non-motor': ['nonMotor'],
  addons: ['addons'],
  motor: ['motor_mode', 'motor'],
  'motor-fleet': ['fleet'],
};

const DEFAULT_VALUES: QuotationFormSchemaValues = {
  insurer_company_id: '',
  intermediary_company_id: '',
  branch_id: '',
  department_id: '',
  policyholder_mode: 'existing',
  customer_id: '',
  policyholder: {
    ...createEmptyCustomerDefaults(),
  },
  category_id: '',
  product_id: '',
  sub_class_id: '',
  quotation_flow: 'NON_MOTOR',
  quotation_type: 'NON_MOTOR',
  is_fleet: false,
  channel_type: 'DIRECT',
  status: 'DRAFT',
  currency: 'TZS',
  exchange_rate: '1',
  sum_insured: '',
  basic_premium: '',
  total_discount: '',
  total_tax: '',
  total_charges: '',
  total_commission: '',
  total_premium: '',
  net_premium: '',
  valid_from: '2026-07-21',
  valid_until: '2027-07-20',
  rating_version: '',
  rejection_reason: '',
  sale_point_id: '',
  cover_note_type: '1',
  prev_cover_note_reference: '',
  endorsement_type: '',
  endorsement_reason: '',
  endorsement_premium_earned: '',
  officer_name: '',
  officer_title: '',
  payment_mode_tira: '1',
  risks: [createEmptyRiskRow()],
  addons: [],
  motor_mode: 'existing',
  motor: createEmptyMotorDetails(),
  fleet: createEmptyFleetDetails(),
  nonMotor: createEmptyNonMotorDetails(),
};

function createEmptyCustomerDefaults() {
  return {
    customer_type: 'INDIVIDUAL' as const,
    customer_no: '',
    full_name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '' as const,
    date_of_birth: '',
    nationality: '',
    company_name: '',
    registration_no: '',
    incorporation_certificate_no: '',
    tin: '',
    vrn: '',
    id_type: '' as const,
    id_number: '',
    nida_no: '',
    voter_no: '',
    passport_no: '',
    driving_license_no: '',
    zanid_no: '',
    phone: '',
    alternate_phone: '',
    fax: '',
    email: '',
    country: '',
    country_code: 'TZA',
    region: '',
    district: '',
    ward: '',
    street: '',
    postal_address: '',
    contact_name: '',
    contact_role: '',
    contact_phone: '',
    contact_email: '',
    kyc_status: 'PENDING' as const,
    document_type: '',
    document_no: '',
    document_file_name: '',
    document_file_url: '',
    document_mime_type: '',
    document_verified: false,
    status: 'ACTIVE' as const,
  };
}

function findFirstErrorMessage(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) {
    return record.message;
  }
  for (const value of Object.values(record)) {
    const found = findFirstErrorMessage(value);
    if (found) return found;
  }
  return null;
}

export function QuotationWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const companyId = useQuotationCurrentCompanyId();
  const { data: existingQuotation, isLoading: loadingQuotation, error } =
    useQuotationDetail(id);
  const { data: customerOptions = [] } = useQuotationCustomers();
  const [stepId, setStepId] = useState<QuotationWizardStepId>('cover-note');
  const [completedSteps, setCompletedSteps] = useState<QuotationWizardStepId[]>([]);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationFormSchema as any) as any,
    defaultValues: DEFAULT_VALUES,
  });

  const riskFieldArray = useFieldArray({
    control: form.control,
    name: 'risks',
  });
  const addonFieldArray = useFieldArray({
    control: form.control,
    name: 'addons',
  });
  const fleetFieldArray = useFieldArray({
    control: form.control,
    name: 'fleet.items',
  });
  const nonMotorFieldArray = useFieldArray({
    control: form.control,
    name: 'nonMotor.items',
  });

  const quotationFlow = form.watch('quotation_flow');
  const categoryId = form.watch('category_id');
  const productId = form.watch('product_id');
  const branchId = form.watch('branch_id');
  const customerId = form.watch('customer_id');
  const policyholderMode = form.watch('policyholder_mode');
  const watchedRisks = useWatch({
    control: form.control,
    name: 'risks',
  });

  const { loadDraft, saveDraft, clearDraft } = useQuotationWizardDraft(id ?? null);
  const businessLine = quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';
  const { data: categoryOptions = [] } = useQuotationCategories(businessLine);
  const { data: productOptions = [] } = useQuotationProducts({
    category_id: categoryId || undefined,
    business_line: businessLine,
    supports_fleet: quotationFlow === 'MOTOR_FLEET' ? true : undefined,
  });
  const { data: branchOptions = [] } = useQuotationBranches();
  const { data: riskOptions = [] } = useQuotationRisks(productId);
  const { data: activeSalePoints = [] } = useQuotationSalePoints(branchId);
  const { data: vehicleOptions = [] } = useQuotationVehicles(
    policyholderMode === 'existing' ? customerId : undefined,
  );
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation(id);

  const steps = useMemo(
    () => getWizardStepsForFlow(quotationFlow),
    [quotationFlow],
  );
  const salePointRequired = activeSalePoints.length > 1;

  useEffect(() => {
    if (companyId) {
      form.setValue('insurer_company_id', companyId);
    }
  }, [companyId, form]);

  useEffect(() => {
    if (isEditMode || !companyId) return;
    const draft = loadDraft();
    if (draft) {
      form.reset({
        ...DEFAULT_VALUES,
        ...draft,
        insurer_company_id: companyId,
      });
      return;
    }
    form.reset({
      ...DEFAULT_VALUES,
      insurer_company_id: companyId,
    });
  }, [companyId, form, isEditMode, loadDraft]);

  useEffect(() => {
    if (!existingQuotation) return;
    form.reset({
      ...DEFAULT_VALUES,
      ...quotationRecordToFormValues(existingQuotation),
      insurer_company_id: existingQuotation.internal_quotation.insurer_company_id,
    });
  }, [existingQuotation, form]);

  useEffect(() => {
    if (!steps.some((step) => step.id === stepId)) {
      setStepId(steps[0]?.id ?? 'cover-note');
    }
  }, [stepId, steps]);

  useEffect(() => {
    form.setValue('quotation_type', quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR');
    form.setValue('is_fleet', quotationFlow === 'MOTOR_FLEET');

    if (quotationFlow === 'NON_MOTOR') {
      if (form.getValues('nonMotor.items').length === 0) {
        form.setValue('nonMotor.items', [createEmptyNonMotorItemRow()]);
      }
    }

    if (quotationFlow !== 'NON_MOTOR') {
      if (form.getValues('nonMotor.items').length === 0) {
        form.setValue('nonMotor.items', [createEmptyNonMotorItemRow()]);
      }
    }

    if (quotationFlow !== 'MOTOR_SINGLE') {
      form.clearErrors('motor');
    }

    if (quotationFlow !== 'MOTOR_FLEET') {
      form.clearErrors('fleet');
    }
  }, [form, quotationFlow]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (isEditMode) return;
      saveDraft(values as Partial<QuotationFormSchemaValues>);
    });
    return () => subscription.unsubscribe();
  }, [form, isEditMode, saveDraft]);

  useEffect(() => {
    const totals = aggregateRiskTotals(
      (watchedRisks ?? []) as QuotationFormSchemaValues['risks'],
    );
    const current = form.getValues();
    if (current.sum_insured !== totals.sum_insured) {
      form.setValue('sum_insured', totals.sum_insured);
    }
    if (current.basic_premium !== totals.basic_premium) {
      form.setValue('basic_premium', totals.basic_premium);
    }
    if (current.total_discount !== totals.total_discount) {
      form.setValue('total_discount', totals.total_discount);
    }
    if (current.total_tax !== totals.total_tax) {
      form.setValue('total_tax', totals.total_tax);
    }
    if (current.total_charges !== totals.total_charges) {
      form.setValue('total_charges', totals.total_charges);
    }
    if (current.total_commission !== totals.total_commission) {
      form.setValue('total_commission', totals.total_commission);
    }
    if (current.total_premium !== totals.total_premium) {
      form.setValue('total_premium', totals.total_premium);
    }
    if (current.net_premium !== totals.net_premium) {
      form.setValue('net_premium', totals.net_premium);
    }
  }, [form, watchedRisks]);

  useEffect(() => {
    const risks = form.getValues('risks');
    risks.forEach((risk, index) => {
      if (!risk.risk_code && risk.risk_id) {
        const match = riskOptions.find((option) => option.id === risk.risk_id);
        if (match?.risk_code) {
          form.setValue(`risks.${index}.risk_code`, match.risk_code);
        }
      }
      if (!risk.risk_id && risk.risk_code) {
        const match = riskOptions.find((option) => option.risk_code === risk.risk_code);
        if (match?.id) {
          form.setValue(`risks.${index}.risk_id`, match.id);
        }
      }
    });
  }, [form, riskOptions]);

  const goToStep = useCallback(async (nextStep: QuotationWizardStepId) => {
    const fields = STEP_FIELDS[stepId];
    if (fields?.length) {
      const valid = await form.trigger(fields, { shouldFocus: true });
      if (!valid) {
        toast.error(findFirstErrorMessage(form.formState.errors) ?? 'Please fix the highlighted fields before continuing.');
        return;
      }
    }

    setCompletedSteps((previous) =>
      previous.includes(stepId) ? previous : [...previous, stepId],
    );
    setStepId(nextStep);
  }, [form, stepId]);

  const goNext = useCallback(async () => {
    const currentIndex = steps.findIndex((step) => step.id === stepId);
    const next = steps[currentIndex + 1];
    if (next) {
      await goToStep(next.id);
    }
  }, [goToStep, stepId, steps]);

  const goBack = useCallback(() => {
    const currentIndex = steps.findIndex((step) => step.id === stepId);
    const previous = steps[currentIndex - 1];
    if (previous) {
      setStepId(previous.id);
    }
  }, [stepId, steps]);

  function addRisk() {
    riskFieldArray.append(createEmptyRiskRow());
  }

  function removeRisk(index: number) {
    if (riskFieldArray.fields.length === 1) return;
    riskFieldArray.remove(index);
  }

  function addFleetVehicle() {
    fleetFieldArray.append({
      ...createEmptyFleetItemRow(),
      fleet_entry: String(fleetFieldArray.fields.length + 1),
    });
  }

  function removeFleetVehicle(index: number) {
    if (fleetFieldArray.fields.length === 1) return;
    if (!window.confirm('Remove this fleet vehicle from the quotation?')) return;
    fleetFieldArray.remove(index);
    const remaining = form.getValues('fleet.items');
    remaining.forEach((_, itemIndex) => {
      form.setValue(`fleet.items.${itemIndex}.fleet_entry`, String(itemIndex + 1));
    });
  }

  function duplicateFleetVehicle(index: number) {
    const source = form.getValues(`fleet.items.${index}`);
    fleetFieldArray.insert(index + 1, {
      ...source,
      fleet_entry: String(index + 2),
      cover_note_number: '',
      motor_dtl: {
        ...source.motor_dtl,
        registration_number: '',
        chassis_number: '',
        engine_number: '',
      },
    });
  }

  const persistQuotation = useCallback(async (proceedToPayment: boolean) => {
    const valid = await form.trigger(undefined, { shouldFocus: true });
    if (!valid) {
      toast.error(findFirstErrorMessage(form.formState.errors) ?? 'Please complete the required quotation fields.');
      return;
    }

    const values = form.getValues();
    const salePoint = activeSalePoints.find((item) => item.id === values.sale_point_id);
    const product = productOptions.find((item) => item.id === values.product_id);
    const existingCustomer = customerOptions.find(
      (item) => item.id === values.customer_id,
    );
    const salePointCode = salePoint?.salePointCode;
    const productCode = product?.tiramis_product_code || product?.product_code || product?.id;

    if (!salePointCode) {
      toast.error('Select a valid sale point before saving this quotation.');
      return;
    }

    if (!productCode) {
      toast.error('Select a valid product before saving this quotation.');
      return;
    }

    const mutation = isEditMode ? updateMutation : createMutation;
    mutation.mutate(
      {
        values,
        salePointCode,
        productCode,
        existingCustomer,
      },
      {
        onSuccess: (quotation) => {
          clearDraft();
          if (proceedToPayment) {
            navigate(underwritingPaths.quotationPayment(quotation.id));
            return;
          }
          navigate(underwritingPaths.quotationDetail(quotation.id));
        },
      },
    );
  }, [
    activeSalePoints,
    clearDraft,
    createMutation,
    customerOptions,
    form,
    isEditMode,
    navigate,
    productOptions,
    updateMutation,
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isFirstStep = steps[0]?.id === stepId;
  const isLastStep = steps[steps.length - 1]?.id === stepId;

  const footerNode = useMemo(
    () =>
      !loadingQuotation ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={isFirstStep}
          >
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => persistQuotation(false)}
              disabled={isSaving || !companyId}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            {isLastStep ? (
              <Button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                disabled={isSaving || !companyId}
              >
                {isSaving ? 'Saving...' : 'Save & Proceed to Payment'}
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      ) : null,
    [
      companyId,
      goBack,
      goNext,
      isFirstStep,
      isLastStep,
      isSaving,
      loadingQuotation,
      persistQuotation,
    ],
  );

  usePageFooter(footerNode);

  if (loadingQuotation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>Could not load this quotation for editing: {String(error)}</p>
        <Button
          variant="outline"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          Back to Quotations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={isEditMode ? 'Edit Quotation' : 'Quotation Wizard'}
          description={
            isEditMode
              ? 'Continue editing this quotation draft using the current backend quotation contract.'
              : 'Create one quotation wizard that supports motor single, motor fleet, and non-motor flows.'
          }
        />
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4">
        <QuotationWizardStepper
          steps={steps}
          value={stepId}
          completed={completedSteps}
          onChange={goToStep}
        />

        <Form {...form}>
          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
            {stepId === 'cover-note' && (
              <CoverNoteSetupStep
                form={form}
                categoryOptions={categoryOptions}
                productOptions={productOptions}
                branchOptions={branchOptions}
                salePointOptions={activeSalePoints}
                salePointRequired={salePointRequired}
              />
            )}

            {stepId === 'policyholder' && (
              <PolicyholderStep form={form} customerOptions={customerOptions} />
            )}

            {stepId === 'risk-premium' && (
              <RiskPremiumStep
                form={form}
                riskOptions={riskOptions}
                fieldArray={riskFieldArray}
                onRemoveRisk={removeRisk}
                onAddRisk={addRisk}
              />
            )}

            {stepId === 'non-motor' && (
              <NonMotorDetailsStep
                form={form}
                fieldArray={nonMotorFieldArray}
              />
            )}

            {stepId === 'addons' && (
              <AddOnsStep form={form} fieldArray={addonFieldArray} />
            )}

            {stepId === 'motor' && (
              <MotorDetailsStep form={form} vehicleOptions={vehicleOptions} />
            )}

            {stepId === 'motor-fleet' && (
              <MotorFleetDetailsStep
                form={form}
                customerOptions={customerOptions}
                riskOptions={riskOptions}
                fieldArray={fleetFieldArray}
                onAddVehicle={addFleetVehicle}
                onRemoveVehicle={removeFleetVehicle}
                onDuplicateVehicle={duplicateFleetVehicle}
              />
            )}

            {stepId === 'summary' && (
              <SummaryReviewStep
                form={form}
                customerOptions={customerOptions}
                categoryOptions={categoryOptions}
                productOptions={productOptions}
                branchOptions={branchOptions}
                salePointOptions={activeSalePoints}
                riskOptions={riskOptions}
                riskCount={riskFieldArray.fields.length}
                onEditStep={setStepId}
              />
            )}
          </form>
        </Form>
      </div>

      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed to payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves the quotation draft and takes you to the payment page.
              TIRAMIS submission still happens from the backend after payment
              requirements are satisfied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSubmitOpen(false);
                void persistQuotation(true);
              }}
            >
              Confirm &amp; Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
