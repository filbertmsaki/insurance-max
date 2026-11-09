import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useParams } from 'react-router-dom';
import { useWatch } from 'react-hook-form';
import { CarFront, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { UnderwriteLine } from '@insurance-max/contracts';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import { useCoverNoteAutoText } from '@/modules/tenant/quotations/wizard/hooks/useCoverNoteAutoText';
import { useProductAddonDefinitions } from '@/modules/tenant/quotations/wizard/hooks/useProductAddonDefinitions';
import { AddOnsStep } from '@/modules/tenant/quotations/wizard/steps/AddOnsStep';
import {
  FleetAdjustmentsFields,
  MotorFleetDetailsStep,
} from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { RiskPremiumStep } from '@/modules/tenant/quotations/wizard/steps/RiskPremiumStep';
import { SummaryReviewStep } from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import {
  dateOnlyPart,
  todayLocalDatePart,
} from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import { FleetPremiumStep } from '@/modules/tenant/underwrite/fleet/FleetPremiumStep';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { MotorVehicleSection } from '@/modules/tenant/underwrite/motor/MotorVehicleSection';
import { BusinessSourceStep } from '@/modules/tenant/underwrite/wizard/steps/BusinessSourceStep';
import { UnderwriteWizardShell } from '@/modules/tenant/underwrite/wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import {
  SHORT_TERM_COVER,
  shortTermExpiry,
  type ShortTermMode,
} from '../shortTerm';
import { useFleetVehicleActions } from './FleetQuotationWizard';

const MOTOR = getUnderwriteLineMeta(UnderwriteLine.MOTOR);
const FLEET = getUnderwriteLineMeta(UnderwriteLine.FLEET);

const SOURCE_FIELDS = [
  'channel_type',
  'intermediary_company_id',
  'commission_rate',
  'commission_paid',
] as const;

/*
 * Four steps for both modes. Step IDs are prefixed so a saved Short-Term
 * draft never restores into a step of the full wizards (and vice versa).
 */
const SINGLE_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'st-cover',
    label: 'Cover & Policyholder',
    description: 'Single or fleet, customer and start date',
    fields: [
      'customer_id',
      'policyholder',
      'product_id',
      'risks.0.risk_id',
      'valid_from',
      'valid_until',
      'cover_note_desc',
      'operative_clause',
    ],
  },
  {
    id: 'st-vehicles',
    label: 'Vehicle',
    description: 'The vehicle in transit',
    fields: ['motor'],
  },
  {
    // Premium and review on one step.
    id: 'st-review',
    label: 'Review & Complete',
    description: 'Premium, taxes, total and summary',
    fields: [
      'risks.0.sum_insured',
      'addons',
      ...SOURCE_FIELDS,
      'payment_mode_tira',
    ],
  },
];

const FLEET_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'st-cover',
    label: 'Cover & Policyholder',
    description: 'Single or fleet, customer and start date',
    fields: [
      'customer_id',
      'policyholder',
      'fleet.header',
      'product_id',
      'valid_from',
      'valid_until',
    ],
  },
  {
    id: 'st-vehicles',
    label: 'Vehicles',
    description: 'Add, import and price each vehicle',
    fields: ['fleet.items'],
  },
  {
    // Premium and review on one step.
    id: 'st-review',
    label: 'Review & Complete',
    description: 'Vehicle premiums, fleet totals and summary',
    fields: [...SOURCE_FIELDS, 'payment_mode_tira'],
  },
];

/** Values kept when the user flips between Single and Fleet before saving. */
type Carry = Pick<
  QuotationFormSchemaValues,
  'customer_id' | 'policyholder_mode' | 'policyholder' | 'valid_from'
>;

/**
 * Short-Term (In-Transit) quotation: a simplified front over the existing
 * Motor and Fleet wizards. Single mode drafts on the Motor line, Fleet mode on
 * the Fleet line; the product, transit risk and 30-day period are preset.
 *
 * `lockedMode` is set when editing a saved quotation — its line is fixed.
 */
export function ShortTermQuotationWizard({
  lockedMode,
  allowFleet = true,
}: {
  lockedMode?: ShortTermMode;
  /** False when the user may not create Fleet quotations. */
  allowFleet?: boolean;
}) {
  const [mode, setMode] = useState<ShortTermMode>(lockedMode ?? 'single');
  const carryRef = useRef<Carry | null>(null);
  const activeMode = lockedMode ?? mode;
  const Wizard = activeMode === 'fleet' ? ShortTermFleet : ShortTermSingle;

  return (
    <Wizard
      // Single and Fleet are different lines, so each gets its own form.
      key={activeMode}
      carryRef={carryRef}
      mode={activeMode}
      showToggle={allowFleet || activeMode === 'fleet'}
      onModeChange={lockedMode ? undefined : setMode}
    />
  );
}

interface ModeProps {
  mode: ShortTermMode;
  carryRef: MutableRefObject<Carry | null>;
  showToggle: boolean;
  onModeChange?: (mode: ShortTermMode) => void;
}

/**
 * Presets the Short-Term product, transit risk, 30-day expiry and wording, and
 * carries customer/start date across a Single ↔ Fleet switch.
 */
function useShortTermPresets(
  wizard: UnderwriteQuotationWizard,
  mode: ShortTermMode,
  carryRef: MutableRefObject<Carry | null>,
) {
  const { form, productOptions, riskOptions, isHydrating, companyId } = wizard;
  const productId = useWatch({ control: form.control, name: 'product_id' });
  const validFrom = useWatch({ control: form.control, name: 'valid_from' });
  const validUntil = useWatch({ control: form.control, name: 'valid_until' });

  const product = productOptions.find(
    (item) => item.product_code === SHORT_TERM_COVER.productCode,
  );
  const risk = riskOptions.find(
    (item) => item.risk_code === SHORT_TERM_COVER.riskCode,
  );

  // Restore what the user entered in the other mode, after the hook's reset.
  const carriedRef = useRef(false);
  useEffect(() => {
    if (carriedRef.current || !companyId || wizard.isEditMode) return;
    carriedRef.current = true;
    const carry = carryRef.current;
    if (!carry) return;
    form.setValue('policyholder_mode', carry.policyholder_mode);
    form.setValue('customer_id', carry.customer_id);
    form.setValue('policyholder', carry.policyholder);
    if (carry.valid_from) form.setValue('valid_from', carry.valid_from);
  }, [carryRef, companyId, form, wizard.isEditMode]);

  useEffect(
    () => () => {
      const values = form.getValues();
      carryRef.current = {
        customer_id: values.customer_id,
        policyholder_mode: values.policyholder_mode,
        policyholder: values.policyholder,
        valid_from: values.valid_from,
      };
    },
    [carryRef, form],
  );

  useEffect(() => {
    if (isHydrating || !product || productId === product.id) return;
    form.setValue('product_id', product.id, { shouldValidate: true });
    if (product.category_id) form.setValue('category_id', product.category_id);
  }, [form, isHydrating, product, productId]);

  useEffect(() => {
    if (isHydrating || !risk || productId !== product?.id) return;
    const path = mode === 'fleet' ? 'fleet.header.cover' : 'risks.0';
    if (form.getValues(`${path}.risk_id`) !== risk.id) {
      form.setValue(`${path}.risk_id`, risk.id, { shouldValidate: true });
    }
    if (form.getValues(`${path}.risk_code`) !== risk.risk_code) {
      form.setValue(`${path}.risk_code`, risk.risk_code, {
        shouldValidate: true,
      });
    }
  }, [form, isHydrating, mode, product?.id, productId, risk]);

  useEffect(() => {
    if (isHydrating || !validFrom) return;
    const expiry = shortTermExpiry(validFrom);
    if (expiry && expiry !== validUntil) {
      form.setValue('valid_until', expiry, { shouldValidate: true });
    }
  }, [form, isHydrating, validFrom, validUntil]);

  // Cover note wording is generated, not typed, in this wizard.
  useCoverNoteAutoText({
    form,
    productName: product?.product_name,
    validFrom,
    validUntil,
    isHydrating,
  });

  const missing =
    productOptions.length > 0 && !product
      ? `Product ${SHORT_TERM_COVER.productCode} is not available for this company.`
      : product && productId === product.id && riskOptions.length > 0 && !risk
        ? `Risk ${SHORT_TERM_COVER.riskCode} is not configured on the product.`
        : null;

  return {
    ready: Boolean(product && risk),
    missing,
    validFrom,
    validUntil,
  };
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ShortTermMode;
  onChange?: (mode: ShortTermMode) => void;
}) {
  const options = [
    { value: 'single' as const, label: 'Single', icon: CarFront },
    { value: 'fleet' as const, label: 'Fleet', icon: Truck },
  ];
  return (
    <div className="space-y-1">
      <div
        role="radiogroup"
        aria-label="Short-term cover mode"
        className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-auto"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const active = value === mode;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!onChange && !active}
              onClick={() => !active && onChange?.(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-5 py-1.5 text-sm font-medium transition sm:flex-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                active
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        {onChange
          ? mode === 'fleet'
            ? 'Two or more vehicles, each with its own cover note.'
            : 'One vehicle under one cover note.'
          : 'The mode is fixed once the draft is saved.'}
      </p>
    </div>
  );
}

function CoverSummary({
  presets,
}: {
  presets: ReturnType<typeof useShortTermPresets>;
}) {
  const rows = [
    ['Cover', SHORT_TERM_COVER.name],
    ['Motor class', SHORT_TERM_COVER.motorClass],
    ['Duration', `${SHORT_TERM_COVER.durationDays} days`],
    ['Expires', dateOnlyPart(presets.validUntil) || '—'],
  ];
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-900">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Cover details are filled in automatically
        {!presets.ready && !presets.missing && (
          <Loader2
            className="h-4 w-4 animate-spin text-blue-600"
            aria-label="Loading cover"
          />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="truncate font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {presets.missing && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {presets.missing} Ask an administrator to configure the Short-Term
          cover.
        </p>
      )}
    </div>
  );
}

function CoverStep({
  wizard,
  mode,
  showToggle,
  onModeChange,
  presets,
}: {
  wizard: UnderwriteQuotationWizard;
  mode: ShortTermMode;
  showToggle: boolean;
  onModeChange?: (mode: ShortTermMode) => void;
  presets: ReturnType<typeof useShortTermPresets>;
}) {
  const { form } = wizard;
  // Locked after the first save: the line cannot change on a saved draft.
  const canSwitch = onModeChange && !wizard.draftId ? onModeChange : undefined;
  return (
    <div className="space-y-4">
      {showToggle && <ModeToggle mode={mode} onChange={canSwitch} />}
      <PolicyholderStep
        form={form}
        customerOptions={wizard.customerOptions}
        newCustomerInDialog
        hideNewCustomerButton
        compactOnMobile
      />
      <StepSection title="Cover period" first={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <WizardInput
            form={form}
            name="valid_from"
            label="Cover starts"
            required
            type="date"
            min={todayLocalDatePart()}
          />
          <WizardInput
            form={form}
            name="valid_until"
            label="Cover ends (30 days)"
            required
            type="date"
            readOnly
          />
        </div>
      </StepSection>
      <CoverSummary presets={presets} />
      {mode === 'fleet' && <FleetAdjustmentsFields form={form} />}
    </div>
  );
}

function ShortTermSingle({
  mode,
  carryRef,
  showToggle,
  onModeChange,
}: ModeProps) {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: MOTOR,
    quotationId: id,
    steps: SINGLE_STEPS,
    // First saved when leaving the vehicle step (Premium merged into Review).
    deferDraftUntilStepId: 'st-vehicles',
    stepAliases: { 'st-premium': 'st-review' },
  });
  const { form } = wizard;
  const presets = useShortTermPresets(wizard, mode, carryRef);
  usePageTitle(
    wizard.existingQuotation?.quotation_no
      ? `Edit Quotation ${wizard.existingQuotation.quotation_no}`
      : 'New Short-Term Quotation',
  );
  const productId = useWatch({ control: form.control, name: 'product_id' });
  const customerId = useWatch({ control: form.control, name: 'customer_id' });
  const { data: addonDefinitions = [] } = useProductAddonDefinitions(
    productId || undefined,
  );
  const showAddOns =
    addonDefinitions.length > 0 || wizard.addonFieldArray.fields.length > 0;

  // One vehicle, one risk — same rule as the Single Motor wizard.
  useEffect(() => {
    const risks = form.getValues('risks');
    if (risks.length > 1) wizard.riskFieldArray.replace([risks[0]]);
  }, [form, wizard.riskFieldArray, wizard.riskFieldArray.fields.length]);

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit short-term quotation' : 'New short-term quotation'}
      showHeader={Boolean(id)}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'st-cover':
            return (
              <CoverStep
                wizard={wizard}
                mode={mode}
                showToggle={showToggle}
                onModeChange={onModeChange}
                presets={presets}
              />
            );
          case 'st-vehicles':
            return (
              <MotorVehicleSection
                form={form}
                compactOnMobile
                customer={
                  wizard.customerOptions.find(
                    (customer) => customer.id === customerId,
                  ) ?? null
                }
              />
            );
          case 'st-review':
            return (
              <div className="space-y-3">
                <RiskPremiumStep
                  form={form}
                  riskOptions={wizard.riskOptions}
                  fieldArray={wizard.riskFieldArray}
                  flow="MOTOR_SINGLE"
                  onAddRisk={() => undefined}
                  onRemoveRisk={() => undefined}
                  factorContext={wizard.factorContext}
                  allowMultipleRisks={false}
                  showRiskSelector={false}
                  title=""
                  riskTitle="Premium calculation"
                  collapseAdjustments
                />
                {showAddOns && (
                  <AddOnsStep
                    form={form}
                    fieldArray={wizard.addonFieldArray}
                    requirePremiumRate
                  />
                )}
                <BusinessSourceStep wizard={wizard} />
                <SummaryReviewStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  categoryOptions={wizard.categoryOptions}
                  productOptions={wizard.productOptions}
                  riskOptions={wizard.riskOptions}
                  riskCount={wizard.riskFieldArray.fields.length}
                  onEditStep={() => wizard.setStep('st-cover')}
                  onEditSection={(section) =>
                    wizard.setStep(
                      section === 'vehicle'
                        ? 'st-vehicles'
                        : section === 'premium'
                          ? 'st-review'
                          : 'st-cover',
                    )
                  }
                  showPaymentMode
                />
              </div>
            );
          default:
            return null;
        }
      }}
    />
  );
}

function ShortTermFleet({
  mode,
  carryRef,
  showToggle,
  onModeChange,
}: ModeProps) {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: FLEET,
    quotationId: id,
    steps: FLEET_STEPS,
    // First saved when leaving the vehicle step (Premium merged into Review).
    deferDraftUntilStepId: 'st-vehicles',
    stepAliases: { 'st-premium': 'st-review' },
    allowEarlyManualDraft: true,
  });
  const actions = useFleetVehicleActions(wizard);
  const { form } = wizard;
  const presets = useShortTermPresets(wizard, mode, carryRef);
  usePageTitle(
    wizard.existingQuotation?.quotation_no
      ? `Edit Quotation ${wizard.existingQuotation.quotation_no}`
      : 'New Short-Term Quotation',
  );

  return (
    <UnderwriteWizardShell
      wizard={wizard}
      title={id ? 'Edit short-term fleet quotation' : 'New short-term fleet'}
      showHeader={Boolean(id)}
      renderStep={(stepId) => {
        switch (stepId) {
          case 'st-cover':
            return (
              <CoverStep
                wizard={wizard}
                mode={mode}
                showToggle={showToggle}
                onModeChange={onModeChange}
                presets={presets}
              />
            );
          case 'st-vehicles':
            return (
              <div className="space-y-4">
                <MotorFleetDetailsStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  riskOptions={wizard.riskOptions}
                  vehicleOptions={wizard.vehicleOptions}
                  productOptions={wizard.productOptions}
                  fieldArray={wizard.fleetFieldArray}
                  onAddVehicle={actions.add}
                  onRemoveVehicle={actions.remove}
                  onDuplicateVehicle={actions.duplicate}
                  onImportVehicles={actions.importRows}
                  factorContext={wizard.factorContext}
                />
              </div>
            );
          case 'st-review':
            return (
              <div className="space-y-6">
                <FleetPremiumStep
                  wizard={wizard}
                  onEditVehicles={() => wizard.setStep('st-vehicles')}
                />
                <BusinessSourceStep wizard={wizard} />
                <SummaryReviewStep
                  form={form}
                  customerOptions={wizard.customerOptions}
                  categoryOptions={wizard.categoryOptions}
                  productOptions={wizard.productOptions}
                  riskOptions={wizard.riskOptions}
                  riskCount={wizard.fleetFieldArray.fields.length}
                  onEditStep={() => void wizard.goToStep('st-cover')}
                  onEditSection={(section) =>
                    void wizard.goToStep(
                      section === 'vehicle' ? 'st-vehicles' : 'st-cover',
                    )
                  }
                />
              </div>
            );
          default:
            return null;
        }
      }}
    />
  );
}
