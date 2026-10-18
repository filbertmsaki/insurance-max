import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasPermission } from '@/lib/auth/permissions';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useCustomer } from '@/modules/tenant/customers/hooks';
import {
  quotationKeys,
  useQuotationCategories,
  useQuotationCurrentCompanyId,
  useQuotationProducts,
  useQuotationRisks,
  useQuotationVehicles,
} from '@/modules/tenant/quotations/hooks';
import {
  buildQuotationDraftPayload,
  buildQuotationPayload,
  createEmptyFleetItemRow,
  createQuotationFormSchema,
  quotationRecordToFormValues,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import type { QuotationDetailRecord } from '@/modules/tenant/quotations/types';
import { computeCoverNoteDateRange } from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import {
  aggregateFleetRiskTotals,
  aggregateRiskTotals,
} from '@/modules/tenant/quotations/wizard/utils/premiumAggregation';
import { quotationPricingIssues } from '@/modules/tenant/quotations/wizard/utils/quotationReadiness';
import { quotationTotals } from '@/modules/tenant/quotations/wizard/utils/quotationTotals';
import { useSubjectMatterOptions } from '@/modules/tenant/non-motor/hooks';
import { underwriteApi } from '../api';
import { underwriteKeys } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import { defaultValuesForLine } from './defaults';

/**
 * Wizard controller shared by the Motor, Fleet and Non-Motor wizards.
 *
 * It keeps the legacy quotation form contract (`QuotationFormSchemaValues`,
 * payload builders, draft/finalize semantics) so the existing step components
 * and all backend pricing/validation are reused unchanged. What differs per
 * line is only the step layout and the line-scoped endpoints it calls.
 *
 * The cross-step effects below mirror `QuotationWizardPage`; they are kept in
 * sync by hand until the legacy wizard is retired (see migration plan).
 */

const SELECT_INSURANCE_CHANNEL_PERMISSION =
  'quotations:select-insurance-channel';

const EDITABLE_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED']);

export interface UnderwriteWizardStep {
  id: string;
  label: string;
  description: string;
  /** Fields validated before leaving the step. */
  fields: FieldPath<QuotationFormSchemaValues>[];
  /**
   * Extra validation for data held outside the quotation form (e.g. the
   * Non-Motor risk schema). Return a message to block, or null to continue.
   */
  validate?: () => string | null;
}

export interface UnderwriteWizardHooks {
  /** Runs after every successful draft save (silent autosaves included). */
  afterDraftSaved?: (quotationId: string) => Promise<void>;
  /** Runs before finalize; return false to stop (it shows its own error). */
  beforeFinalize?: (quotationId: string) => Promise<boolean>;
}

export function findFirstErrorMessage(node: unknown): string | null {
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

export function useUnderwriteQuotationWizard({
  line,
  quotationId,
  steps: allSteps,
  stepAliases,
  deferDraftUntilStepId,
  hooks,
}: {
  line: UnderwriteLineMeta;
  quotationId?: string;
  steps: UnderwriteWizardStep[];
  /** Maps previously persisted step IDs to their current equivalents. */
  stepAliases?: Record<string, string>;
  /** New drafts are first persisted when moving forward from this step. */
  deferDraftUntilStepId?: string;
  hooks?: UnderwriteWizardHooks;
}) {
  // Kept in a ref so callers can pass inline callbacks without re-creating
  // the mutations on every render.
  const hooksRef = useRef(hooks);
  useEffect(() => {
    hooksRef.current = hooks;
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(quotationId);
  const [draftId, setDraftId] = useState<string | null>(quotationId ?? null);
  const activeDraftId = quotationId ?? draftId;

  const currentUser = useAuthStore((state) => state.user);
  const defaultSalePointCode = currentUser?.defaultSalePointCode ?? '';
  const canSelectInsuranceChannel = hasPermission(
    currentUser,
    SELECT_INSURANCE_CHANNEL_PERMISSION,
  );
  // The business source step only holds channel/commission inputs, so it is
  // dropped for users who can quote direct business only.
  const steps = useMemo(
    () =>
      canSelectInsuranceChannel
        ? allSteps
        : allSteps.filter((step) => step.id !== 'source'),
    [allSteps, canSelectInsuranceChannel],
  );
  const companyId = useQuotationCurrentCompanyId();

  const editQuery = useQuery({
    queryKey: [...underwriteKeys.all, line.slug, 'edit', quotationId ?? ''],
    queryFn: () => underwriteApi.getQuotationForEdit(line.slug, quotationId!),
    enabled: isEditMode,
    staleTime: 30_000,
  });
  const existingQuotation = editQuery.data;

  const defaultValues = useMemo(() => defaultValuesForLine(line), [line]);
  const schema = useMemo(
    () => createQuotationFormSchema({ enforceFreshCoverPeriod: !isEditMode }),
    [isEditMode],
  );
  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(
      schema as unknown as Parameters<typeof zodResolver>[0],
    ) as unknown as Resolver<QuotationFormSchemaValues>,
    defaultValues,
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

  const productId = useWatch({ control: form.control, name: 'product_id' });
  const customerId = useWatch({ control: form.control, name: 'customer_id' });
  const policyholderMode = useWatch({
    control: form.control,
    name: 'policyholder_mode',
  });
  const policyholderCustomerType = useWatch({
    control: form.control,
    name: 'policyholder.customer_type',
  });
  const paymentMode = useWatch({
    control: form.control,
    name: 'payment_mode_tira',
  });
  const officerName = useWatch({ control: form.control, name: 'officer_name' });
  const officerTitle = useWatch({
    control: form.control,
    name: 'officer_title',
  });
  const watchedRisks = useWatch({ control: form.control, name: 'risks' });
  const watchedAddons = useWatch({ control: form.control, name: 'addons' });
  const watchedFleetItems = useWatch({
    control: form.control,
    name: 'fleet.items',
  });

  // ─── Reference data ─────────────────────────────────────────────────────
  const businessLine = line.line === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';
  // Customers are searched on the server; only the chosen one is loaded.
  const selectedCustomerQuery = useCustomer(
    policyholderMode === 'existing' && customerId ? customerId : undefined,
  );
  const selectedCustomer =
    selectedCustomerQuery.data?.id === customerId
      ? selectedCustomerQuery.data
      : undefined;
  const customerOptions = useMemo(
    () => (selectedCustomer ? [selectedCustomer] : []),
    [selectedCustomer],
  );
  const { data: categoryOptions = [] } = useQuotationCategories(businessLine);
  const { data: productOptions = [] } = useQuotationProducts({
    business_line: businessLine,
    supports_fleet: line.line === 'FLEET' ? true : undefined,
  });
  const savedProductId = existingQuotation?.internal_quotation.product_id ?? '';
  const savedCategoryId =
    existingQuotation?.internal_quotation.category_id ?? '';
  const { data: riskOptions = [] } = useQuotationRisks(
    productId || savedProductId || undefined,
  );
  // Fleet lists the customer's saved vehicles; Motor searches the register.
  const { data: vehicleOptions = [] } = useQuotationVehicles(
    line.line === 'FLEET' && policyholderMode === 'existing'
      ? customerId
      : undefined,
  );
  const { data: allSubjectMatters = [] } = useSubjectMatterOptions(
    line.line === 'NON_MOTOR',
  );
  const subjectMatterOptions = useMemo(
    () =>
      line.line === 'NON_MOTOR' && policyholderMode === 'existing' && customerId
        ? allSubjectMatters.filter((item) => item.customer_id === customerId)
        : [],
    [allSubjectMatters, customerId, line.line, policyholderMode],
  );

  const selectedPolicyHolderType =
    policyholderMode === 'existing' && selectedCustomer
      ? (selectedCustomer.policy_holder_type ??
        (selectedCustomer.customer_type === 'CORPORATE' ? 2 : 1))
      : policyholderCustomerType === 'CORPORATE'
        ? 2
        : 1;
  const savedSalePointCode =
    existingQuotation?.cover_note_dtl.sale_point_code ??
    existingQuotation?.cover_note_dtl.fleet_hdr?.sale_point_code ??
    '';
  const salePointCode = isEditMode ? savedSalePointCode : defaultSalePointCode;
  const factorContext = useMemo(
    () => ({ salePointCode, policyHolderType: selectedPolicyHolderType }),
    [salePointCode, selectedPolicyHolderType],
  );

  // ─── Step state ─────────────────────────────────────────────────────────
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const persistedStepId = existingQuotation?.current_wizard_step;
  const aliasedStepId = persistedStepId
    ? (stepAliases?.[persistedStepId] ?? persistedStepId)
    : null;
  const restoredStepId = steps.some((step) => step.id === aliasedStepId)
    ? aliasedStepId
    : null;
  const stepId =
    selectedStepId && steps.some((step) => step.id === selectedStepId)
      ? selectedStepId
      : (restoredStepId ?? steps[0].id);
  const stepIndex = steps.findIndex((step) => step.id === stepId);

  // ─── Initialisation & hydration ─────────────────────────────────────────
  const initializedRef = useRef(false);
  const [isHydrating, setIsHydrating] = useState(isEditMode);

  useEffect(() => {
    if (companyId) form.setValue('insurer_company_id', companyId);
  }, [companyId, form]);

  useEffect(() => {
    if (isEditMode || !companyId || initializedRef.current) return;
    initializedRef.current = true;
    const dates = computeCoverNoteDateRange(365);
    form.reset({
      ...defaultValues,
      valid_from: dates.validFrom,
      valid_until: dates.validUntil,
      insurer_company_id: companyId,
    });
  }, [companyId, defaultValues, form, isEditMode]);

  const editOptionsReady =
    !existingQuotation ||
    (categoryOptions.some((option) => option.id === savedCategoryId) &&
      productOptions.some((option) => option.id === savedProductId));

  useEffect(() => {
    if (!existingQuotation || initializedRef.current || !editOptionsReady) {
      return;
    }
    initializedRef.current = true;
    const draftSnapshot =
      existingQuotation.draft_payload &&
      typeof existingQuotation.draft_payload === 'object'
        ? (existingQuotation.draft_payload as Partial<QuotationFormSchemaValues>)
        : null;

    form.reset({
      ...defaultValues,
      ...quotationRecordToFormValues(existingQuotation),
      ...(draftSnapshot ?? {}),
      // The line is fixed by the route; never let a snapshot change it.
      quotation_flow: line.quotationFlow,
      quotation_type: defaultValues.quotation_type,
      is_fleet: defaultValues.is_fleet,
      status: existingQuotation.status,
      cover_note_type:
        existingQuotation.cover_note_hdr.cover_note_type?.toString() as
          | '1'
          | '2'
          | '3',
      prev_cover_note_reference:
        existingQuotation.cover_note_dtl.prev_cover_note_reference_number ?? '',
      insurer_company_id:
        existingQuotation.internal_quotation.insurer_company_id,
    });
    queueMicrotask(() => setIsHydrating(false));
  }, [defaultValues, editOptionsReady, existingQuotation, form, line]);

  useEffect(() => {
    if (
      !existingQuotation ||
      (!EDITABLE_STATUSES.has(existingQuotation.status) &&
        !['SUCCESS', 'CANCELLED', 'ENDORSED'].includes(
          existingQuotation.tira_status,
        ))
    ) {
      return;
    }
    toast.error(
      'This quotation cannot be edited in its current status. Please create an endorsement or renewal where required.',
    );
    navigate(underwritePaths.quotationDetail(line.slug, existingQuotation.id), {
      replace: true,
    });
  }, [existingQuotation, line.slug, navigate]);

  // Users without channel permission always quote DIRECT (backend enforces).
  useEffect(() => {
    if (canSelectInsuranceChannel) return;
    if (
      isEditMode &&
      existingQuotation?.internal_quotation.channel_type !== 'DIRECT'
    ) {
      return;
    }
    if (form.getValues('channel_type') !== 'DIRECT') {
      form.setValue('channel_type', 'DIRECT', { shouldDirty: true });
    }
    if (form.getValues('intermediary_company_id')) {
      form.setValue('intermediary_company_id', '', { shouldDirty: true });
    }
  }, [canSelectInsuranceChannel, existingQuotation, form, isEditMode]);

  // ─── Cross-step effects (mirrors QuotationWizardPage) ───────────────────
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
      ) {
        form.setValue(`${prefix}.factor_values`, { ...current, ...context });
      }
    };
    if (line.line === 'FLEET') {
      (watchedFleetItems ?? []).forEach((item, index) =>
        item.risks_covered.forEach((_, riskIndex) =>
          update(`fleet.items.${index}.risks_covered.${riskIndex}`),
        ),
      );
    } else {
      (watchedRisks ?? []).forEach((_, index) => update(`risks.${index}`));
    }
  }, [
    form,
    line.line,
    officerName,
    officerTitle,
    paymentMode,
    salePointCode,
    selectedPolicyHolderType,
    watchedFleetItems,
    watchedRisks,
  ]);

  useEffect(() => {
    const totals =
      line.line === 'FLEET'
        ? aggregateFleetRiskTotals(watchedFleetItems ?? [])
        : aggregateRiskTotals(watchedRisks ?? []);
    const current = form.getValues();
    const complete = quotationTotals(current);
    totals.basic_premium = String(complete.premium);
    totals.total_premium = String(complete.total);
    totals.net_premium = String(complete.total);
    totals.total_tax = String(complete.tax);
    // Numeric compare: formats differ ("100000.0000" vs "100000"), and a
    // string compare re-sets forever (see QuotationWizardPage).
    (
      [
        'sum_insured',
        'basic_premium',
        'total_discount',
        'total_tax',
        'total_charges',
        'total_commission',
        'total_premium',
        'net_premium',
      ] as const
    ).forEach((field) => {
      if (Number(current[field]) !== Number(totals[field])) {
        form.setValue(field, totals[field]);
      }
    });
  }, [form, line.line, watchedAddons, watchedFleetItems, watchedRisks]);

  useEffect(() => {
    form.getValues('risks').forEach((risk, index) => {
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
        if (match?.id) form.setValue(`risks.${index}.risk_id`, match.id);
      }
    });
  }, [form, riskOptions]);

  useEffect(() => {
    if (line.line !== 'FLEET') return;
    const common = form.getValues('risks.0');
    const selected =
      riskOptions.find((option) => option.id === common.risk_id) ??
      (riskOptions.length === 1 ? riskOptions[0] : undefined);

    form.getValues('fleet.items').forEach((item, itemIndex) => {
      item.risks_covered.forEach((risk, riskIndex) => {
        const path =
          `fleet.items.${itemIndex}.risks_covered.${riskIndex}` as const;
        if (!risk.risk_id && !risk.risk_code && selected) {
          form.setValue(`${path}.risk_id`, selected.id);
          form.setValue(`${path}.risk_code`, selected.risk_code);
          if (!risk.sum_insured && common.sum_insured) {
            form.setValue(`${path}.sum_insured`, common.sum_insured);
          }
        }
        if (!risk.risk_code && risk.risk_id) {
          const match = riskOptions.find(
            (option) => option.id === risk.risk_id,
          );
          if (match?.risk_code) {
            form.setValue(`${path}.risk_code`, match.risk_code);
          }
        }
        if (!risk.risk_id && risk.risk_code) {
          const match = riskOptions.find(
            (option) => option.risk_code === risk.risk_code,
          );
          if (match?.id) form.setValue(`${path}.risk_id`, match.id);
        }
      });
    });
  }, [form, line.line, riskOptions, watchedFleetItems, watchedRisks]);

  // ─── Persistence ────────────────────────────────────────────────────────
  const onSaved = useCallback(
    (quotation: QuotationDetailRecord) => {
      void queryClient.invalidateQueries({ queryKey: underwriteKeys.all });
      void queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      setDraftId(quotation.id);
    },
    [queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: ({
      currentWizardStep,
    }: {
      currentWizardStep: string;
      silent: boolean;
    }) => {
      const payload = buildQuotationDraftPayload(
        form.getValues(),
        currentWizardStep,
      );
      return activeDraftId
        ? underwriteApi.updateDraft(line.slug, activeDraftId, {
            ...payload,
            expected_updated_at: existingQuotation?.updated_at,
          })
        : underwriteApi.createDraft(line.slug, payload);
    },
    onSuccess: async (quotation, variables) => {
      onSaved(quotation);
      if (hooksRef.current?.afterDraftSaved) {
        try {
          await hooksRef.current.afterDraftSaved(quotation.id);
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      }
      if (!variables.silent) toast.success('Quotation draft saved');
      if (!quotationId) {
        navigate(underwritePaths.quotationEdit(line.slug, quotation.id), {
          replace: true,
        });
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const finalizeMutation = useMutation({
    mutationFn: ({ id, productCode }: { id: string; productCode: string }) =>
      underwriteApi.finalize(line.slug, id, {
        ...buildQuotationPayload(form.getValues(), {
          salePointCode,
          productCode,
          existingCustomer: selectedCustomer ?? null,
        }),
        expected_updated_at: existingQuotation?.updated_at,
      }),
    onSuccess: (quotation) => {
      onSaved(quotation);
      toast.success('Quotation completed');
      navigate(underwritePaths.quotationDetail(line.slug, quotation.id));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => underwriteApi.deleteDraft(line.slug, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: underwriteKeys.all });
      void queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      toast.success('Quotation draft deleted');
      navigate(underwritePaths.quotations(line.slug));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveDraft = useCallback(
    async (silent = false) => {
      const deferredStepIndex = deferDraftUntilStepId
        ? steps.findIndex((step) => step.id === deferDraftUntilStepId)
        : -1;
      if (
        !activeDraftId &&
        !isEditMode &&
        deferredStepIndex >= 0 &&
        stepIndex <= deferredStepIndex
      ) {
        return null;
      }
      try {
        return await saveMutation.mutateAsync({
          currentWizardStep: stepId,
          silent,
        });
      } catch {
        return null;
      }
    },
    [
      activeDraftId,
      deferDraftUntilStepId,
      isEditMode,
      saveMutation,
      stepId,
      stepIndex,
      steps,
    ],
  );

  // ─── Navigation ─────────────────────────────────────────────────────────
  const goToStep = useCallback(
    async (nextStepId: string) => {
      const nextIndex = steps.findIndex((step) => step.id === nextStepId);
      if (
        nextIndex < 0 ||
        (nextIndex > stepIndex + 1 && !completedSteps.includes(nextStepId))
      ) {
        return;
      }
      const fields = steps[stepIndex]?.fields ?? [];
      if (nextIndex > stepIndex && fields.length) {
        const valid = await form.trigger(fields, { shouldFocus: true });
        if (!valid) {
          toast.error(
            findFirstErrorMessage(form.formState.errors) ??
              'Please fix the highlighted fields before continuing.',
          );
          return;
        }
      }
      const stepError =
        nextIndex > stepIndex ? (steps[stepIndex]?.validate?.() ?? null) : null;
      if (stepError) {
        toast.error(stepError);
        return;
      }
      const deferredStepIndex = deferDraftUntilStepId
        ? steps.findIndex((step) => step.id === deferDraftUntilStepId)
        : -1;
      const creatingDeferredDraft =
        !activeDraftId &&
        !isEditMode &&
        deferredStepIndex >= 0 &&
        stepIndex === deferredStepIndex &&
        nextIndex > stepIndex;
      if (creatingDeferredDraft) {
        const fieldsToValidate = [
          ...new Set(
            steps.slice(0, stepIndex + 1).flatMap((step) => step.fields),
          ),
        ];
        const allValid = await form.trigger(fieldsToValidate, {
          shouldFocus: true,
        });
        if (!allValid) {
          const invalidStep = steps
            .slice(0, stepIndex + 1)
            .find((step) =>
              step.fields.some((field) => form.getFieldState(field).invalid),
            );
          if (invalidStep) setSelectedStepId(invalidStep.id);
          toast.error(
            findFirstErrorMessage(form.formState.errors) ??
              'Please complete all required information before continuing.',
          );
          return;
        }
        const earlierStepError = steps
          .slice(0, stepIndex + 1)
          .find((step) => step.validate?.());
        if (earlierStepError) {
          setSelectedStepId(earlierStepError.id);
          toast.error(earlierStepError.validate!());
          return;
        }
        try {
          await saveMutation.mutateAsync({
            currentWizardStep: nextStepId,
            silent: true,
          });
        } catch {
          return;
        }
      }
      setCompletedSteps((previous) =>
        previous.includes(stepId) ? previous : [...previous, stepId],
      );
      setSelectedStepId(nextStepId);
      // Defer first Motor persistence until its configured completion step.
      // Existing drafts and other line wizards keep their normal autosaves.
      if (
        form.getValues('product_id') &&
        !(
          deferDraftUntilStepId &&
          !activeDraftId &&
          !isEditMode &&
          deferredStepIndex >= 0 &&
          stepIndex < deferredStepIndex
        ) &&
        !creatingDeferredDraft
      ) {
        void saveMutation
          .mutateAsync({ currentWizardStep: nextStepId, silent: true })
          .catch(() => undefined);
      }
    },
    [
      activeDraftId,
      completedSteps,
      deferDraftUntilStepId,
      form,
      isEditMode,
      saveMutation,
      stepId,
      stepIndex,
      steps,
    ],
  );

  const goNext = useCallback(() => {
    const next = steps[stepIndex + 1];
    if (next) void goToStep(next.id);
  }, [goToStep, stepIndex, steps]);

  const goBack = useCallback(() => {
    const previous = steps[stepIndex - 1];
    if (previous) setSelectedStepId(previous.id);
  }, [stepIndex, steps]);

  const complete = useCallback(async () => {
    const valid = await form.trigger(undefined, { shouldFocus: true });
    if (!valid) {
      const invalidStep = steps.find((step) =>
        step.fields.some((field) => form.getFieldState(field).invalid),
      );
      if (invalidStep) setSelectedStepId(invalidStep.id);
      toast.error(
        findFirstErrorMessage(form.formState.errors) ??
          'Please complete the required quotation fields.',
      );
      return;
    }

    // The policyholder payload is built from the loaded customer record.
    if (
      form.getValues('policyholder_mode') === 'existing' &&
      !selectedCustomer
    ) {
      toast.error(
        'The selected customer is still loading. Try again in a moment.',
      );
      return;
    }

    const pricingIssues = quotationPricingIssues(form.getValues());
    if (pricingIssues.length) {
      toast.error(pricingIssues[0]);
      const premiumStep = steps.find((step) =>
        step.fields.some((field) =>
          ['risks', 'fleet.items', 'nonMotor'].some((prefix) =>
            String(field).startsWith(prefix),
          ),
        ),
      );
      if (premiumStep) setSelectedStepId(premiumStep.id);
      return;
    }

    const product = productOptions.find(
      (item) => item.id === form.getValues('product_id'),
    );
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

    const blockingStep = steps.find((step) => step.validate?.());
    if (blockingStep) {
      setSelectedStepId(blockingStep.id);
      toast.error(blockingStep.validate!());
      return;
    }

    let id = activeDraftId;
    if (!id) {
      const draft = await saveDraft(true);
      if (!draft) return;
      id = draft.id;
    }

    if (
      hooksRef.current?.beforeFinalize &&
      !(await hooksRef.current.beforeFinalize(id))
    ) {
      return;
    }

    try {
      await finalizeMutation.mutateAsync({ id, productCode });
    } catch {
      // The mutation already surfaced the error.
    }
  }, [
    activeDraftId,
    finalizeMutation,
    form,
    productOptions,
    salePointCode,
    saveDraft,
    selectedCustomer,
    steps,
  ]);

  const deleteDraft = useCallback(() => {
    if (!activeDraftId) {
      navigate(underwritePaths.quotations(line.slug));
      return;
    }
    deleteMutation.mutate(activeDraftId);
  }, [activeDraftId, deleteMutation, line.slug, navigate]);

  const errorSteps = steps
    .filter((step) =>
      step.fields.some((field) => form.getFieldState(field).invalid),
    )
    .map((step) => step.id);

  return {
    form,
    line,
    steps,
    stepId,
    stepIndex,
    completedSteps,
    errorSteps,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    goToStep,
    goNext,
    goBack,
    setStep: setSelectedStepId,
    saveDraft,
    complete,
    deleteDraft,
    isEditMode,
    isHydrating,
    isLoading: editQuery.isLoading,
    loadError: editQuery.error,
    isSaving:
      saveMutation.isPending ||
      finalizeMutation.isPending ||
      deleteMutation.isPending,
    isDeleting: deleteMutation.isPending,
    hasProduct: Boolean(productId),
    canSaveDraft:
      isEditMode || Boolean(activeDraftId) || !deferDraftUntilStepId,
    canSelectInsuranceChannel,
    companyId,
    salePointCode,
    factorContext,
    riskFieldArray,
    addonFieldArray,
    fleetFieldArray,
    nonMotorFieldArray,
    customerOptions,
    categoryOptions,
    productOptions,
    riskOptions,
    vehicleOptions,
    subjectMatterOptions,
    /** Persisted quotation id, once the first draft has been saved. */
    draftId: activeDraftId,
    createEmptyFleetItemRow,
  };
}

export type UnderwriteQuotationWizard = ReturnType<
  typeof useUnderwriteQuotationWizard
>;
