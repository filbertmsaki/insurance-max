import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { customersApi } from '@/modules/tenant/customers/api';
import { buildCustomerPayload, getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import { motorApi } from '@/modules/tenant/motor/api';
import type { MotorFleetItemPayload, MotorVehiclePayload } from '@/modules/tenant/motor/types';
import { nonMotorApi } from '@/modules/tenant/non-motor/api';
import type { NonMotorQuotationDetailPayload, SubjectMatterPayload } from '@/modules/tenant/non-motor/types';
import { getApiErrorMessage } from '@/lib/api-error';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { buildQuotationTiramisPayload } from '@/modules/tenant/tiramis/utils';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { quotationsApi } from '../api';
import {
  useQuotationBranches,
  useQuotationCategories,
  useQuotationCurrentCompanyId,
  useQuotationCustomers,
  useQuotationDepartments,
  useQuotationProducts,
  useQuotationRisks,
  useQuotationSalePoints,
  useQuotationSubClasses,
  useQuotationVehicles,
} from '../hooks';
import {
  buildQuotationPayload,
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
import { QuotationWizardStepper } from '../wizard/QuotationWizardStepper';
import { useQuotationWizardDraft } from '../wizard/useQuotationWizardDraft';
import { getWizardStepsForFlow, resolveWizardFlow, type QuotationWizardStepId } from '../wizard/types';
import { aggregateRiskTotals, applyRiskPremiumResult } from '../wizard/utils/premiumAggregation';
import { CoverNoteSetupStep } from '../wizard/steps/CoverNoteSetupStep';
import { PolicyholderStep } from '../wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '../wizard/steps/RiskPremiumStep';
import { AddOnsStep } from '../wizard/steps/AddOnsStep';
import { MotorDetailsStep } from '../wizard/steps/MotorDetailsStep';
import { MotorFleetDetailsStep } from '../wizard/steps/MotorFleetDetailsStep';
import { NonMotorDetailsStep } from '../wizard/steps/NonMotorDetailsStep';
import { SummaryReviewStep } from '../wizard/steps/SummaryReviewStep';

// Fields validated (via form.trigger) before allowing "Next" out of a step.
// Steps not listed here have no fields to validate yet (placeholders).
const STEP_FIELDS: Partial<Record<QuotationWizardStepId, (keyof QuotationFormSchemaValues)[]>> = {
  'cover-note': [
    'category_id',
    'product_id',
    'branch_id',
    'valid_from',
    'valid_until',
    'currency',
    'exchange_rate',
    'cover_note_type',
    'prev_cover_note_reference',
  ],
  policyholder: ['customer_id', 'policyholder'],
  'risk-premium': ['risks'],
  addons: ['addons'],
  motor: ['motor_mode', 'motor'],
  'motor-fleet': ['fleet'],
  'non-motor': ['nonMotor'],
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
  risks: [createEmptyRiskRow()],
  addons: [],
  motor_mode: 'existing',
  motor: createEmptyMotorDetails(),
  fleet: createEmptyFleetDetails(),
  nonMotor: createEmptyNonMotorDetails(),
  quotation_type: 'NON_MOTOR',
  is_fleet: false,
  channel_type: 'DIRECT',
  status: 'DRAFT',
  currency: 'TZS',
  sum_insured: '',
  basic_premium: '',
  total_discount: '',
  total_tax: '',
  total_charges: '',
  total_commission: '',
  total_premium: '',
  net_premium: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  rating_version: '',
  rejection_reason: '',
  cover_note_type: '1',
  prev_cover_note_reference: '',
  officer_name: '',
  officer_title: '',
  payment_mode_tira: '1',
  sale_point_id: '',
  exchange_rate: '',
};

export function QuotationWizardPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editId);
  const companyId = useQuotationCurrentCompanyId();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const { data: categoryOptions = [] } = useQuotationCategories();

  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [policyholderCustomerId, setPolicyholderCustomerId] = useState<string | null>(null);
  const [motorVehicleId, setMotorVehicleId] = useState<string | null>(null);
  const [motorFleetId, setMotorFleetId] = useState<string | null>(null);
  const [loadingQuotation, setLoadingQuotation] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useQuotationWizardDraft(quotationId);

  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: { ...DEFAULT_VALUES, insurer_company_id: companyId },
  });
  const riskFieldArray = useFieldArray({ control: form.control, name: 'risks' });
  const fleetFieldArray = useFieldArray({ control: form.control, name: 'fleet.items' });
  const addonFieldArray = useFieldArray({ control: form.control, name: 'addons' });
  const nonMotorFieldArray = useFieldArray({ control: form.control, name: 'nonMotor.items' });

  // Hydrate insurer_company_id once the current company resolves, and restore
  // any unsaved draft from a previous session (only relevant before first save,
  // and only for the create flow — edit mode always loads from the server below).
  useEffect(() => {
    if (isEditMode) return;
    const draft = loadDraft();
    if (draft) {
      form.reset({ ...DEFAULT_VALUES, insurer_company_id: companyId, ...draft });
    } else if (companyId) {
      form.setValue('insurer_company_id', companyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isEditMode]);

  // Edit mode: load the quotation plus its motor/fleet/non-motor detail rows
  // (each lives on a separate entity — there's no single "get everything"
  // endpoint) and merge them into the base form values built from the
  // quotation record itself.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;

    (async () => {
      try {
        const quotation = await quotationsApi.getById(editId);
        const base = quotationRecordToFormValues(quotation) as QuotationFormSchemaValues;
        const isFleetFlow = base.quotation_type === 'MOTOR' && base.is_fleet;
        const isMotorFlow = base.quotation_type === 'MOTOR' && !base.is_fleet;

        if (isMotorFlow) {
          const vehicleId = quotation.risks?.[0]?.motor_vehicle_id ?? null;
          if (vehicleId) {
            // NOTE: no MotorQuotationDetail row is created by this wizard yet
            // (see Phase 7) — cover_type/no-claim-discount/excess fields aren't
            // captured, so only the vehicle's own physical attributes hydrate here.
            const vehicle = await motorApi.getVehicle(vehicleId);
            setMotorVehicleId(vehicle.id);
            base.motor = {
              vehicle_id: vehicle.id,
              registration_no: vehicle.registration_no ?? '',
              chassis_no: vehicle.chassis_no ?? '',
              engine_no: vehicle.engine_no ?? '',
              make: vehicle.make ?? '',
              model: vehicle.model ?? '',
              body_type: vehicle.body_type ?? '',
              color: vehicle.color ?? '',
              manufacture_year: vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
              usage_type: vehicle.usage_type ?? '',
              vehicle_category: vehicle.vehicle_category ?? '',
              seating_capacity: vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '',
              tonnage: vehicle.tonnage ?? '',
              cubic_capacity: vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '',
              fuel_type: vehicle.fuel_type ?? '',
              vehicle_value: vehicle.vehicle_value ?? '',
            };
          }
        }

        if (isFleetFlow) {
          const fleets = await motorApi.getFleets({ limit: API_MAX_LIST_LIMIT });
          const fleet = fleets.data.find((f) => f.quotation_id === editId);
          if (fleet) {
            const fullFleet = await motorApi.getFleet(fleet.id);
            setMotorFleetId(fullFleet.id);
            const items = await Promise.all(
              (fullFleet.items ?? []).map(async (item) => {
                const vehicle = await motorApi.getVehicle(item.motor_vehicle_id);
                return {
                  vehicle_id: vehicle.id,
                  fleet_item_id: item.id,
                  registration_no: vehicle.registration_no ?? '',
                  chassis_no: vehicle.chassis_no ?? '',
                  make: vehicle.make ?? '',
                  model: vehicle.model ?? '',
                  manufacture_year: vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
                  seating_capacity: vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '',
                  vehicle_value: vehicle.vehicle_value ?? '',
                  sum_insured: item.sum_insured ?? '',
                  premium: item.premium ?? '',
                };
              }),
            );
            base.fleet = {
              header: {
                fleet_id: fullFleet.id,
                fleet_no: fullFleet.fleet_no ?? '',
                fleet_name: fullFleet.fleet_name ?? '',
                fleet_type: '1',
                comprehensive_insured: '',
              },
              items: items.length ? items : [createEmptyFleetItemRow()],
            };
          }
        }

        if (base.quotation_type === 'NON_MOTOR') {
          const details = await nonMotorApi.getQuotationDetails(editId);
          base.nonMotor = {
            items: details.map((detail) => ({
              subject_matter_id: detail.subject_matter_id,
              detail_id: detail.id,
              subject_type: detail.subject_matter?.subject_type ?? '',
              subject_code: detail.subject_matter?.subject_code ?? '',
              description: detail.subject_matter?.description ?? '',
              location: detail.subject_matter?.location ?? '',
              value: detail.subject_matter?.value ?? '',
              cover_description: detail.cover_description ?? '',
              risk_location: detail.risk_location ?? '',
              insured_value: detail.insured_value ?? '',
              limit_of_liability: detail.limit_of_liability ?? '',
            })),
          };
        }

        if (cancelled) return;
        setQuotationId(quotation.id);
        setPolicyholderCustomerId(quotation.customer_id);
        form.reset(base);
      } catch (error) {
        if (!cancelled) setLoadError(getApiErrorMessage(error));
      } finally {
        if (!cancelled) setLoadingQuotation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      saveDraft(values as QuotationFormSchemaValues);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const quotationType = form.watch('quotation_type');
  const isFleet = form.watch('is_fleet');
  const flow = useMemo(() => resolveWizardFlow(quotationType, isFleet), [quotationType, isFleet]);
  const steps = useMemo(() => getWizardStepsForFlow(flow), [flow]);

  const [stepId, setStepId] = useState<QuotationWizardStepId>('cover-note');
  const [completedSteps, setCompletedSteps] = useState<QuotationWizardStepId[]>([]);

  // If switching flow removes the currently active step (e.g. leaving Motor
  // Fleet while sitting on the fleet-details step), fall back to the first step.
  useEffect(() => {
    if (!steps.some((step) => step.id === stepId)) {
      setStepId(steps[0]?.id ?? 'cover-note');
    }
  }, [steps, stepId]);

  const categoryId = form.watch('category_id');
  const productId = form.watch('product_id');
  const branchId = form.watch('branch_id');
  const { data: productOptions = [] } = useQuotationProducts(categoryId);
  const { data: subClassOptions = [] } = useQuotationSubClasses(productId);
  const { data: riskOptions = [] } = useQuotationRisks(productId);
  const { data: branchOptions = [] } = useQuotationBranches();
  const { data: departmentOptions = [] } = useQuotationDepartments(branchId || undefined);
  const { data: salePointOptions = [] } = useQuotationSalePoints(branchId || undefined);
  const activeSalePoints = useMemo(() => salePointOptions.filter((sp) => sp.isActive), [salePointOptions]);
  const customerIdWatch = form.watch('customer_id');
  const { data: vehicleOptions = [] } = useQuotationVehicles(customerIdWatch || undefined);
  const salePointRequired = activeSalePoints.length > 1;
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  function applyAggregateTotals() {
    const totals = aggregateRiskTotals(form.getValues('risks'));
    form.setValue('sum_insured', totals.sum_insured);
    form.setValue('basic_premium', totals.basic_premium);
    form.setValue('total_discount', totals.total_discount);
    form.setValue('total_tax', totals.total_tax);
    form.setValue('total_charges', totals.total_charges);
    form.setValue('total_commission', totals.total_commission);
    form.setValue('total_premium', totals.total_premium);
    form.setValue('net_premium', totals.net_premium);
  }

  async function calculateRow(index: number) {
    const row = form.getValues(`risks.${index}`);
    if (!row.risk_id) return;
    setCalculating(true);
    try {
      const result = await quotationsApi.calculateSingle({
        risk_id: row.risk_id,
        sum_insured: Number(row.sum_insured || 0),
        factors: row.factor_values,
      });
      form.setValue(`risks.${index}`, applyRiskPremiumResult(row, result));
      applyAggregateTotals();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setCalculating(false);
    }
  }

  async function calculateAll() {
    const rows = form.getValues('risks');
    const validRows = rows.filter((row) => row.risk_id);
    if (!validRows.length) return;

    if (validRows.length === 1) {
      const index = rows.indexOf(validRows[0]);
      await calculateRow(index);
      return;
    }

    setCalculating(true);
    try {
      const response = await quotationsApi.calculateMulti({
        risks: validRows.map((row) => ({
          risk_id: row.risk_id,
          sum_insured: Number(row.sum_insured || 0),
          factors: row.factor_values,
        })),
      });
      // The engine returns results in the same order the request rows were sent.
      response.risks.forEach((result, resultIndex) => {
        const row = validRows[resultIndex];
        const rowIndex = rows.indexOf(row);
        if (rowIndex === -1) return;
        form.setValue(`risks.${rowIndex}`, applyRiskPremiumResult(row, result));
      });
      applyAggregateTotals();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setCalculating(false);
    }
  }

  function addRisk() {
    riskFieldArray.append(createEmptyRiskRow());
  }

  function removeRisk(index: number) {
    if (riskFieldArray.fields.length <= 1) return;
    riskFieldArray.remove(index);
    applyAggregateTotals();
  }

  function addFleetVehicle() {
    fleetFieldArray.append(createEmptyFleetItemRow());
  }

  function removeFleetVehicle(index: number) {
    if (fleetFieldArray.fields.length <= 1) return;
    fleetFieldArray.remove(index);
  }

  // Capped at risks.length — each subject matter row must link to a real risk row.
  function addNonMotorItem() {
    if (nonMotorFieldArray.fields.length >= riskFieldArray.fields.length) return;
    nonMotorFieldArray.append(createEmptyNonMotorItemRow());
  }

  function removeNonMotorItem(index: number) {
    nonMotorFieldArray.remove(index);
  }

  function goToStep(id: QuotationWizardStepId) {
    setCompletedSteps((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
    setStepId(id);
  }

  async function goNext() {
    const fields = STEP_FIELDS[stepId] ?? [];
    const valid = fields.length ? await form.trigger(fields) : true;

    if (stepId === 'cover-note' && salePointRequired && !form.getValues('sale_point_id')) {
      form.setError('sale_point_id', {
        type: 'manual',
        message: 'This branch has more than one active sale point — select one to continue',
      });
      return;
    }

    if (!valid) return;

    const index = steps.findIndex((step) => step.id === stepId);
    const next = steps[index + 1];
    if (next) goToStep(next.id);
  }

  function goBack() {
    const index = steps.findIndex((step) => step.id === stepId);
    const prev = steps[index - 1];
    if (prev) setStepId(prev.id);
  }

  async function resolveCustomerId(values: QuotationFormSchemaValues): Promise<string> {
    if (values.policyholder_mode === 'existing') {
      if (!values.customer_id) {
        throw new Error('Select an existing customer before saving');
      }
      return values.customer_id;
    }
    // values.policyholder is the zod-inferred shape (optional string fields);
    // buildCustomerPayload's hand-written CustomerFormValues type requires them
    // present. At runtime they're always '' (never undefined) because
    // getCustomerDefaultValues() seeds every field — this bridges the type gap.
    const customerPayload = buildCustomerPayload(values.policyholder as unknown as Parameters<typeof buildCustomerPayload>[0]);
    const customer = policyholderCustomerId
      ? await customersApi.updateCustomer(policyholderCustomerId, customerPayload)
      : await customersApi.createCustomer(customerPayload);
    setPolicyholderCustomerId(customer.id);
    return customer.id;
  }

  /** Only applies to the non-fleet Motor flow; returns null for Non-Motor/Fleet. */
  async function resolveMotorVehicleId(values: QuotationFormSchemaValues, customerId: string): Promise<string | null> {
    if (values.quotation_type !== 'MOTOR' || values.is_fleet) return null;
    if (values.motor_mode === 'existing') {
      if (!values.motor.vehicle_id) {
        throw new Error('Select an existing vehicle before saving');
      }
      return values.motor.vehicle_id;
    }
    const motor = values.motor;
    const vehiclePayload: MotorVehiclePayload = {
      customer_id: customerId,
      registration_no: motor.registration_no || null,
      chassis_no: motor.chassis_no || null,
      engine_no: motor.engine_no || null,
      make: motor.make || null,
      model: motor.model || null,
      body_type: motor.body_type || null,
      color: motor.color || null,
      manufacture_year: motor.manufacture_year ? Number(motor.manufacture_year) : null,
      usage_type: motor.usage_type || null,
      vehicle_category: motor.vehicle_category || null,
      seating_capacity: motor.seating_capacity ? Number(motor.seating_capacity) : null,
      tonnage: motor.tonnage || null,
      cubic_capacity: motor.cubic_capacity ? Number(motor.cubic_capacity) : null,
      fuel_type: motor.fuel_type || null,
      vehicle_value: motor.vehicle_value || 0,
    };
    const vehicle = motorVehicleId
      ? await motorApi.updateVehicle(motorVehicleId, vehiclePayload)
      : await motorApi.createVehicle(vehiclePayload);
    setMotorVehicleId(vehicle.id);
    return vehicle.id;
  }

  /**
   * Only applies to the Motor Fleet flow. Creates/updates the MotorFleet header,
   * then for each table row creates/updates its own MotorVehicle (owned by the
   * policyholder, same as the single-vehicle Motor flow) plus a MotorFleetItem
   * linking that vehicle to the fleet with its own sum insured/premium.
   * quotation_risk_id is intentionally left unset on each item — a fleet's
   * risks[] rows represent product-level pricing, not one risk per vehicle,
   * and there's no correlation key to attribute one to the other yet.
   */
  async function resolveFleet(values: QuotationFormSchemaValues, customerId: string): Promise<void> {
    if (values.quotation_type !== 'MOTOR' || !values.is_fleet) return;

    const items = values.fleet.items;
    const totalSumInsured = items.reduce((sum, item) => sum + (Number(item.sum_insured) || 0), 0);
    const totalPremium = items.reduce((sum, item) => sum + (Number(item.premium) || 0), 0);

    const fleetPayload = {
      customer_id: customerId,
      fleet_no: values.fleet.header.fleet_no ?? '',
      fleet_name: values.fleet.header.fleet_name || null,
      total_vehicles: items.length,
      total_sum_insured: totalSumInsured,
      total_premium: totalPremium,
    };
    const fleet = motorFleetId
      ? await motorApi.updateFleet(motorFleetId, fleetPayload)
      : await motorApi.createFleet(fleetPayload);
    setMotorFleetId(fleet.id);
    form.setValue('fleet.header.fleet_id', fleet.id);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const vehiclePayload: MotorVehiclePayload = {
        customer_id: customerId,
        registration_no: item.registration_no || null,
        chassis_no: item.chassis_no || null,
        make: item.make || null,
        model: item.model || null,
        manufacture_year: item.manufacture_year ? Number(item.manufacture_year) : null,
        seating_capacity: item.seating_capacity ? Number(item.seating_capacity) : null,
        vehicle_value: item.vehicle_value || 0,
      };
      const vehicle = item.vehicle_id
        ? await motorApi.updateVehicle(item.vehicle_id, vehiclePayload)
        : await motorApi.createVehicle(vehiclePayload);
      form.setValue(`fleet.items.${index}.vehicle_id`, vehicle.id);

      const itemPayload: MotorFleetItemPayload = {
        motor_vehicle_id: vehicle.id,
        sum_insured: Number(item.sum_insured) || 0,
        premium: Number(item.premium) || 0,
      };
      const fleetItem = item.fleet_item_id
        ? await motorApi.updateFleetItem(fleet.id, item.fleet_item_id, itemPayload)
        : await motorApi.createFleetItem(fleet.id, itemPayload);
      form.setValue(`fleet.items.${index}.fleet_item_id`, fleetItem.id);
    }
  }

  /**
   * Only applies to the Non-Motor flow, and must run *after* the quotation has
   * been created/updated — NonMotorQuotationDetail requires a real
   * quotation_risk_id, which doesn't exist until the risk rows are persisted.
   * Each subject matter row is matched 1:1 by index to `savedRisks` (same
   * order-preservation assumption already relied on for multi-risk premium
   * calculation results).
   */
  async function resolveNonMotor(
    values: QuotationFormSchemaValues,
    customerId: string,
    quotationId: string,
    savedRisks: { id: string }[],
  ): Promise<void> {
    if (values.quotation_type !== 'NON_MOTOR') return;

    const items = values.nonMotor.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const risk = savedRisks[index];
      if (!risk) continue;

      const subjectMatterPayload: SubjectMatterPayload = {
        customer_id: customerId,
        subject_type: item.subject_type || null,
        subject_code: item.subject_code || '',
        description: item.description || null,
        location: item.location || null,
        value: item.value || 0,
      };
      const subjectMatter = item.subject_matter_id
        ? await nonMotorApi.updateSubjectMatter(item.subject_matter_id, subjectMatterPayload)
        : await nonMotorApi.createSubjectMatter(subjectMatterPayload);
      form.setValue(`nonMotor.items.${index}.subject_matter_id`, subjectMatter.id);

      const detailPayload: NonMotorQuotationDetailPayload = {
        quotation_id: quotationId,
        quotation_risk_id: risk.id,
        subject_matter_id: subjectMatter.id,
        cover_description: item.cover_description || null,
        risk_location: item.risk_location || null,
        insured_value: item.insured_value || null,
        limit_of_liability: item.limit_of_liability || null,
      };
      const detail = item.detail_id
        ? await nonMotorApi.updateQuotationDetail(item.detail_id, detailPayload)
        : await nonMotorApi.createQuotationDetail(detailPayload);
      form.setValue(`nonMotor.items.${index}.detail_id`, detail.id);
    }
  }

  async function saveQuotation({ andSubmit }: { andSubmit: boolean }) {
    setSaving(true);
    try {
      const values = form.getValues();
      let customerId: string;
      let vehicleId: string | null;
      try {
        customerId = await resolveCustomerId(values);
        vehicleId = await resolveMotorVehicleId(values, customerId);
        await resolveFleet(values, customerId);
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        return;
      }
      const payload = buildQuotationPayload(values, customerId);
      if (vehicleId) {
        payload.risks = payload.risks?.map((risk) => ({ ...risk, motor_vehicle_id: vehicleId }));
      }

      const quotation = quotationId
        ? await quotationsApi.update(quotationId, payload)
        : await quotationsApi.create(payload);
      setQuotationId(quotation.id);

      try {
        await resolveNonMotor(values, customerId, quotation.id, quotation.risks ?? []);
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }

      clearDraft();

      if (!andSubmit) {
        navigate(underwritingPaths.quotationDetail(quotation.id));
        return;
      }

      try {
        const submissionResult = (await tiramisApi.submit(buildQuotationTiramisPayload(quotation))) as {
          submission?: { id: string };
        };
        if (submissionResult.submission) {
          navigate(underwritingPaths.submissionDetail(submissionResult.submission.id));
          return;
        }
      } catch {
        // Keep the created quotation accessible for manual follow-up if TIRA submission fails.
      }
      navigate(underwritingPaths.quotationDetail(quotation.id));
    } finally {
      setSaving(false);
    }
  }

  const isFirstStep = steps[0]?.id === stepId;
  const isLastStep = steps[steps.length - 1]?.id === stepId;

  if (loadingQuotation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-red-600">
        <p>Could not load this quotation for editing: {loadError}</p>
        <Button variant="outline" onClick={() => navigate(underwritingPaths.quotations)}>
          Back to Quotations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.quotations)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={isEditMode ? 'Edit Quotation' : 'Quotation Wizard'}
          description={isEditMode ? 'Resume and update this draft quotation' : 'Guided quotation creation with automatic TIRAMIS submission'}
        />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <div className="space-y-4">
          <QuotationWizardStepper steps={steps} value={stepId} completed={completedSteps} onChange={goToStep} />

          <Form {...form}>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {stepId === 'cover-note' && (
                <CoverNoteSetupStep
                  form={form}
                  categoryOptions={categoryOptions}
                  productOptions={productOptions}
                  subClassOptions={subClassOptions}
                  branchOptions={branchOptions}
                  departmentOptions={departmentOptions}
                  salePointOptions={activeSalePoints}
                  salePointRequired={salePointRequired}
                />
              )}
              {stepId === 'policyholder' && <PolicyholderStep form={form} customerOptions={customerOptions} />}
              {stepId === 'risk-premium' && (
                <RiskPremiumStep
                  form={form}
                  riskOptions={riskOptions}
                  fieldArray={riskFieldArray}
                  onCalculateRow={calculateRow}
                  onCalculateAll={calculateAll}
                  onRemoveRisk={removeRisk}
                  calculating={calculating}
                  onAddRisk={addRisk}
                />
              )}
              {stepId === 'addons' && <AddOnsStep form={form} fieldArray={addonFieldArray} />}
              {stepId === 'motor' && <MotorDetailsStep form={form} vehicleOptions={vehicleOptions} />}
              {stepId === 'motor-fleet' && (
                <MotorFleetDetailsStep
                  form={form}
                  fieldArray={fleetFieldArray}
                  onAddVehicle={addFleetVehicle}
                  onRemoveVehicle={removeFleetVehicle}
                />
              )}
              {stepId === 'non-motor' && (
                <NonMotorDetailsStep
                  form={form}
                  fieldArray={nonMotorFieldArray}
                  riskCount={riskFieldArray.fields.length}
                  onAddItem={addNonMotorItem}
                  onRemoveItem={removeNonMotorItem}
                />
              )}
              {stepId === 'summary' && (
                <SummaryReviewStep
                  form={form}
                  customerOptions={customerOptions}
                  categoryOptions={categoryOptions}
                  productOptions={productOptions}
                  subClassOptions={subClassOptions}
                  branchOptions={branchOptions}
                  departmentOptions={departmentOptions}
                  riskOptions={riskOptions}
                  riskCount={riskFieldArray.fields.length}
                  onEditStep={goToStep}
                />
              )}
            </form>
          </Form>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Button type="button" variant="outline" onClick={goBack} disabled={isFirstStep}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => saveQuotation({ andSubmit: false })} disabled={saving || !companyId}>
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            {isLastStep ? (
              <Button type="button" onClick={() => setConfirmSubmitOpen(true)} disabled={saving || !companyId}>
                {saving ? 'Submitting...' : 'Save & Submit to TIRAMIS'}
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this quotation to TIRAMIS?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves the quotation and immediately attempts a TIRAMIS cover note submission. No
              payment has been collected yet — submission before payment is only appropriate if your
              backend flow explicitly allows it. Total premium: {form.watch('total_premium') || '0'}{' '}
              {form.watch('currency')}, across {riskFieldArray.fields.length} risk(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSubmitOpen(false);
                saveQuotation({ andSubmit: true });
              }}
            >
              Confirm &amp; Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
