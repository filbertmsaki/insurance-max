import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import { getApiErrorMessage } from '@/lib/api-error';
import { getSubmissionDetailId } from '@/modules/tenant/tiramis/utils';
import {
  createEmptyFleetDetails,
  createEmptyFleetItemRow,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyNonMotorItemRow,
  createEmptyRiskRow,
  createQuotationFormSchema,
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
import { quotationsApi } from '../api';
import { QuotationJourneyProgress } from '../wizard/QuotationJourneyProgress';
import {
  QuotationStartModal,
  type QuotationStartSelection,
} from '../wizard/QuotationStartModal';
import { useQuotationWizardDraft } from '../wizard/useQuotationWizardDraft';
import {
  getWizardStepsForFlow,
  type QuotationWizardStepId,
} from '../wizard/types';
import {
  aggregateFleetRiskTotals,
  aggregateRiskTotals,
} from '../wizard/utils/premiumAggregation';
import { CoverNoteSetupStep } from '../wizard/steps/CoverNoteSetupStep';
import { PolicyholderStep } from '../wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '../wizard/steps/RiskPremiumStep';
import { AddOnsStep } from '../wizard/steps/AddOnsStep';
import { MotorDetailsStep } from '../wizard/steps/MotorDetailsStep';
import { MotorFleetDetailsStep } from '../wizard/steps/MotorFleetDetailsStep';
import { SummaryReviewStep } from '../wizard/steps/SummaryReviewStep';
import { FleetSetupStep } from '../wizard/steps/FleetSetupStep';

const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'REJECTED',
  'FAILED',
]);

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
    'cover_note_desc',
    'operative_clause',
    'cover_note_type',
    'prev_cover_note_reference',
    'endorsement_type',
    'endorsement_reason',
    'endorsement_premium_earned',
    'commission_paid',
    'commission_rate',
    'officer_name',
    'officer_title',
    'payment_mode_tira',
    'sale_point_id',
  ],
  'fleet-setup': [
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
    'endorsement_type',
    'endorsement_reason',
    'endorsement_premium_earned',
    'commission_paid',
    'commission_rate',
    'officer_name',
    'officer_title',
    'payment_mode_tira',
    'sale_point_id',
    'fleet',
  ],
  policyholder: ['customer_id', 'policyholder'],
  'risk-premium': ['risks', 'nonMotor'],
  addons: ['addons'],
  motor: ['motor_mode', 'motor'],
  'fleet-vehicles': ['fleet'],
};

const DEFAULT_VALUES: QuotationFormSchemaValues = {
  insurer_company_id: '',
  intermediary_company_id: '',
  branch_id: '',
  department_id: '',
  policyholder_mode: 'existing',
  customer_id: '',
  policyholder: getCustomerDefaultValues(),
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
  cover_note_number: '',
  cover_note_desc: '',
  operative_clause: '',
  cover_note_type: '1',
  prev_cover_note_reference: '',
  endorsement_type: '',
  endorsement_reason: '',
  endorsement_premium_earned: '',
  commission_paid: '',
  commission_rate: '',
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
  const { id, sourceId } = useParams<{ id?: string; sourceId?: string }>();
  const isEditMode = Boolean(id);
  const isEndorsementMode = Boolean(sourceId && !isEditMode);
  const usesPrefilledQuotation = isEditMode || isEndorsementMode;
  const companyId = useQuotationCurrentCompanyId();
  const {
    data: existingQuotation,
    isLoading: loadingQuotation,
    error,
  } = useQuotationDetail(id);
  const {
    data: sourceQuotation,
    isLoading: loadingSourceQuotation,
    error: sourceQuotationError,
  } = useQuotationDetail(sourceId);
  const { data: customerOptions = [] } = useQuotationCustomers();
  const [stepId, setStepId] = useState<QuotationWizardStepId>('cover-note');
  const [completedSteps, setCompletedSteps] = useState<QuotationWizardStepId[]>(
    [],
  );
  const hasHydratedEditRef = useRef(false);
  const [isEditHydrating, setIsEditHydrating] = useState(
    usesPrefilledQuotation,
  );
  const [startGateComplete, setStartGateComplete] = useState(
    usesPrefilledQuotation,
  );

  const quotationSchema = useMemo(
    () => createQuotationFormSchema({ enforceFreshCoverPeriod: !usesPrefilledQuotation }),
    [usesPrefilledQuotation],
  );
  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationSchema as any) as any,
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
  const watchedFleetItems = useWatch({
    control: form.control,
    name: 'fleet.items',
  });
  const quotationContext =
    (isEditMode ? existingQuotation : null) ??
    (isEndorsementMode ? sourceQuotation : null);
  const savedCategoryId =
    quotationContext?.internal_quotation.category_id ?? '';
  const savedProductId = quotationContext?.internal_quotation.product_id ?? '';
  const savedBranchId = quotationContext?.internal_quotation.branch_id ?? '';
  const savedSalePointCode =
    quotationContext?.cover_note_dtl.sale_point_code ??
    quotationContext?.cover_note_dtl.fleet_hdr?.sale_point_code ??
    '';
  const quotationFlowForQueries =
    quotationContext
      ? quotationContext.internal_quotation.quotation_flow
      : quotationFlow;

  const { loadDraft, saveDraft, clearDraft } = useQuotationWizardDraft(
    isEditMode ? id ?? null : null,
    isEndorsementMode && sourceId ? `endorsement:${sourceId}` : 'new',
  );
  const businessLine =
    quotationFlowForQueries === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';
  const { data: categoryOptions = [] } = useQuotationCategories(businessLine);
  const effectiveCategoryId =
    categoryId ||
    (usesPrefilledQuotation ? savedCategoryId || undefined : undefined);
  const { data: productOptions = [] } = useQuotationProducts({
    category_id: effectiveCategoryId,
    business_line: businessLine,
    supports_fleet:
      quotationFlowForQueries === 'MOTOR_FLEET' ? true : undefined,
  });
  const { data: branchOptions = [] } = useQuotationBranches();
  const { data: riskOptions = [] } = useQuotationRisks(
    productId || (usesPrefilledQuotation ? savedProductId || undefined : undefined),
  );
  const { data: activeSalePoints = [] } = useQuotationSalePoints(
    branchId || (usesPrefilledQuotation ? savedBranchId || undefined : undefined),
  );
  const { data: vehicleOptions = [] } = useQuotationVehicles(
    policyholderMode === 'existing' ? customerId : undefined,
  );
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation(id);
  const [isSubmittingToTiramis, setIsSubmittingToTiramis] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);

  const steps = useMemo(
    () => getWizardStepsForFlow(quotationFlowForQueries),
    [quotationFlowForQueries],
  );
  const salePointRequired = activeSalePoints.length > 1;
  const editOptionsReady =
    !usesPrefilledQuotation ||
    !quotationContext ||
    (categoryOptions.some((option) => option.id === savedCategoryId) &&
      productOptions.some((option) => option.id === savedProductId) &&
      branchOptions.some((option) => option.id === savedBranchId) &&
      (savedSalePointCode
        ? activeSalePoints.some(
            (salePoint) => salePoint.salePointCode === savedSalePointCode,
          )
        : true));

  useEffect(() => {
    if (companyId) {
      form.setValue('insurer_company_id', companyId);
    }
  }, [companyId, form]);

  useEffect(() => {
    if (isEditMode || isEndorsementMode || !companyId) return;
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
  }, [companyId, form, isEditMode, isEndorsementMode, loadDraft]);

  useEffect(() => {
    if (!isEndorsementMode || isEditMode || !companyId) return;
    const draft = loadDraft();
    if (draft) {
      form.reset({
        ...DEFAULT_VALUES,
        ...draft,
        insurer_company_id: companyId,
      });
    }
  }, [companyId, form, isEditMode, isEndorsementMode, loadDraft]);

  useEffect(() => {
    if (
      !quotationContext ||
      hasHydratedEditRef.current ||
      !editOptionsReady
    ) {
      return;
    }

    const matchedSalePoint = savedSalePointCode
      ? activeSalePoints.find(
          (salePoint) => salePoint.salePointCode === savedSalePointCode,
        )
      : undefined;

    form.reset({
      ...DEFAULT_VALUES,
      ...quotationRecordToFormValues(quotationContext),
      status: isEndorsementMode ? 'DRAFT' : quotationContext.status,
      cover_note_type: isEndorsementMode
        ? '3'
        : (quotationContext.cover_note_hdr.cover_note_type?.toString() as
            | '1'
            | '2'
            | '3'),
      prev_cover_note_reference: isEndorsementMode
        ? quotationContext.cover_note_dtl.cover_note_number ??
          quotationContext.quotation_no
        : quotationContext.cover_note_dtl.prev_cover_note_reference_number ?? '',
      endorsement_type: isEndorsementMode
        ? ''
        : (quotationContext.cover_note_dtl.endorsement_type != null
            ? String(quotationContext.cover_note_dtl.endorsement_type)
            : '') as '1' | '2' | '3' | '4' | '',
      endorsement_reason: isEndorsementMode
        ? ''
        : quotationContext.cover_note_dtl.endorsement_reason ?? '',
      endorsement_premium_earned: isEndorsementMode
        ? ''
        : quotationContext.cover_note_dtl.endorsement_premium_earned != null
          ? String(quotationContext.cover_note_dtl.endorsement_premium_earned)
          : '',
      sale_point_id: matchedSalePoint?.id ?? '',
      insurer_company_id: quotationContext.internal_quotation.insurer_company_id,
    });
    hasHydratedEditRef.current = true;
    setIsEditHydrating(false);
  }, [
    activeSalePoints,
    branchOptions,
    categoryOptions,
    editOptionsReady,
    isEndorsementMode,
    quotationContext,
    form,
    productOptions,
    savedBranchId,
    savedCategoryId,
    savedProductId,
    savedSalePointCode,
  ]);

  useEffect(() => {
    if (!isEditMode || !quotationContext) {
      return;
    }

    if (EDITABLE_STATUSES.has(quotationContext.status)) {
      return;
    }

    toast.error(
      'This quotation cannot be edited in its current status. Please create an endorsement or renewal where required.',
    );
    navigate(underwritingPaths.quotationDetail(quotationContext.id), {
      replace: true,
    });
  }, [isEditMode, navigate, quotationContext]);

  useEffect(() => {
    if (!isEndorsementMode || !sourceQuotation || !sourceId) {
      return;
    }

    if (sourceQuotation.status !== 'COMPLETED') {
      toast.error(
        'Endorsements are only available after the quotation has been completed by TIRAMIS.',
      );
      navigate(underwritingPaths.quotationDetail(sourceId), { replace: true });
    }
  }, [isEndorsementMode, navigate, sourceId, sourceQuotation]);

  useEffect(() => {
    if (!steps.some((step) => step.id === stepId)) {
      setStepId(steps[0]?.id ?? 'cover-note');
    }
  }, [stepId, steps]);

  useEffect(() => {
    form.setValue(
      'quotation_type',
      quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
    );
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
      setLastDraftSavedAt(new Date());
    });
    return () => subscription.unsubscribe();
  }, [form, isEditMode, saveDraft]);

  useEffect(() => {
    const totals =
      quotationFlow === 'MOTOR_FLEET'
        ? aggregateFleetRiskTotals(
            (watchedFleetItems ?? []) as QuotationFormSchemaValues['fleet']['items'],
          )
        : aggregateRiskTotals(
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
  }, [form, quotationFlow, watchedFleetItems, watchedRisks]);

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
        const match = riskOptions.find(
          (option) => option.risk_code === risk.risk_code,
        );
        if (match?.id) {
          form.setValue(`risks.${index}.risk_id`, match.id);
        }
      }
    });
  }, [form, riskOptions]);

  useEffect(() => {
    const fleetItems = form.getValues('fleet.items');

    fleetItems.forEach((item, itemIndex) => {
      item.risks_covered.forEach((risk, riskIndex) => {
        if (!risk.risk_code && risk.risk_id) {
          const match = riskOptions.find((option) => option.id === risk.risk_id);
          if (match?.risk_code) {
            form.setValue(
              `fleet.items.${itemIndex}.risks_covered.${riskIndex}.risk_code`,
              match.risk_code,
            );
          }
        }

        if (!risk.risk_id && risk.risk_code) {
          const match = riskOptions.find(
            (option) => option.risk_code === risk.risk_code,
          );
          if (match?.id) {
            form.setValue(
              `fleet.items.${itemIndex}.risks_covered.${riskIndex}.risk_id`,
              match.id,
            );
          }
        }
      });
    });
  }, [form, riskOptions]);

  const goToStep = useCallback(
    async (nextStep: QuotationWizardStepId) => {
      const currentIndex = steps.findIndex((step) => step.id === stepId);
      const nextIndex = steps.findIndex((step) => step.id === nextStep);
      if (nextIndex < 0 || (nextIndex > currentIndex + 1 && !completedSteps.includes(nextStep))) return;
      const fields = STEP_FIELDS[stepId];
      if (nextIndex > currentIndex && fields?.length) {
        const valid = await form.trigger(fields, { shouldFocus: true });
        if (!valid) {
          toast.error(
            findFirstErrorMessage(form.formState.errors) ??
              'Please fix the highlighted fields before continuing.',
          );
          return;
        }
      }

      setCompletedSteps((previous) =>
        previous.includes(stepId) ? previous : [...previous, stepId],
      );
      setStepId(nextStep);
    },
    [form, stepId],
  );

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

  const handleStartGateProceed = useCallback(
    (selection: QuotationStartSelection) => {
      form.setValue('quotation_flow', selection.quotation_flow);
      form.setValue('quotation_type', selection.quotation_type);
      form.setValue('is_fleet', selection.is_fleet);
      form.setValue('category_id', selection.category_id);
      form.setValue('product_id', selection.product_id);
      form.setValue('channel_type', selection.channel_type);
      form.setValue('currency', selection.currency);
      form.setValue('cover_note_type', selection.cover_note_type);
      if (selection.intermediary_company_id !== undefined) {
        form.setValue('intermediary_company_id', selection.intermediary_company_id);
      }
      if (selection.quotation_flow !== 'MOTOR_FLEET' && selection.valid_from && selection.valid_until) {
        form.setValue('valid_from', selection.valid_from);
        form.setValue('valid_until', selection.valid_until);
      }
      setStartGateComplete(true);
    },
    [form],
  );

  const handleStartGateClose = useCallback(() => {
    navigate(underwritingPaths.quotations);
  }, [navigate]);

  const [changeSetupInitial, setChangeSetupInitial] =
    useState<QuotationStartSelection | null>(null);

  const openChangeSetup = useCallback(() => {
    const values = form.getValues();
    setChangeSetupInitial({
      quotation_flow: values.quotation_flow,
      quotation_type: values.quotation_type,
      is_fleet: values.is_fleet,
      category_id: values.category_id,
      product_id: values.product_id,
      channel_type: values.channel_type,
      currency: values.currency,
      cover_note_type: values.cover_note_type,
      intermediary_company_id: values.intermediary_company_id,
      valid_from:
        values.quotation_flow !== 'MOTOR_FLEET' ? values.valid_from : undefined,
      valid_until:
        values.quotation_flow !== 'MOTOR_FLEET' ? values.valid_until : undefined,
    });
  }, [form]);

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
    if (!window.confirm('Remove this fleet vehicle from the quotation?'))
      return;
    fleetFieldArray.remove(index);
    const remaining = form.getValues('fleet.items');
    remaining.forEach((_, itemIndex) => {
      form.setValue(
        `fleet.items.${itemIndex}.fleet_entry`,
        String(itemIndex + 1),
      );
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

  const persistQuotation = useCallback(
    async (options?: { submitAfterSave?: boolean }) => {
      const valid = await form.trigger(undefined, { shouldFocus: true });
      if (!valid) {
        toast.error(
          findFirstErrorMessage(form.formState.errors) ??
            'Please complete the required quotation fields.',
        );
        return;
      }

      const values = form.getValues();
      const salePoint = activeSalePoints.find(
        (item) => item.id === values.sale_point_id,
      );
      const product = productOptions.find(
        (item) => item.id === values.product_id,
      );
      const existingCustomer = customerOptions.find(
        (item) => item.id === values.customer_id,
      );
      const salePointCode = salePoint?.salePointCode;
      const productCode =
        product?.tiramis_product_code || product?.product_code || product?.id;

      if (!salePointCode) {
        toast.error('Select a valid sale point before saving this quotation.');
        return;
      }

      if (!productCode) {
        toast.error('Select a valid product before saving this quotation.');
        return;
      }

      const mutation = isEditMode ? updateMutation : createMutation;
      try {
        const quotation = await mutation.mutateAsync({
          values,
          salePointCode,
          productCode,
          existingCustomer,
          expectedUpdatedAt: isEditMode ? existingQuotation?.updated_at : undefined,
        });

        clearDraft();
        setLastDraftSavedAt(null);

        if (options?.submitAfterSave) {
          setIsSubmittingToTiramis(true);
          try {
            const submission = await quotationsApi.submit(quotation.id);
            toast.success('Quotation submitted to TIRAMIS');
            const submissionDetailId = getSubmissionDetailId(
              submission.submission,
            );
            if (submissionDetailId) {
              navigate(underwritingPaths.submissionDetail(submissionDetailId));
              return;
            }

            toast.error(
              'Quotation was submitted, but the submission detail link was missing.',
            );
            navigate(underwritingPaths.quotationDetail(quotation.id));
            return;
          } catch (submitError) {
            toast.error(getApiErrorMessage(submitError));
            navigate(underwritingPaths.quotationDetail(quotation.id));
            return;
          } finally {
            setIsSubmittingToTiramis(false);
          }
        }

        navigate(underwritingPaths.quotationDetail(quotation.id));
      } catch {
        // Mutation hooks already surface the error toast.
      }
    },
    [
      activeSalePoints,
      clearDraft,
      createMutation,
      customerOptions,
      form,
      isEditMode,
      navigate,
      productOptions,
      updateMutation,
    ],
  );

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    isSubmittingToTiramis;
  const isFirstStep = steps[0]?.id === stepId;
  const isLastStep = steps[steps.length - 1]?.id === stepId;
  const errorSteps = steps
    .filter((step) =>
      (STEP_FIELDS[step.id] ?? []).some((field) =>
        form.getFieldState(field).invalid,
      ),
    )
    .map((step) => step.id);

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
              onClick={() => void persistQuotation()}
              disabled={isSaving || !companyId}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            {isLastStep ? (
              <Button
                type="button"
                onClick={() => { if (window.confirm('Review complete? This will save the quotation and submit it to TIRAMIS.')) void persistQuotation({ submitAfterSave: true }); }}
                disabled={isSaving || !companyId}
              >
                {isSaving ? 'Submitting...' : 'Save & Submit to TIRAMIS'}
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

  if (isEndorsementMode && loadingSourceQuotation) {
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

  if (isEndorsementMode && sourceQuotationError) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>
          Could not load the quotation for endorsement:{' '}
          {String(sourceQuotationError)}
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          Back to Quotations
        </Button>
      </div>
    );
  }

  if (!usesPrefilledQuotation && !startGateComplete) {
    return (
      <QuotationStartModal
        open
        onProceed={handleStartGateProceed}
        onClose={handleStartGateClose}
      />
    );
  }

  return (
    <div className="pb-8">
      <QuotationStartModal
        open={changeSetupInitial !== null}
        initialSelection={changeSetupInitial}
        onProceed={(selection) => {
          handleStartGateProceed(selection);
          setChangeSetupInitial(null);
        }}
        onClose={() => setChangeSetupInitial(null)}
      />
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
        {!isEditMode && !isEndorsementMode && isFirstStep ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={openChangeSetup}>
              Change quotation setup
            </Button>
          </div>
        ) : null}

        {isEndorsementMode && sourceQuotation ? (
          <section className="rounded-[28px] border border-cyan-200/80 bg-[linear-gradient(135deg,_#ecfeff,_#f0fdfa_55%,_#ffffff)] p-5 shadow-[0_18px_45px_-32px_rgba(8,145,178,0.7)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-800">
              Endorsement mode
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Starting from quotation {sourceQuotation.quotation_no}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-950/80">
              The original flow, customer, product, and vehicle details were
              carried into this endorsement so you can focus on the actual
              change instead of rebuilding the quotation from scratch.
            </p>
            <p className="mt-3 text-sm font-medium text-cyan-900">
              Previous cover note:{' '}
              {sourceQuotation.cover_note_dtl.cover_note_number ??
                sourceQuotation.quotation_no}
            </p>
          </section>
        ) : null}

        <div className="rounded-[5px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <QuotationJourneyProgress
            steps={steps}
            currentStep={stepId}
            completedSteps={completedSteps}
            errorSteps={errorSteps}
            onStepClick={(nextStep) =>
              void goToStep(nextStep as QuotationWizardStepId)
            }
          />

          <div className="mt-3 border-t border-slate-100 pt-4 sm:mt-4">
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={(event) => event.preventDefault()}
              >
                {stepId === 'cover-note' && (
                  <CoverNoteSetupStep
                    form={form}
                    categoryOptions={categoryOptions}
                    productOptions={productOptions}
                    branchOptions={branchOptions}
                    salePointOptions={activeSalePoints}
                    salePointRequired={salePointRequired}
                    isHydrating={isEditHydrating}
                    showFlowSelector={false}
                    isEndorsementMode={isEndorsementMode}
                    enforceFreshCoverPeriod={!usesPrefilledQuotation}
                    title={
                      isEndorsementMode
                        ? 'Step 1. Endorsement Details'
                        : 'Step 1. Cover Note Setup'
                    }
                  />
                )}

                {stepId === 'fleet-setup' && (
                  <FleetSetupStep
                    form={form}
                    categoryOptions={categoryOptions}
                    productOptions={productOptions}
                    branchOptions={branchOptions}
                    salePointOptions={activeSalePoints}
                    salePointRequired={salePointRequired}
                    isHydrating={isEditHydrating}
                  />
                )}

                {stepId === 'policyholder' && (
                  <PolicyholderStep
                    form={form}
                    customerOptions={customerOptions}
                  />
                )}

                {stepId === 'risk-premium' && (
                  <RiskPremiumStep
                    form={form}
                    riskOptions={riskOptions}
                    fieldArray={riskFieldArray}
                    flow={quotationFlow}
                    subjectMatterFieldArray={nonMotorFieldArray}
                    onRemoveRisk={removeRisk}
                    onAddRisk={addRisk}
                  />
                )}

                {stepId === 'addons' && (
                  <AddOnsStep form={form} fieldArray={addonFieldArray} />
                )}

                {stepId === 'motor' && (
                  <MotorDetailsStep
                    form={form}
                    vehicleOptions={vehicleOptions}
                  />
                )}

                {stepId === 'fleet-vehicles' && (
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
        </div>
      </div>
    </div>
  );
}
