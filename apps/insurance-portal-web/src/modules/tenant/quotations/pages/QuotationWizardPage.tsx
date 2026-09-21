import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
  type FieldPath,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageFooter } from '@/components/layout/PageFooterSlot';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
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
  useCreateQuotationDraft,
  useDeleteQuotationDraft,
  useFinalizeQuotation,
  useQuotationCategories,
  useQuotationCurrentCompanyId,
  useQuotationCustomers,
  useQuotationEditDetail,
  useQuotationProducts,
  useQuotationRisks,
  useQuotationVehicles,
  useUpdateQuotationDraft,
} from '../hooks';
import { QuotationJourneyProgress } from '../wizard/QuotationJourneyProgress';
import { AccordionStepSection } from '../wizard/components/AccordionStepSection';
import {
  QuotationStartModal,
  type QuotationStartSelection,
} from '../wizard/QuotationStartModal';
import { quotationTotals } from '../wizard/utils/quotationTotals';
import { WizardInput } from '../wizard/components/WizardInput';
import { quotationPricingIssues } from '../wizard/utils/quotationReadiness';
import { useQuotationWizardDraft } from '../wizard/useQuotationWizardDraft';
import {
  computeCoverNoteDateRange,
  dateOnlyPart,
} from '../wizard/utils/coverNoteDateRange';
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
import { useSubjectMatterOptions } from '@/modules/tenant/non-motor/hooks';
import { AddOnsStep } from '../wizard/steps/AddOnsStep';
import { MotorDetailsStep } from '../wizard/steps/MotorDetailsStep';
import { MotorFleetDetailsStep } from '../wizard/steps/MotorFleetDetailsStep';
import type { FleetCsvRow } from '../wizard/utils/fleetCsvImport';
import { SummaryReviewStep } from '../wizard/steps/SummaryReviewStep';
import { FleetSetupStep } from '../wizard/steps/FleetSetupStep';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'REJECTED',
  'FAILED',
]);

const COVER_FIELDS: FieldPath<QuotationFormSchemaValues>[] = [
  'category_id',
  'product_id',
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
];
const STEP_FIELDS: Partial<
  Record<QuotationWizardStepId, FieldPath<QuotationFormSchemaValues>[]>
> = {
  motor: [...COVER_FIELDS, 'motor', 'risks', 'addons'],
  'risk-premium': [...COVER_FIELDS, 'risks', 'nonMotor', 'addons'],
  'fleet-setup': [
    ...COVER_FIELDS.filter(
      (field) => field !== 'cover_note_desc' && field !== 'operative_clause',
    ),
    'fleet.header',
    'customer_id',
    'policyholder',
  ],
  'fleet-vehicles': ['fleet.items'],
  summary: ['customer_id', 'policyholder'],
};
function normalizeWizardStepForFlow(
  step: string | null | undefined,
  availableSteps: { id: QuotationWizardStepId }[],
): QuotationWizardStepId | null {
  if (!step) return null;
  const direct = availableSteps.find((candidate) => candidate.id === step);
  if (direct) return direct.id;

  const first = availableSteps[0]?.id ?? 'motor';
  const legacyStepMap: Partial<
    Record<QuotationWizardStepId, QuotationWizardStepId>
  > = {
    'cover-note': first,
    policyholder: first === 'fleet-setup' ? 'fleet-setup' : 'summary',
    addons: first === 'fleet-setup' ? 'fleet-vehicles' : first,
    'risk-premium': first,
  };
  const mapped = legacyStepMap[step as QuotationWizardStepId];
  return mapped && availableSteps.some((candidate) => candidate.id === mapped)
    ? mapped
    : null;
}

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
  quotation_flow: 'MOTOR_SINGLE',
  quotation_type: 'MOTOR',
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
  valid_from: '',
  valid_until: '',
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
  motor_mode: 'new',
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
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const [draftId, setDraftId] = useState<string | null>(id ?? null);
  const usesPrefilledQuotation = isEditMode;
  const defaultSalePointCode = useAuthStore(
    (state) => state.user?.defaultSalePointCode ?? '',
  );
  const companyId = useQuotationCurrentCompanyId();
  const {
    data: existingQuotation,
    isLoading: loadingQuotation,
    error,
  } = useQuotationEditDetail(id);
  const { data: customerOptions = [] } = useQuotationCustomers();
  const [selectedStepId, setSelectedStepId] =
    useState<QuotationWizardStepId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<QuotationWizardStepId[]>(
    [],
  );
  const wizardRef = useRef<HTMLDivElement>(null);
  const hasHydratedEditRef = useRef(false);
  const [isEditHydrating, setIsEditHydrating] = useState(
    usesPrefilledQuotation,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(!isEditMode);
  const [hasCompletedStartSetup, setHasCompletedStartSetup] =
    useState(isEditMode);
  const activeDraftId = id ?? draftId;
  const hasPersistedDraft = Boolean(activeDraftId);

  const quotationSchema = useMemo(
    () =>
      createQuotationFormSchema({
        enforceFreshCoverPeriod: !usesPrefilledQuotation,
      }),
    [usesPrefilledQuotation],
  );
  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(
      quotationSchema as unknown as Parameters<typeof zodResolver>[0],
    ) as unknown as Resolver<QuotationFormSchemaValues>,
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

  const quotationFlow = useWatch({
    control: form.control,
    name: 'quotation_flow',
  });

  const productId = useWatch({
    control: form.control,
    name: 'product_id',
  });
  const categoryId = useWatch({
    control: form.control,
    name: 'category_id',
  });
  const channelType = useWatch({
    control: form.control,
    name: 'channel_type',
  });
  const currency = useWatch({
    control: form.control,
    name: 'currency',
  });
  const validFrom = useWatch({
    control: form.control,
    name: 'valid_from',
  });
  const validUntil = useWatch({
    control: form.control,
    name: 'valid_until',
  });
  const customerId = useWatch({
    control: form.control,
    name: 'customer_id',
  });
  const policyholderMode = useWatch({
    control: form.control,
    name: 'policyholder_mode',
  });
  const policyholderCustomerType = useWatch({
    control: form.control,
    name: 'policyholder.customer_type',
  });
  const policyholderFullName = useWatch({
    control: form.control,
    name: 'policyholder.full_name',
  });
  const motorRegistration = useWatch({
    control: form.control,
    name: 'motor.registration_no',
  });
  const motorMake = useWatch({ control: form.control, name: 'motor.make' });
  const motorModel = useWatch({ control: form.control, name: 'motor.model' });
  const watchedAddons = useWatch({ control: form.control, name: 'addons' });
  const watchedRisks = useWatch({
    control: form.control,
    name: 'risks',
  });
  const watchedFleetItems = useWatch({
    control: form.control,
    name: 'fleet.items',
  });
  const quotationContext = isEditMode ? existingQuotation : null;
  const savedCategoryId =
    quotationContext?.internal_quotation.category_id ?? '';
  const savedProductId = quotationContext?.internal_quotation.product_id ?? '';
  const savedSalePointCode =
    quotationContext?.cover_note_dtl.sale_point_code ??
    quotationContext?.cover_note_dtl.fleet_hdr?.sale_point_code ??
    '';
  const quotationFlowForQueries = quotationContext
    ? quotationContext.internal_quotation.quotation_flow
    : quotationFlow;

  const businessLine =
    quotationFlowForQueries === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';
  const { data: categoryOptions = [] } = useQuotationCategories(businessLine);
  const { data: productOptions = [] } = useQuotationProducts({
    business_line: businessLine,
    supports_fleet:
      quotationFlowForQueries === 'MOTOR_FLEET' ? true : undefined,
  });
  const { data: riskOptions = [] } = useQuotationRisks(
    productId ||
      (usesPrefilledQuotation ? savedProductId || undefined : undefined),
  );
  const { data: vehicleOptions = [] } = useQuotationVehicles(
    policyholderMode === 'existing' ? customerId : undefined,
  );
  const { data: allSubjectMatterOptions = [] } = useSubjectMatterOptions();
  const subjectMatterOptions = useMemo(
    () =>
      policyholderMode === 'existing' && customerId
        ? allSubjectMatterOptions.filter(
            (subjectMatter) => subjectMatter.customer_id === customerId,
          )
        : [],
    [allSubjectMatterOptions, policyholderMode, customerId],
  );
  const selectedCustomer = customerOptions.find(
    (item) => item.id === customerId,
  );
  const selectedPolicyHolderType =
    policyholderMode === 'existing' && selectedCustomer
      ? (selectedCustomer.policy_holder_type ??
        (selectedCustomer.customer_type === 'CORPORATE' ? 2 : 1))
      : policyholderCustomerType === 'CORPORATE'
        ? 2
        : 1;
  const salePointCode = usesPrefilledQuotation
    ? savedSalePointCode
    : defaultSalePointCode;
  const quotationFactorContext = useMemo(
    () => ({
      salePointCode,
      policyHolderType: selectedPolicyHolderType,
    }),
    [salePointCode, selectedPolicyHolderType],
  );
  const paymentMode = useWatch({
    control: form.control,
    name: 'payment_mode_tira',
  });
  const officerName = useWatch({ control: form.control, name: 'officer_name' });
  const officerTitle = useWatch({
    control: form.control,
    name: 'officer_title',
  });
  useEffect(() => {
    const context = {
      policy_holder_type:
        selectedPolicyHolderType === 2 ? 'Corporate' : 'Individual',
      sale_point_code: salePointCode,
      payment_mode: { '1': 'Cash', '2': 'Cheque', '3': 'EFT' }[paymentMode],
      officer_name: officerName,
      officer_title: officerTitle,
    };
    const update = (
      prefix:
        | `risks.${number}`
        | `fleet.items.${number}.risks_covered.${number}`,
    ) => {
      const current = form.getValues(`${prefix}.factor_values`);
      if (
        Object.entries(context).some(([key, value]) => current[key] !== value)
      )
        form.setValue(`${prefix}.factor_values`, { ...current, ...context });
    };
    if (quotationFlow === 'MOTOR_FLEET')
      (watchedFleetItems ?? []).forEach((item, index) =>
        item.risks_covered.forEach((_, riskIndex) =>
          update(`fleet.items.${index}.risks_covered.${riskIndex}`),
        ),
      );
    else (watchedRisks ?? []).forEach((_, index) => update(`risks.${index}`));
  }, [
    form,
    quotationFlow,
    watchedRisks,
    watchedFleetItems,
    selectedPolicyHolderType,
    salePointCode,
    paymentMode,
    officerName,
    officerTitle,
  ]);
  const createDraftMutation = useCreateQuotationDraft();
  const updateDraftMutation = useUpdateQuotationDraft();
  const finalizeMutation = useFinalizeQuotation();
  const deleteDraftMutation = useDeleteQuotationDraft();

  const steps = useMemo(
    () => getWizardStepsForFlow(quotationFlowForQueries),
    [quotationFlowForQueries],
  );
  const hydratedStepId = normalizeWizardStepForFlow(
    quotationContext?.current_wizard_step,
    steps,
  );
  const stepId =
    selectedStepId && steps.some((step) => step.id === selectedStepId)
      ? selectedStepId
      : (hydratedStepId ?? steps[0]?.id ?? 'cover-note');

  useLayoutEffect(() => {
    wizardRef.current?.closest('main')?.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, [stepId, loadingQuotation]);

  const editOptionsReady =
    !usesPrefilledQuotation ||
    !quotationContext ||
    (categoryOptions.some((option) => option.id === savedCategoryId) &&
      productOptions.some((option) => option.id === savedProductId));

  useEffect(() => {
    if (companyId) {
      form.setValue('insurer_company_id', companyId);
    }
  }, [companyId, form]);

  const draftScope = useAuthStore(
    (state) =>
      (state.user?.id ?? '') +
      ':' +
      (state.company?.id ?? state.user?.companyId ?? ''),
  );
  const { loadDraft, saveDraft, clearDraft } = useQuotationWizardDraft(
    activeDraftId,
    draftScope,
  );
  const startModalInitialSelection = useMemo<QuotationStartSelection | null>(
    () =>
      categoryId || productId
        ? {
            quotation_flow: quotationFlow,
            quotation_type:
              quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
            is_fleet: quotationFlow === 'MOTOR_FLEET',
            category_id: categoryId,
            product_id: productId,
            channel_type: channelType,
            currency,
            cover_note_type: form.getValues('cover_note_type'),
            intermediary_company_id: form.getValues('intermediary_company_id'),
            valid_from: validFrom,
            valid_until: validUntil,
          }
        : null,
    [
      categoryId,
      channelType,
      currency,
      form,
      productId,
      quotationFlow,
      validFrom,
      validUntil,
    ],
  );
  const handleStartProceed = useCallback(
    (selection: QuotationStartSelection) => {
      form.setValue('quotation_flow', selection.quotation_flow, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('quotation_type', selection.quotation_type, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('is_fleet', selection.is_fleet, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('category_id', selection.category_id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('product_id', selection.product_id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('channel_type', selection.channel_type, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue(
        'intermediary_company_id',
        selection.intermediary_company_id ?? '',
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
      form.setValue('currency', selection.currency, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (selection.currency === 'TZS') {
        form.setValue('exchange_rate', '1', {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      form.setValue('cover_note_type', selection.cover_note_type, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (selection.valid_from) {
        form.setValue('valid_from', selection.valid_from, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (selection.valid_until) {
        form.setValue('valid_until', selection.valid_until, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setSelectedStepId(null);
      setCompletedSteps([]);
      setHasCompletedStartSetup(true);
      setIsStartModalOpen(false);
    },
    [form],
  );
  const initializedRef = useRef(false);
  useEffect(() => {
    if (isEditMode || !companyId || initializedRef.current) return;
    initializedRef.current = true;
    const dates = computeCoverNoteDateRange(365);
    form.reset({
      ...DEFAULT_VALUES,
      valid_from: dateOnlyPart(dates.validFrom),
      valid_until: dateOnlyPart(dates.validUntil),
      ...loadDraft(),
      insurer_company_id: companyId,
    });
  }, [companyId, form, isEditMode, loadDraft]);
  useEffect(() => {
    if (activeDraftId || !hasCompletedStartSetup) return;
    // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Form's subscription API is the intended low-cost way to persist the draft on any field change.
    const subscription = form.watch(() => {
      if (initializedRef.current) saveDraft(form.getValues());
    });
    return () => subscription.unsubscribe();
  }, [activeDraftId, form, hasCompletedStartSetup, saveDraft]);

  useEffect(() => {
    if (!quotationContext || hasHydratedEditRef.current || !editOptionsReady) {
      return;
    }

    const draftSnapshot =
      quotationContext.draft_payload &&
      typeof quotationContext.draft_payload === 'object'
        ? (quotationContext.draft_payload as Partial<QuotationFormSchemaValues>)
        : null;

    form.reset({
      ...DEFAULT_VALUES,
      ...quotationRecordToFormValues(quotationContext),
      ...(draftSnapshot ?? {}),
      status: quotationContext.status,
      cover_note_type:
        quotationContext.cover_note_hdr.cover_note_type?.toString() as
          | '1'
          | '2'
          | '3',
      prev_cover_note_reference:
        quotationContext.cover_note_dtl.prev_cover_note_reference_number ?? '',
      endorsement_type: (quotationContext.cover_note_dtl.endorsement_type !=
      null
        ? String(quotationContext.cover_note_dtl.endorsement_type)
        : '') as '1' | '2' | '3' | '4' | '',
      endorsement_reason:
        quotationContext.cover_note_dtl.endorsement_reason ?? '',
      endorsement_premium_earned:
        quotationContext.cover_note_dtl.endorsement_premium_earned != null
          ? String(quotationContext.cover_note_dtl.endorsement_premium_earned)
          : '',
      insurer_company_id:
        quotationContext.internal_quotation.insurer_company_id,
    });
    const restoredStep = normalizeWizardStepForFlow(
      quotationContext.current_wizard_step,
      steps,
    );
    hasHydratedEditRef.current = true;
    queueMicrotask(() => {
      if (restoredStep) {
        setSelectedStepId(restoredStep);
      }
      setIsEditHydrating(false);
    });
  }, [
    categoryOptions,
    editOptionsReady,
    quotationContext,
    form,
    productOptions,
    savedCategoryId,
    savedProductId,
    savedSalePointCode,
    steps,
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
    const totals =
      quotationFlow === 'MOTOR_FLEET'
        ? aggregateFleetRiskTotals(watchedFleetItems ?? [])
        : aggregateRiskTotals(watchedRisks ?? []);
    // Compared numerically, not as raw strings: aggregateRiskTotals()/
    // aggregateFleetRiskTotals() format amounts differently than whatever
    // already sits in these top-level fields (e.g. "100000.0000" vs
    // "100000"), so a strict string compare here treated an unchanged total
    // as "changed" on every render and re-set it forever, which crashed the
    // wizard with "Maximum update depth exceeded" right after computing a
    // risk's premium (see also the matching fix in RiskRow.tsx).
    const current = form.getValues();
    const completeTotals = quotationTotals(current);
    totals.basic_premium = String(completeTotals.premium);
    totals.total_premium = String(completeTotals.total);
    totals.net_premium = String(completeTotals.total);
    totals.total_tax = String(completeTotals.tax);
    if (Number(current.sum_insured) !== Number(totals.sum_insured)) {
      form.setValue('sum_insured', totals.sum_insured);
    }
    if (Number(current.basic_premium) !== Number(totals.basic_premium)) {
      form.setValue('basic_premium', totals.basic_premium);
    }
    if (Number(current.total_discount) !== Number(totals.total_discount)) {
      form.setValue('total_discount', totals.total_discount);
    }
    if (Number(current.total_tax) !== Number(totals.total_tax)) {
      form.setValue('total_tax', totals.total_tax);
    }
    if (Number(current.total_charges) !== Number(totals.total_charges)) {
      form.setValue('total_charges', totals.total_charges);
    }
    if (Number(current.total_commission) !== Number(totals.total_commission)) {
      form.setValue('total_commission', totals.total_commission);
    }
    if (Number(current.total_premium) !== Number(totals.total_premium)) {
      form.setValue('total_premium', totals.total_premium);
    }
    if (Number(current.net_premium) !== Number(totals.net_premium)) {
      form.setValue('net_premium', totals.net_premium);
    }
  }, [form, quotationFlow, watchedFleetItems, watchedRisks, watchedAddons]);

  useEffect(() => {
    const risks = form.getValues('risks');
    risks.forEach((risk, index) => {
      if (!risk.risk_id && !risk.risk_code && riskOptions.length === 1) {
        form.setValue(`risks.${index}.risk_id`, riskOptions[0].id);
        form.setValue(`risks.${index}.risk_code`, riskOptions[0].risk_code);
      }
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
        const common = form.getValues('risks.0');
        const selected =
          riskOptions.find((option) => option.id === common.risk_id) ??
          (riskOptions.length === 1 ? riskOptions[0] : undefined);
        if (!risk.risk_id && !risk.risk_code && selected) {
          form.setValue(
            `fleet.items.${itemIndex}.risks_covered.${riskIndex}.risk_id`,
            selected.id,
          );
          form.setValue(
            `fleet.items.${itemIndex}.risks_covered.${riskIndex}.risk_code`,
            selected.risk_code,
          );
          if (!risk.sum_insured && common.sum_insured)
            form.setValue(
              `fleet.items.${itemIndex}.risks_covered.${riskIndex}.sum_insured`,
              common.sum_insured,
            );
        }
        if (!risk.risk_code && risk.risk_id) {
          const match = riskOptions.find(
            (option) => option.id === risk.risk_id,
          );
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
  }, [form, riskOptions, watchedRisks, watchedFleetItems]);

  const saveDraftSnapshot = useCallback(
    async (currentWizardStep?: QuotationWizardStepId, silent = false) => {
      const values = form.getValues();

      try {
        const quotation = hasPersistedDraft
          ? await updateDraftMutation.mutateAsync({
              id: activeDraftId!,
              values,
              currentWizardStep,
              expectedUpdatedAt: existingQuotation?.updated_at,
              silent,
            })
          : await createDraftMutation.mutateAsync({
              values,
              currentWizardStep,
              silent,
            });

        setDraftId(quotation.id);
        if (!id) {
          navigate(underwritingPaths.quotationWizardEdit(quotation.id), {
            replace: true,
          });
        }

        return quotation;
      } catch {
        return null;
      }
    },
    [
      activeDraftId,
      createDraftMutation,
      existingQuotation,
      form,
      hasPersistedDraft,
      id,
      navigate,
      updateDraftMutation,
    ],
  );

  const goToStep = useCallback(
    async (nextStep: QuotationWizardStepId) => {
      const currentIndex = steps.findIndex((step) => step.id === stepId);
      const nextIndex = steps.findIndex((step) => step.id === nextStep);
      if (
        nextIndex < 0 ||
        (nextIndex > currentIndex + 1 && !completedSteps.includes(nextStep))
      )
        return;
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
      setSelectedStepId(nextStep);

      // Best-effort autosave on step transitions, once there's enough on the
      // form to be worth persisting. Failures are swallowed silently here —
      // saveDraftSnapshot already surfaces its own error toast, and losing
      // one autosave tick shouldn't block navigation.
      if (form.getValues('product_id')) {
        void saveDraftSnapshot(nextStep, true);
      }
    },
    [completedSteps, form, saveDraftSnapshot, stepId, steps],
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
      setSelectedStepId(previous.id);
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
  }

  function importFleetVehicles(rows: FleetCsvRow[]) {
    const startingEntry = fleetFieldArray.fields.length;
    const newItems = rows.map((row, rowIndex) => {
      const base = createEmptyFleetItemRow();
      const matchedRisk = riskOptions.find(
        (risk) => risk.risk_code === row.risk_code,
      );

      return {
        ...base,
        fleet_entry: String(startingEntry + rowIndex + 1),
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
    });

    fleetFieldArray.append(newItems);
  }

  const completeQuotation = useCallback(async () => {
    const valid = await form.trigger(undefined, { shouldFocus: true });
    if (!valid) {
      const invalidStep = steps.find((step) =>
        (STEP_FIELDS[step.id] ?? []).some(
          (field) => form.getFieldState(field).invalid,
        ),
      );
      if (invalidStep) setSelectedStepId(invalidStep.id);
      toast.error(
        findFirstErrorMessage(form.formState.errors) ??
          'Please complete the required quotation fields.',
      );
      return;
    }

    const values = form.getValues();
    const pricingIssues = quotationPricingIssues(values);
    if (pricingIssues.length) {
      toast.error(pricingIssues[0]);
      setSelectedStepId(
        values.quotation_flow === 'MOTOR_FLEET'
          ? 'fleet-vehicles'
          : steps[0].id,
      );
      return;
    }
    const product = productOptions.find(
      (item) => item.id === values.product_id,
    );
    const existingCustomer = customerOptions.find(
      (item) => item.id === values.customer_id,
    );
    const salePointCode = usesPrefilledQuotation
      ? savedSalePointCode
      : defaultSalePointCode;
    const productCode =
      product?.tiramis_product_code || product?.product_code || product?.id;

    if (!salePointCode) {
      toast.error('Your active branch has no default sales point configured.');
      return;
    }

    if (!productCode) {
      toast.error('Select a valid product before completing this quotation.');
      return;
    }

    let quotationId = activeDraftId;

    if (!quotationId) {
      const draft = await saveDraftSnapshot(stepId, true);
      if (!draft) {
        return;
      }
      quotationId = draft.id;
    }

    try {
      const quotation = await finalizeMutation.mutateAsync({
        id: quotationId,
        values,
        salePointCode,
        productCode,
        existingCustomer,
        expectedUpdatedAt: existingQuotation?.updated_at,
      });

      navigate(underwritingPaths.quotationDetail(quotation.id));
    } catch {
      // Mutation hooks already surface the error toast.
    }
  }, [
    activeDraftId,
    customerOptions,
    defaultSalePointCode,
    existingQuotation,
    finalizeMutation,
    form,
    navigate,
    productOptions,
    saveDraftSnapshot,
    savedSalePointCode,
    stepId,
    steps,
    usesPrefilledQuotation,
  ]);

  const deleteDraft = useCallback(() => {
    setIsDeleteDialogOpen(false);
    clearDraft();

    if (!activeDraftId) {
      navigate(underwritingPaths.quotations);
      return;
    }

    deleteDraftMutation.mutate(activeDraftId, {
      onSuccess: () => navigate(underwritingPaths.quotations),
    });
  }, [activeDraftId, clearDraft, deleteDraftMutation, navigate]);

  const isSaving =
    createDraftMutation.isPending ||
    updateDraftMutation.isPending ||
    finalizeMutation.isPending ||
    deleteDraftMutation.isPending;
  const isFirstStep = steps[0]?.id === stepId;
  const isLastStep = steps[steps.length - 1]?.id === stepId;
  const errorSteps = steps
    .filter((step) =>
      (STEP_FIELDS[step.id] ?? []).some(
        (field) => form.getFieldState(field).invalid,
      ),
    )
    .map((step) => step.id);

  const activeProduct = productOptions.find((item) => item.id === productId);
  const accordionGroups = useMemo(() => {
    const coverErrorFields: FieldPath<QuotationFormSchemaValues>[] = [
      ...COVER_FIELDS.filter(
        (fieldName) =>
          fieldName !== 'cover_note_desc' && fieldName !== 'operative_clause',
      ),
    ];
    const policyholderErrorFields: FieldPath<QuotationFormSchemaValues>[] = [
      'customer_id',
      'policyholder',
    ];
    const vehicleErrorFields: FieldPath<QuotationFormSchemaValues>[] = [
      'motor',
    ];
    const riskErrorFields: FieldPath<QuotationFormSchemaValues>[] = [
      'risks',
      'nonMotor',
      'addons',
    ];
    const coverSummary = [activeProduct?.product_name, validFrom, validUntil]
      .filter(Boolean)
      .join(' · ');
    const policyholderSummary =
      policyholderMode === 'existing'
        ? selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : undefined
        : policyholderFullName || undefined;
    const vehicleSummary = [motorRegistration, motorMake, motorModel]
      .filter(Boolean)
      .join(' · ');
    const riskSummary = `${(watchedRisks ?? []).length} risk${
      (watchedRisks ?? []).length === 1 ? '' : 's'
    }`;

    const cover = {
      id: 'cover',
      title: 'Cover & policyholder',
      summary: [coverSummary, policyholderSummary].filter(Boolean).join(' · '),
      fields: [...coverErrorFields, ...policyholderErrorFields],
    };
    const vehicle = {
      id: 'vehicle',
      title: 'Vehicle',
      summary: vehicleSummary,
      fields: vehicleErrorFields,
    };
    const risk = {
      id: 'risk',
      title: 'Risk, premium & add-ons',
      summary: riskSummary,
      fields: riskErrorFields,
    };
    const policyholderOnly = {
      id: 'policyholder',
      title: 'Policyholder',
      summary: policyholderSummary,
      fields: policyholderErrorFields,
    };
    const fleetCover = {
      id: 'cover',
      title: 'Fleet & cover',
      summary: coverSummary,
      fields: coverErrorFields,
    };

    if (quotationFlow === 'MOTOR_SINGLE') return [cover, vehicle, risk];
    if (quotationFlow === 'MOTOR_FLEET') return [fleetCover, policyholderOnly];
    return [cover, risk];
  }, [
    activeProduct,
    motorMake,
    motorModel,
    motorRegistration,
    policyholderFullName,
    policyholderMode,
    quotationFlow,
    selectedCustomer,
    validFrom,
    validUntil,
    watchedRisks,
  ]);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  useEffect(() => {
    setOpenSectionId(accordionGroups[0]?.id ?? null);
    // Only reset which section is open when the step itself changes, not on
    // every keystroke that recomputes accordionGroups' summaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);
  const toggleAccordionSection = useCallback((sectionId: string) => {
    setOpenSectionId((previous) => (previous === sectionId ? null : sectionId));
  }, []);
  const accordionGroupHasError = useCallback(
    (sectionId: string) =>
      (
        accordionGroups.find((group) => group.id === sectionId)?.fields ?? []
      ).some((fieldName) => form.getFieldState(fieldName).invalid),
    [accordionGroups, form],
  );

  const footerNode = useMemo(
    () =>
      !loadingQuotation && hasCompletedStartSetup ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isFirstStep}
            >
              Back
            </Button>
            {isSaving && (
              <span className="text-xs text-slate-500">Saving...</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || !productId}
              onClick={() => void saveDraftSnapshot(stepId)}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isSaving}
            >
              Delete Draft
            </Button>
            {isLastStep ? (
              <Button
                type="button"
                onClick={() => void completeQuotation()}
                disabled={isSaving || !companyId}
              >
                {isSaving
                  ? 'Creating...'
                  : isEditMode
                    ? 'Complete Quotation'
                    : 'Create Quotation'}
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
      completeQuotation,
      isEditMode,
      productId,
      saveDraftSnapshot,
      stepId,
      goBack,
      goNext,
      isFirstStep,
      isLastStep,
      isSaving,
      loadingQuotation,
      hasCompletedStartSetup,
    ],
  );

  usePageFooter(footerNode);

  if (loadingQuotation || (isEditMode && isEditHydrating && !error)) {
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
    <div ref={wizardRef} className="pb-8">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
        <ConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="Delete Draft Quotation"
          description="This will permanently remove the current draft quotation. This action cannot be undone."
          confirmLabel="Delete Draft"
          loading={deleteDraftMutation.isPending}
          onConfirm={deleteDraft}
        />
        <QuotationStartModal
          open={isStartModalOpen}
          initialSelection={startModalInitialSelection}
          onProceed={handleStartProceed}
          onClose={() => navigate(underwritingPaths.quotations)}
        />

        {hasCompletedStartSetup && (
          <div className="rounded-[5px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <QuotationJourneyProgress
              steps={steps}
              currentStep={stepId}
              completedSteps={completedSteps}
              errorSteps={errorSteps}
              onStepClick={(nextStep) => {
                const normalized = normalizeWizardStepForFlow(nextStep, steps);
                if (normalized) void goToStep(normalized);
              }}
            />

            <div className="mt-3 border-t border-slate-100 pt-4 sm:mt-4">
              <Form {...form}>
                <form
                  className="space-y-6"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div hidden={!isFirstStep} className="space-y-4">
                    <AccordionStepSection
                      id="cover"
                      title={
                        quotationFlow === 'MOTOR_FLEET'
                          ? 'Fleet & cover'
                          : 'Cover & policyholder'
                      }
                      summary={
                        accordionGroups.find((group) => group.id === 'cover')
                          ?.summary
                      }
                      isOpen={openSectionId === 'cover'}
                      onToggle={toggleAccordionSection}
                      hasError={accordionGroupHasError('cover')}
                    >
                      <CoverNoteSetupStep
                        form={form}
                        categoryOptions={categoryOptions}
                        productOptions={productOptions}
                        isHydrating={isEditHydrating}
                        title="Product & cover"
                        enforceFreshCoverPeriod={!usesPrefilledQuotation}
                      />
                      {quotationFlow === 'MOTOR_FLEET' ? (
                        <>
                          <FleetSetupStep
                            form={form}
                            categoryOptions={categoryOptions}
                            productOptions={productOptions}
                            isHydrating={isEditHydrating}
                            headerOnly
                          />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <WizardInput
                              form={form}
                              name="risks.0.risk_id"
                              label="Default vehicle cover"
                              options={riskOptions.map((risk) => ({
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
                        </>
                      ) : (
                        <PolicyholderStep
                          form={form}
                          customerOptions={customerOptions}
                        />
                      )}
                    </AccordionStepSection>

                    {quotationFlow === 'MOTOR_FLEET' && (
                      <AccordionStepSection
                        id="policyholder"
                        title="Policyholder"
                        summary={
                          accordionGroups.find(
                            (group) => group.id === 'policyholder',
                          )?.summary
                        }
                        isOpen={openSectionId === 'policyholder'}
                        onToggle={toggleAccordionSection}
                        hasError={accordionGroupHasError('policyholder')}
                      >
                        <PolicyholderStep
                          form={form}
                          customerOptions={customerOptions}
                        />
                      </AccordionStepSection>
                    )}

                    {quotationFlow === 'MOTOR_SINGLE' && (
                      <AccordionStepSection
                        id="vehicle"
                        title="Vehicle"
                        summary={
                          accordionGroups.find(
                            (group) => group.id === 'vehicle',
                          )?.summary
                        }
                        isOpen={openSectionId === 'vehicle'}
                        onToggle={toggleAccordionSection}
                        hasError={accordionGroupHasError('vehicle')}
                      >
                        <MotorDetailsStep
                          form={form}
                          vehicleOptions={vehicleOptions}
                        />
                      </AccordionStepSection>
                    )}
                    {quotationFlow !== 'MOTOR_FLEET' && (
                      <AccordionStepSection
                        id="risk"
                        title="Risk, premium & add-ons"
                        summary={
                          accordionGroups.find((group) => group.id === 'risk')
                            ?.summary
                        }
                        isOpen={openSectionId === 'risk'}
                        onToggle={toggleAccordionSection}
                        hasError={accordionGroupHasError('risk')}
                      >
                        <RiskPremiumStep
                          form={form}
                          riskOptions={riskOptions}
                          fieldArray={riskFieldArray}
                          flow={quotationFlow}
                          subjectMatterFieldArray={nonMotorFieldArray}
                          subjectMatterOptions={subjectMatterOptions}
                          onRemoveRisk={removeRisk}
                          onAddRisk={addRisk}
                          factorContext={quotationFactorContext}
                        />
                        <AddOnsStep form={form} fieldArray={addonFieldArray} />
                      </AccordionStepSection>
                    )}
                  </div>
                  {quotationFlow === 'MOTOR_FLEET' && (
                    <div hidden={stepId !== 'fleet-vehicles'}>
                      <MotorFleetDetailsStep
                        form={form}
                        customerOptions={customerOptions}
                        riskOptions={riskOptions}
                        vehicleOptions={vehicleOptions}
                        fieldArray={fleetFieldArray}
                        onAddVehicle={addFleetVehicle}
                        onRemoveVehicle={removeFleetVehicle}
                        onDuplicateVehicle={duplicateFleetVehicle}
                        onImportVehicles={importFleetVehicles}
                        factorContext={quotationFactorContext}
                      />
                    </div>
                  )}
                  {stepId === 'summary' && (
                    <>
                      <SummaryReviewStep
                        form={form}
                        customerOptions={customerOptions}
                        categoryOptions={categoryOptions}
                        productOptions={productOptions}
                        riskOptions={riskOptions}
                        riskCount={riskFieldArray.fields.length}
                        onEditStep={(nextStep) =>
                          setSelectedStepId(
                            normalizeWizardStepForFlow(nextStep, steps) ??
                              steps[0].id,
                          )
                        }
                      />
                    </>
                  )}
                </form>
              </Form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
