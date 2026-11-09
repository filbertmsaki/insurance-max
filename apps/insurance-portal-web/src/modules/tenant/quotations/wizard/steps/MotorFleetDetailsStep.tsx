import { allowsAddons } from '../utils/addonVisibility';
import { WizardSectionTitle } from '@/modules/tenant/quotations/wizard/components/WizardSectionTitle';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useFieldArray,
  useFormState,
  type FieldPath,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error';
import { dateOnlyPart, pricingCoverEndDate } from '../utils/coverNoteDateRange';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import {
  PricingStatusAlert,
  RatingFactorFields,
  usePricingCalculator,
  usePricingExplanation,
  pricingApi,
  type PricingFactorValue,
  type PricingFleetTotals,
} from '@/modules/pricing';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import { requiredFactorsApi } from '@/modules/tenant/product-engine/api/required-factors';
import { peKeys } from '@/modules/tenant/product-engine/hooks/query-keys';
import type {
  InsuranceRisk,
  MultiCalcFailure,
  RiskRequiredFactor,
} from '@/types/product-engine';
import {
  createEmptyAddonRow,
  createEmptyFleetItemRow,
  createEmptyFleetRiskRow,
  createEmptyRiskDiscountRow,
  createEmptyRiskTaxRow,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import { StepSection } from '../components/StepSection';
import { WizardFormItem } from '../components/WizardFormItem';
import { AddonRow } from '../components/AddonRow';
import {
  applyFleetRiskPremiumResult,
  resolveSelectedTaxCodes,
} from '../utils/premiumAggregation';
import { buildFleetRiskPricingSignature } from '../utils/pricingStaleness';
import {
  isFleetMotorFactorCovered,
  resolveFleetFactorValues,
  type QuotationFactorContext,
} from '../utils/riskFactorResolver';
import {
  buildFleetCsvTemplate,
  parseFleetCsv,
  type FleetCsvRow,
} from '../utils/fleetCsvImport';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import {
  DISCOUNT_TYPE_OPTIONS,
  formatDiscountOptionLabel,
  formatRatePercent,
  getDiscountRateForType,
} from '../utils/taxOptions';
import { RiskTaxesFields } from '../components/RiskTaxesFields';
import { VehicleLookup } from '../components/VehicleLookup';
import { VehicleDetailsFields } from '../components/VehicleDetailsFields';
import { motorFields, motorFieldError } from '../utils/motorFields';
import { verificationsApi } from '@/modules/tenant/verifications/api';
import { readVerifiedMotorDetails } from '../utils/vehicleVerification';
import { toFleetMotorDetails } from '../utils/vehicleVerification';
import { ownerDefaultsFromPolicyholder } from '../utils/motorVehicleSelection';
import {
  buildDefaultCoverNoteDescription,
  buildDefaultOperativeClause,
} from '../utils/coverNoteText';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  riskOptions: InsuranceRisk[];
  vehicleOptions: MotorVehicleRecord[];
  productOptions?: { id: string; name?: string; product_name?: string }[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'fleet.items'>;
  onAddVehicle: () => void;
  onRemoveVehicle: (index: number) => void;
  onDuplicateVehicle: (index: number) => void;
  onImportVehicles: (rows: FleetCsvRow[]) => void;
  factorContext?: QuotationFactorContext;
}

function resolveFleetRequestedDiscount(
  discounts:
    | QuotationFormSchemaValues['fleet']['items'][number]['risks_covered'][number]['discounts_offered']
    | undefined,
) {
  const rateDiscount = (discounts ?? []).find(
    (discount) => Number(discount.discount_rate) > 0,
  );
  if (rateDiscount) return { rate: Number(rateDiscount.discount_rate) };

  const fixedDiscount = (discounts ?? []).find(
    (discount) => Number(discount.discount_amount) > 0,
  );
  if (fixedDiscount) {
    return { fixed_amount: Number(fixedDiscount.discount_amount) };
  }

  return undefined;
}

// Factors resolved from quotation context or vehicle details, never asked
// per vehicle.
const HIDDEN_FLEET_FACTOR_CODES = [
  'sum_insured',
  'payment_mode',
  'currency_code',
  'exchange_rate',
  'sale_point_code',
  'officer_name',
  'officer_title',
  'policy_holder_type',
];

function getVehicleIssues(
  item: QuotationFormSchemaValues['fleet']['items'][number],
): string[] {
  const issues: string[] = [];

  if (!item.cover_note_desc.trim())
    issues.push('Missing cover note description');
  if (!item.operative_clause.trim()) issues.push('Missing operative clause');
  if (
    item.risks_covered.length === 0 ||
    !item.risks_covered.some((risk) => risk.risk_code.trim())
  ) {
    issues.push('At least one risk is required');
  }
  if (
    !item.motor_dtl.registration_number.trim() &&
    item.motor_dtl.motor_type !== '2'
  ) {
    issues.push('Registration number is required for registered vehicles');
  }
  if (!item.motor_dtl.chassis_number.trim()) {
    issues.push('Vehicle chassis number is required');
  }
  if (!item.motor_dtl.make.trim() || !item.motor_dtl.model.trim()) {
    issues.push('Vehicle make and model are required');
  }

  const motor = Object.fromEntries(
    motorFields.map((field) => [
      field.key,
      item.motor_dtl[field.fleetKey as keyof typeof item.motor_dtl],
    ]),
  );
  motorFields.forEach((field) => {
    const error = motorFieldError(field.key, motor[field.key], motor);
    if (error) issues.push(error);
  });
  return [...new Set(issues)];
}

function buildFleetFailureMetadata(failure: MultiCalcFailure) {
  return {
    pricing_quote_id: null,
    validation_errors:
      failure.validation_errors.length > 0
        ? failure.validation_errors
        : [failure.message],
    validation_warnings: failure.validation_warnings,
  };
}

function resetFleetRiskPricing(
  row: QuotationFormSchemaValues['fleet']['items'][number]['risks_covered'][number],
) {
  return {
    ...row,
    factor_values: {},
    sum_insured_equivalent: '',
    premium_rate: '',
    premium_before_discount: '',
    premium_after_discount: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    discounts_offered: [createEmptyRiskDiscountRow()],
    // Keep the selected taxes when the cover changes. Clearing this array
    // causes RiskTaxesFields to restore defaults asynchronously; that can
    // change the pricing signature while the new risk is being priced and
    // cause the valid response to be discarded as stale.
    taxes_charged:
      row.taxes_charged.length > 0
        ? row.taxes_charged.map((tax) => ({ ...tax, tax_amount: '' }))
        : [createEmptyRiskTaxRow()],
    rating_result_metadata: null,
  };
}

function zeroFleetSumInsured(
  form: UseFormReturn<QuotationFormSchemaValues>,
  riskId: string,
) {
  form.getValues('fleet.items').forEach((item, vehicleIndex) => {
    item.risks_covered.forEach((risk, riskIndex) => {
      if (risk.risk_id !== riskId) return;
      const path =
        `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}` as const;
      if (risk.sum_insured !== '0')
        form.setValue(`${path}.sum_insured`, '0', { shouldDirty: true });
      if (risk.sum_insured_equivalent !== '0')
        form.setValue(`${path}.sum_insured_equivalent`, '0', {
          shouldDirty: true,
        });
      if (risk.factor_values.sum_insured !== 0)
        form.setValue(`${path}.factor_values.sum_insured`, 0, {
          shouldDirty: true,
        });
      form.clearErrors([
        `${path}.sum_insured`,
        `${path}.sum_insured_equivalent`,
      ]);
    });
  });
}

function FleetVehicleEditor({
  form,
  riskOptions,
  vehicleOptions,
  index,
  calculationErrorMessage,
  showVehicleValidationErrors,
  showSumInsured,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  vehicleOptions: MotorVehicleRecord[];
  index: number;
  calculationErrorMessage: string | null;
  showVehicleValidationErrors: boolean;
  showSumInsured: boolean;
}) {
  const addonArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.cover_note_addons`,
  });
  const [vehicleRevision, setVehicleRevision] = useState(0);
  const [wordingExpanded, setWordingExpanded] = useState(false);
  const item = form.watch(`fleet.items.${index}` as const);
  const coverNoteType = form.watch('cover_note_type');

  function fillFromExistingVehicle(vehicle: MotorVehicleRecord) {
    const prefix = `fleet.items.${index}.motor_dtl` as const;
    form.setValue(
      `${prefix}.motor_category`,
      vehicle.motor_category != null
        ? String(vehicle.motor_category)
        : (vehicle.vehicle_category ?? ''),
    );
    form.setValue(
      `${prefix}.motor_type`,
      vehicle.motor_type != null ? String(vehicle.motor_type) : '',
    );
    form.setValue(
      `${prefix}.registration_number`,
      normalizeMotorTextInput(vehicle.registration_no),
    );
    form.setValue(
      `${prefix}.chassis_number`,
      normalizeMotorTextInput(vehicle.chassis_no),
    );
    form.setValue(`${prefix}.make`, normalizeMotorTextInput(vehicle.make));
    form.setValue(`${prefix}.model`, normalizeMotorTextInput(vehicle.model));
    form.setValue(
      `${prefix}.model_number`,
      normalizeMotorTextInput(vehicle.model_no),
    );
    form.setValue(`${prefix}.body_type`, vehicle.body_type ?? '');
    form.setValue(`${prefix}.color`, vehicle.color ?? '');
    form.setValue(
      `${prefix}.engine_number`,
      normalizeMotorTextInput(vehicle.engine_no),
    );
    form.setValue(
      `${prefix}.engine_capacity`,
      vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '',
    );
    form.setValue(`${prefix}.fuel_used`, vehicle.fuel_type ?? '');
    form.setValue(
      `${prefix}.number_of_axles`,
      vehicle.number_of_axles != null ? String(vehicle.number_of_axles) : '',
    );
    form.setValue(`${prefix}.axle_distance`, vehicle.axle_distance ?? '');
    form.setValue(
      `${prefix}.sitting_capacity`,
      vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '',
    );
    form.setValue(
      `${prefix}.year_of_manufacture`,
      vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
    );
    form.setValue(`${prefix}.tare_weight`, vehicle.tare_weight ?? '');
    form.setValue(`${prefix}.gross_weight`, vehicle.gross_weight ?? '');
    form.setValue(
      `${prefix}.motor_usage`,
      vehicle.motor_usage != null
        ? String(vehicle.motor_usage)
        : vehicle.usage_type?.toLowerCase() === 'commercial'
          ? '2'
          : vehicle.usage_type?.toLowerCase() === 'private'
            ? '1'
            : '',
    );
    form.setValue(`${prefix}.owner_name`, vehicle.owner_name ?? '');
    form.setValue(
      `${prefix}.owner_category`,
      vehicle.owner_category != null ? String(vehicle.owner_category) : '',
    );
    form.setValue(`${prefix}.owner_address`, vehicle.owner_address ?? '');
  }

  const risk = item.risks_covered[0];
  const coverRisk = riskOptions.find(
    (option) => option.id === form.watch('fleet.header.cover.risk_id'),
  );
  const { data: requiredFactors = [] } = useQuery({
    queryKey: peKeys.requiredFactors.byRisk(coverRisk?.id ?? ''),
    queryFn: () => requiredFactorsApi.getByRisk(coverRisk!.id),
    enabled: !!coverRisk,
    staleTime: 30_000,
  });
  const requiresSumInsured = requiredFactors.some(
    (requiredFactor) => requiredFactor.factor.code === 'sum_insured',
  );
  const visibleRequiredFactors = requiredFactors.filter(
    (requiredFactor) =>
      !HIDDEN_FLEET_FACTOR_CODES.includes(requiredFactor.factor.code) &&
      !isFleetMotorFactorCovered(requiredFactor.factor.code),
  );
  const rowFactorValues =
    (risk?.factor_values as Record<string, PricingFactorValue> | undefined) ??
    {};
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <WizardSectionTitle className="text-sm font-semibold text-slate-900">
          Find or select a vehicle
        </WizardSectionTitle>
        <VehicleLookup
          initialCategory={item.motor_dtl.motor_category}
          onFound={(details) => {
            const current = form.getValues(`fleet.items.${index}.motor_dtl`);
            const same = details.chassis_no
              ? current.chassis_number === details.chassis_no
              : current.registration_number === details.registration_no;
            form.setValue(
              `fleet.items.${index}.motor_dtl`,
              {
                ...(same ? current : createEmptyFleetItemRow().motor_dtl),
                ...toFleetMotorDetails(details),
              },
              { shouldDirty: true, shouldValidate: true },
            );
            setVehicleRevision((value) => value + 1);
          }}
        />
        {vehicleOptions.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor={`fleet-saved-vehicle-${index}`}>
              Use a saved vehicle
            </Label>
            <Select
              onValueChange={(vehicleId) => {
                const vehicle = vehicleOptions.find(
                  (item) => item.id === vehicleId,
                );
                if (vehicle) {
                  fillFromExistingVehicle(vehicle);
                  setVehicleRevision((value) => value + 1);
                }
              }}
            >
              <SelectTrigger id={`fleet-saved-vehicle-${index}`}>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicleOptions.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration_no || vehicle.chassis_no || 'Vehicle'}{' '}
                    · {vehicle.make} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <VehicleDetailsFields
          key={vehicleRevision}
          form={form}
          fleetIndex={index}
          showErrorMessages={showVehicleValidationErrors}
        />
      </div>
      <div hidden={coverNoteType === '1'} className="space-y-3">
        <div hidden className="flex items-center justify-between gap-2">
          <WizardSectionTitle className="text-sm font-medium">
            Cover wording
          </WizardSectionTitle>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setWordingExpanded((previous) => !previous)}
          >
            {wordingExpanded ? 'Hide' : 'Edit wording'}
          </button>
        </div>
        {wordingExpanded ||
        showVehicleValidationErrors ||
        coverNoteType !== '1' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coverNoteType !== '1' && (
              <FormField
                control={form.control}
                name={`fleet.items.${index}.prev_cover_note_reference_number`}
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel>Previous cover reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </WizardFormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name={`fleet.items.${index}.cover_note_desc` as const}
              render={({ field }) => (
                <WizardFormItem className="hidden">
                  <FormLabel required>Cover Note Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.operative_clause` as const}
              render={({ field }) => (
                <WizardFormItem className="hidden">
                  <FormLabel required>Operative Clause</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
            {coverNoteType === '3' && (
              <>
                <FormField
                  control={form.control}
                  name={`fleet.items.${index}.endorsement_type` as const}
                  render={({ field }) => (
                    <WizardFormItem>
                      <FormLabel>Endorsement Type</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </WizardFormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.endorsement_premium_earned` as const
                  }
                  render={({ field }) => (
                    <WizardFormItem>
                      <FormLabel>Endorsement Premium Earned</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                    </WizardFormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`fleet.items.${index}.endorsement_reason` as const}
                  render={({ field }) => (
                    <WizardFormItem className="sm:col-span-2">
                      <FormLabel>Endorsement Reason</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                    </WizardFormItem>
                  )}
                />
              </>
            )}
          </div>
        ) : (
          <div hidden className="mt-2 space-y-1 text-sm text-slate-600">
            <p>{item.cover_note_desc || '—'}</p>
            <p className="text-slate-500">{item.operative_clause || '—'}</p>
          </div>
        )}
      </div>

      {(showSumInsured ||
        calculationErrorMessage ||
        visibleRequiredFactors.length > 0) && (
        <StepSection title="Premium" first contentClassName="space-y-3">
          {calculationErrorMessage ? (
            <PricingStatusAlert
              compact
              errorMessage={calculationErrorMessage}
            />
          ) : null}
          {showSumInsured && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name={
                  `fleet.items.${index}.risks_covered.0.sum_insured` as const
                }
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel required={requiresSumInsured}>
                      Sum Insured
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder={
                          requiresSumInsured ? undefined : 'Optional'
                        }
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          form.setValue(
                            `fleet.items.${index}.risks_covered.0.sum_insured_equivalent` as const,
                            event.target.value,
                          );
                        }}
                      />
                    </FormControl>
                  </WizardFormItem>
                )}
              />
            </div>
          )}

          {visibleRequiredFactors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Underwriting Details
              </p>
              <RatingFactorFields
                requiredFactors={visibleRequiredFactors}
                values={rowFactorValues}
                onChange={(code, value) =>
                  form.setValue(
                    `fleet.items.${index}.risks_covered.0.factor_values.${code}` as const,
                    value,
                  )
                }
              />
            </div>
          )}
        </StepSection>
      )}

      {/* Only offered once this vehicle has a premium rate above zero. */}
      {allowsAddons(item?.risks_covered?.[0]?.premium_rate) && (
        <div className="space-y-6">
          <StepSection
            title="Add-ons"
            first
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addonArray.append(createEmptyAddonRow())}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Add-on
              </Button>
            }
          >
            {addonArray.fields.length === 0 ? (
              <p className="text-sm text-slate-500">
                No add-ons for this vehicle yet.
              </p>
            ) : (
              addonArray.fields.map((field, addonIndex) => (
                <AddonRow
                  key={field.id}
                  form={form}
                  index={addonIndex}
                  basePath={`fleet.items.${index}.cover_note_addons`}
                  riskPath={`fleet.items.${index}.risks_covered.0`}
                  onRemove={addonArray.remove}
                  canRemove
                  exchangeRate={1}
                />
              ))
            )}
          </StepSection>
        </div>
      )}
    </div>
  );
}

type FleetItemValues = QuotationFormSchemaValues['fleet']['items'][number];

function summarizeFleetItem(item: FleetItemValues) {
  return {
    sumInsured: item.risks_covered.reduce(
      (sum, risk) => sum + (Number(risk.sum_insured) || 0),
      0,
    ),
    premium: item.risks_covered.reduce(
      (sum, risk) => sum + (Number(risk.premium_including_tax) || 0),
      0,
    ),
    issueCount: getVehicleIssues(item).length,
  };
}

function getFleetPricingSignature(values: QuotationFormSchemaValues) {
  return JSON.stringify(
    values.fleet.items.map((item) =>
      item.risks_covered.map((risk) =>
        buildFleetRiskPricingSignature({
          ...values,
          fleet_header: values.fleet.header,
          item,
          risk,
        }),
      ),
    ),
  );
}

// A fleet quotation starts with one blank vehicle row; until the user touches
// it the step shows the empty state instead of an unnamed incomplete vehicle.
function isBlankFleetItem(item: FleetItemValues) {
  const motor = item.motor_dtl;
  return (
    !motor.registration_number.trim() &&
    !motor.chassis_number.trim() &&
    !motor.make.trim() &&
    !motor.model.trim()
  );
}

function FleetVehicleStatus({ issueCount }: { issueCount: number }) {
  return (
    <span
      className={[
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        issueCount
          ? 'bg-amber-50 text-amber-700'
          : 'bg-emerald-50 text-emerald-700',
      ].join(' ')}
    >
      {issueCount
        ? `${issueCount} item${issueCount === 1 ? '' : 's'} missing`
        : 'Ready'}
    </span>
  );
}

function FleetVehicleTable({
  rows,
  currency,
  canRemove,
  lookupMessages,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  rows: { key: string; index: number; item: FleetItemValues }[];
  currency: string;
  canRemove: boolean;
  lookupMessages: Record<string, string>;
  onEdit: (index: number) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [needsAttention, setNeedsAttention] = useState(false);
  const filteredRows = rows.filter(({ item }) => {
    const motor = item.motor_dtl;
    const matches = [
      motor.registration_number,
      motor.chassis_number,
      motor.make,
      motor.model,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matches && (!needsAttention || getVehicleIssues(item).length > 0);
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / limit));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice(
    (currentPage - 1) * limit,
    currentPage * limit,
  );
  const summaries = rows.map(({ item }) => summarizeFleetItem(item));
  const totals = summaries.reduce(
    (acc, summary) => ({
      sumInsured: acc.sumInsured + summary.sumInsured,
      premium: acc.premium + summary.premium,
      ready: acc.ready + (summary.issueCount ? 0 : 1),
    }),
    { sumInsured: 0, premium: 0, ready: 0 },
  );

  const actions = (index: number) => (
    <div className="flex flex-nowrap items-center justify-end gap-1 [&_button]:h-9 [&_button]:w-9 [&_button]:p-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onEdit(index)}
        aria-label="Edit"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onDuplicate(index)}
        aria-label={`Duplicate vehicle ${index + 1}`}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-red-600 hover:text-red-700"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label="Remove"
        title={canRemove ? 'Remove' : 'A fleet needs at least one vehicle'}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Vehicles', String(rows.length)],
          ['Ready', `${totals.ready} of ${rows.length}`],
          ['Needs attention', String(rows.length - totals.ready)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search fleet vehicles"
          placeholder="Search registration, chassis, make or model"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="min-h-11 text-base sm:max-w-md sm:text-sm"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            style={{ minHeight: 16 }}
            checked={needsAttention}
            onChange={(event) => {
              setNeedsAttention(event.target.checked);
              setPage(1);
            }}
          />
          Needs attention only
        </label>
      </div>
      {filteredRows.length === 0 && (
        <p
          role="status"
          className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500"
        >
          No vehicles match. Clear your search or filter to see all vehicles.
        </p>
      )}
      {/* Tablet and desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Registration</th>
              <th className="px-3 py-2 font-medium">Make / model</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 text-right font-medium">Sum insured</th>
              <th className="px-3 py-2 text-right font-medium">Premium</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map(({ key, index, item }) => {
              const motor = item.motor_dtl;
              const summary = summarizeFleetItem(item);
              const message = lookupMessages[item.risks_covered[0]?.client_ref];
              return (
                <tr key={key}>
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">
                      {motor.registration_number || motor.chassis_number || '—'}
                    </p>
                    {message && (
                      <p role="status" className="text-xs text-slate-500">
                        {message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {[motor.make, motor.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {motor.year_of_manufacture || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(summary.sumInsured, currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(summary.premium, currency)}
                  </td>
                  <td className="px-3 py-2">
                    <FleetVehicleStatus issueCount={summary.issueCount} />
                  </td>
                  <td className="px-3 py-2">{actions(index)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-2 md:hidden">
        {visibleRows.map(({ key, index, item }) => {
          const motor = item.motor_dtl;
          const summary = summarizeFleetItem(item);
          const message = lookupMessages[item.risks_covered[0]?.client_ref];
          return (
            <li key={key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-slate-900">
                    {index + 1}.{' '}
                    {motor.registration_number || motor.chassis_number || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[motor.make, motor.model, motor.year_of_manufacture]
                      .filter(Boolean)
                      .join(' · ') || 'No vehicle details'}
                  </p>
                </div>
                <FleetVehicleStatus issueCount={summary.issueCount} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Sum insured</dt>
                  <dd className="tabular-nums text-slate-900">
                    {formatMoney(summary.sumInsured, currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Premium</dt>
                  <dd className="tabular-nums text-slate-900">
                    {formatMoney(summary.premium, currency)}
                  </dd>
                </div>
              </dl>
              {message && (
                <p role="status" className="mt-1 text-xs text-slate-500">
                  {message}
                </p>
              )}
              <div className="mt-2 border-t border-slate-100 pt-2">
                {actions(index)}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
        <label className="flex items-center gap-2">
          Per page
          <select
            aria-label="Vehicles per page"
            value={limit}
            className="min-h-11 rounded-md border bg-white px-2"
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span role="status">
          {filteredRows.length} vehicles · Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next page
          </Button>
        </div>
      </div>
    </div>
  );
}

type FleetRiskRow = FleetItemValues['risks_covered'][number];

/**
 * The parts of a risk row chosen once for the whole fleet. Rates and amounts
 * are left out: the backend rewrites them on every calculation, and comparing
 * them would re-sync rows the backend just priced.
 */
function fleetCoverSelectionKey(row: FleetRiskRow | undefined) {
  if (!row) return '';
  return JSON.stringify([
    row.risk_code.trim().toUpperCase(),
    row.risk_id,
    row.discounts_offered.map((discount) => [
      discount.discount_type,
      Number(discount.discount_rate) || 0,
    ]),
    row.taxes_charged.map((tax) => [tax.tax_code, tax.is_tax_exempted]),
  ]);
}

/** Copies the fleet cover onto a vehicle's risk row, keeping its own sum insured. */
function applyFleetCoverToRow(
  row: FleetRiskRow,
  cover: FleetRiskRow,
): FleetRiskRow {
  const sameRisk =
    row.risk_code.trim().toUpperCase() === cover.risk_code.trim().toUpperCase();
  const base = sameRisk
    ? row
    : {
        ...resetFleetRiskPricing(row),
        sum_insured: row.sum_insured,
        sum_insured_equivalent: row.sum_insured_equivalent,
      };
  return {
    ...base,
    risk_id: cover.risk_id,
    risk_code: cover.risk_code,
    discounts_offered: cover.discounts_offered.map((discount) => ({
      ...discount,
      discount_amount: '',
    })),
    taxes_charged: cover.taxes_charged.map((tax) => ({
      ...tax,
      tax_amount: '',
    })),
  };
}

/**
 * The single risk every vehicle in the fleet is covered under. Lives on the
 * first wizard step next to Product; the vehicles step applies it to each
 * vehicle (see the `fleet.header.cover` sync effect below).
 */
export function FleetRiskField({
  form,
  riskOptions,
  disabled,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="fleet.header.cover.risk_id"
      render={({ field }) => (
        <WizardFormItem>
          <FormLabel required>Risk</FormLabel>
          <Select
            value={toSelectValue(field.value)}
            disabled={disabled}
            onValueChange={(value) => {
              const nextRiskId = fromSelectValue(value);
              field.onChange(nextRiskId);
              form.setValue(
                'fleet.header.cover.risk_code',
                riskOptions.find((risk) => risk.id === nextRiskId)?.risk_code ??
                  '',
                { shouldDirty: true },
              );
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select risk" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
              {riskOptions.map((risk) => (
                <SelectItem key={risk.id} value={risk.id}>
                  {risk.risk_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </WizardFormItem>
      )}
    />
  );
}

/**
 * The fleet-wide discount and tax, collapsed to a one-line summary like the
 * motor wizard's risk row. Lives on the first wizard step with the risk; the
 * vehicles step applies it to every vehicle.
 */
export function FleetAdjustmentsFields({
  form,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
}) {
  const discountRows = form.watch('fleet.header.cover.discounts_offered') ?? [];
  const taxRows = form.watch('fleet.header.cover.taxes_charged') ?? [];
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  // Same collapsed summary as the motor wizard's risk row; a validation error
  // in the discount or tax keeps the fields open so it stays visible.
  const coverErrors = useFormState({
    control: form.control,
    name: [
      'fleet.header.cover.discounts_offered',
      'fleet.header.cover.taxes_charged',
    ] as const,
  }).errors.fleet?.header?.cover;
  const showAdjustments =
    adjustmentsOpen ||
    Boolean(coverErrors?.discounts_offered || coverErrors?.taxes_charged);
  const discountOption = DISCOUNT_TYPE_OPTIONS.find(
    (option) => option.value === discountRows[0]?.discount_type,
  );
  const adjustmentsSummary = [
    discountOption ? formatDiscountOptionLabel(discountOption) : 'No discount',
    taxRows.some((row) => row.is_tax_exempted)
      ? 'Tax exempted'
      : taxRows
          .filter((row) => row.tax_code)
          .map(
            (row) =>
              `${row.tax_code} ${formatRatePercent(row.tax_rate || '0')}%`,
          )
          .join(', ') || 'No tax',
  ].join(' · ');

  return (
    <div className="col-span-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm">
        <span className="text-slate-600">
          <span className="font-medium text-slate-800">Adjustments:</span>{' '}
          {adjustmentsSummary}
        </span>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          aria-expanded={showAdjustments}
          onClick={() => setAdjustmentsOpen((open) => !open)}
        >
          {showAdjustments ? 'Hide' : 'Change discount or tax'}
        </button>
      </div>
      <div
        className={
          showAdjustments
            ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
            : 'hidden'
        }
      >
        <FormField
          control={form.control}
          name="fleet.header.cover.discounts_offered.0.discount_type"
          render={() => (
            <WizardFormItem>
              <FormLabel>Discount Type</FormLabel>
              <Select
                value={toSelectValue(discountRows[0]?.discount_type)}
                onValueChange={(value) => {
                  const nextType = fromSelectValue(value);
                  form.setValue(
                    'fleet.header.cover.discounts_offered',
                    [
                      {
                        ...createEmptyRiskDiscountRow(),
                        ...(discountRows[0] ?? {}),
                        discount_type: nextType,
                        discount_rate: nextType
                          ? getDiscountRateForType(nextType)
                          : '',
                        discount_amount: '',
                      },
                    ],
                    { shouldDirty: true },
                  );
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="No discount" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>No discount</SelectItem>
                  {DISCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {formatDiscountOptionLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <RiskTaxesFields form={form} riskPath="fleet.header.cover" inline />
      </div>
    </div>
  );
}

/**
 * Fleet premium calculation, shared by the Vehicles step (automatic pricing
 * after a vehicle is saved or imported) and the Premium step (the Calculate
 * Fleet Premium action). Also keeps every vehicle on the fleet-wide cover.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFleetPremiumCalculation({
  form,
  riskOptions,
  factorContext,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  factorContext?: QuotationFactorContext;
}) {
  const queryClient = useQueryClient();
  const { calculateFleetMutation } = usePricingCalculator();
  const [fleetTotals, setFleetTotals] = useState<{
    signature: string;
    totals: PricingFleetTotals;
  } | null>(null);
  const [calculationErrorMessage, setCalculationErrorMessage] = useState<
    string | null
  >(null);

  const coverKey = fleetCoverSelectionKey(form.watch('fleet.header.cover'));
  const vehicleCoverKeys = form
    .watch('fleet.items')
    .map(
      (item) =>
        `${item.risks_covered.length}:${fleetCoverSelectionKey(item.risks_covered[0])}`,
    )
    .join('|');
  useEffect(() => {
    const cover = form.getValues('fleet.header.cover');
    const items = form.getValues('fleet.items');
    if (!cover.risk_code.trim()) {
      // Drafts saved before the fleet cover existed carry the risk per
      // vehicle; adopt the first vehicle's selection as the fleet cover.
      const seed = items.find((item) => item.risks_covered[0]?.risk_code.trim())
        ?.risks_covered[0];
      if (!seed) return;
      form.setValue('fleet.header.cover', {
        ...createEmptyFleetRiskRow(),
        risk_id: seed.risk_id,
        risk_code: seed.risk_code,
        discounts_offered: seed.discounts_offered,
        taxes_charged: seed.taxes_charged.map((tax) => ({
          ...tax,
          tax_amount: '',
        })),
      });
      return;
    }
    if (!cover.risk_id.trim()) {
      const resolved = riskOptions.find(
        (risk) => risk.risk_code === cover.risk_code,
      );
      if (resolved) form.setValue('fleet.header.cover.risk_id', resolved.id);
      return;
    }
    const key = fleetCoverSelectionKey(cover);
    items.forEach((item, index) => {
      const row = item.risks_covered[0];
      if (
        item.risks_covered.length === 1 &&
        fleetCoverSelectionKey(row) === key
      )
        return;
      form.setValue(
        `fleet.items.${index}.risks_covered`,
        [applyFleetCoverToRow(row ?? createEmptyFleetRiskRow(), cover)],
        { shouldDirty: true },
      );
    });
  }, [form, riskOptions, coverKey, vehicleCoverKeys]);

  async function calculateFleetPremiums(
    targetVehicleIndex?: number,
    silent = false,
  ) {
    const selectedRiskId = form.getValues('fleet.header.cover.risk_id').trim();
    let selectedRiskRate: number | undefined;
    if (selectedRiskId) {
      try {
        const explanation = await queryClient.fetchQuery({
          queryKey: ['pricing', 'explain', selectedRiskId],
          queryFn: () => pricingApi.explainRisk(selectedRiskId),
          staleTime: 30_000,
        });
        if (
          form.getValues('fleet.header.cover.risk_id').trim() !== selectedRiskId
        )
          return;
        selectedRiskRate = Number(explanation.percentage_rate);
        if (Number.isFinite(selectedRiskRate) && selectedRiskRate <= 0)
          zeroFleetSumInsured(form, selectedRiskId);
      } catch (error) {
        const message = getApiErrorMessage(error);
        setCalculationErrorMessage(message);
        if (!silent) toast.error(message);
        return;
      }
    }
    const fleetItems = form.getValues('fleet.items');
    const selectedVehicles =
      targetVehicleIndex == null
        ? fleetItems.map((item, index) => ({ item, index }))
        : fleetItems[targetVehicleIndex]
          ? [
              {
                item: fleetItems[targetVehicleIndex],
                index: targetVehicleIndex,
              },
            ]
          : [];

    if (selectedVehicles.length === 0) {
      toast.error(
        'Add at least one fleet vehicle before calculating premiums.',
      );
      return;
    }

    const fleetRisks = selectedVehicles.flatMap(
      ({ item, index: vehicleIndex }) =>
        item.risks_covered.map((risk, riskIndex) => ({
          vehicleIndex,
          riskIndex,
          row: risk,
          signature: buildFleetRiskPricingSignature({
            ...form.getValues(),
            fleet_header: form.getValues('fleet.header'),
            item,
            risk,
          }),
        })),
    );
    const unresolvedSelectionRows = fleetRisks.filter(
      ({ row }) => row.risk_code.trim() && !row.risk_id.trim(),
    );
    unresolvedSelectionRows.forEach(({ vehicleIndex, riskIndex, row }) => {
      form.setValue(
        `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}.rating_result_metadata`,
        buildFleetFailureMetadata({
          client_reference: row.client_ref,
          risk_id: null,
          status: 'FAILED',
          message:
            'Selected risk could not be resolved. Re-select the risk and try again.',
          validation_errors: [
            'Selected risk could not be resolved. Re-select the risk and try again.',
          ],
          validation_warnings: [],
          details: null,
        }),
      );
    });

    const coverRiskId = form.getValues('fleet.header.cover.risk_id').trim();
    const calculableRows = fleetRisks.filter(
      ({ row, vehicleIndex }) =>
        coverRiskId &&
        row.risk_id.trim() === coverRiskId &&
        (!silent || getVehicleIssues(fleetItems[vehicleIndex]).length === 0),
    );
    if (calculableRows.length === 0) {
      if (silent) return;
      toast.error('Select the fleet cover before calculating premiums.');
      return;
    }

    try {
      setCalculationErrorMessage(null);
      const uniqueRiskIds = [
        ...new Set(calculableRows.map(({ row }) => row.risk_id.trim())),
      ];
      const requiredFactorsEntries = await Promise.all(
        uniqueRiskIds.map(
          async (riskId): Promise<[string, RiskRequiredFactor[]]> => [
            riskId,
            await queryClient.fetchQuery<RiskRequiredFactor[]>({
              queryKey: peKeys.requiredFactors.byRisk(riskId),
              queryFn: () => requiredFactorsApi.getByRisk(riskId),
              staleTime: 30_000,
            }),
          ],
        ),
      );
      const requiredFactorsByRisk = new Map(requiredFactorsEntries);
      const missingSumInsuredRows = calculableRows.filter(
        ({ row }) =>
          Number(selectedRiskRate) > 0 &&
          (requiredFactorsByRisk.get(row.risk_id.trim()) ?? []).some(
            (requiredFactor) => requiredFactor.factor.code === 'sum_insured',
          ) &&
          (!Number.isFinite(Number(row.sum_insured)) ||
            Number(row.sum_insured) <= 0),
      );
      if (missingSumInsuredRows.length > 0) {
        const message =
          'Enter a sum insured greater than zero for each selected risk that requires it.';
        missingSumInsuredRows.forEach(({ vehicleIndex, riskIndex, row }) => {
          form.setValue(
            `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}.rating_result_metadata`,
            buildFleetFailureMetadata({
              client_reference: row.client_ref,
              risk_id: row.risk_id,
              status: 'INCOMPLETE',
              message,
              validation_errors: [message],
              validation_warnings: [],
              details: null,
            }),
          );
        });
        setCalculationErrorMessage(message);
        if (!silent) toast.error(message);
        return;
      }
      const cover = form.getValues('fleet.header.cover');
      const coverRequiredFactors =
        requiredFactorsByRisk.get(cover.risk_id.trim()) ?? [];
      const currencyCode =
        form.getValues('currency')?.trim().toUpperCase() || 'TZS';
      const response = await calculateFleetMutation.mutateAsync({
        risk_id: cover.risk_id.trim(),
        effective_date: dateOnlyPart(form.getValues('valid_from')),
        cover_start_date: dateOnlyPart(form.getValues('valid_from')),
        cover_end_date: pricingCoverEndDate(form.getValues('valid_until')),
        quotation_type: 'MOTOR',
        currency_code: currencyCode,
        exchange_rate:
          currencyCode === 'TZS'
            ? 1
            : Number(form.getValues('exchange_rate')) || 1,
        discount: resolveFleetRequestedDiscount(cover.discounts_offered),
        // Restrict charges to exactly the fleet's selected tax codes, not
        // every active company tax rule.
        tax_codes: resolveSelectedTaxCodes(cover.taxes_charged),
        vehicles: calculableRows.map(({ vehicleIndex, riskIndex, row }) => ({
          client_reference: row.client_ref,
          sum_insured: row.sum_insured.trim()
            ? Number(row.sum_insured)
            : undefined,
          factors: resolveFleetFactorValues(
            coverRequiredFactors,
            form.getValues(`fleet.items.${vehicleIndex}`),
            riskIndex,
            form.getValues(),
            factorContext,
          ),
        })),
      });
      const successByReference = new Map(
        response.risks
          .filter((risk) => !!risk.client_reference)
          .map((risk) => [risk.client_reference as string, risk]),
      );
      const failureByReference = new Map(
        response.failed_risks
          .filter((risk) => !!risk.client_reference)
          .map((risk) => [risk.client_reference as string, risk]),
      );

      calculableRows.forEach(({ vehicleIndex, riskIndex, row, signature }) => {
        const item = form.getValues(`fleet.items.${vehicleIndex}`);
        const current = item?.risks_covered[riskIndex];
        if (
          !current ||
          current.client_ref !== row.client_ref ||
          buildFleetRiskPricingSignature({
            ...form.getValues(),
            fleet_header: form.getValues('fleet.header'),
            item,
            risk: current,
          }) !== signature
        )
          return;
        const success = successByReference.get(row.client_ref);
        if (success) {
          const nextRow = applyFleetRiskPremiumResult(
            form.getValues(
              `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}`,
            ),
            success,
          );
          const currentItem = form.getValues(`fleet.items.${vehicleIndex}`);
          const pricingInputSignature = buildFleetRiskPricingSignature({
            quotation_type: form.getValues('quotation_type'),
            product_id: form.getValues('product_id'),
            valid_from: form.getValues('valid_from'),
            valid_until: form.getValues('valid_until'),
            currency: form.getValues('currency'),
            exchange_rate: form.getValues('exchange_rate'),
            fleet_header: form.getValues('fleet.header'),
            item: currentItem,
            risk: nextRow,
          });
          form.setValue(
            `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}`,
            {
              ...nextRow,
              rating_result_metadata: {
                ...nextRow.rating_result_metadata,
                pricing_status:
                  nextRow.rating_result_metadata?.pricing_status ??
                  'CALCULATED',
                pricing_input_signature: pricingInputSignature,
                pricing_is_stale: false,
                stale_reason: null,
              },
            },
          );
          return;
        }

        const failure = failureByReference.get(row.client_ref);
        if (failure) {
          form.setValue(
            `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}.rating_result_metadata`,
            buildFleetFailureMetadata(failure),
          );
        }
      });

      const calculatedSignature = getFleetPricingSignature(form.getValues());
      // Backend totals describe the whole fleet only when every vehicle was
      // priced together.
      setFleetTotals(
        targetVehicleIndex == null &&
          response.failed_risk_count === 0 &&
          calculableRows.length === fleetItems.length
          ? {
              signature: calculatedSignature,
              totals: response.fleet_totals,
            }
          : null,
      );

      const scopedLabel =
        targetVehicleIndex == null ? 'fleet risks' : 'vehicle risks';
      if (silent) return;
      if (response.failed_risk_count > 0) {
        toast.warning(
          `Calculated ${response.successful_risk_count} ${scopedLabel}; ${response.failed_risk_count} need attention.`,
        );
      } else {
        toast.success(
          `Calculated ${response.successful_risk_count} ${scopedLabel}.`,
        );
      }
    } catch (error) {
      const message = getApiErrorMessage(error);
      setCalculationErrorMessage(
        `Could not calculate fleet premiums: ${message}`,
      );
      if (!silent) toast.error(message);
    }
  }

  return {
    calculateFleetPremiums,
    isCalculating: calculateFleetMutation.isPending,
    calculationErrorMessage,
    fleetTotals,
  };
}

export function MotorFleetDetailsStep({
  form,
  customerOptions,
  riskOptions,
  vehicleOptions,
  productOptions = [],
  fieldArray,
  onAddVehicle,
  onRemoveVehicle,
  onDuplicateVehicle,
  onImportVehicles,
  factorContext,
}: Props) {
  const { fields } = fieldArray;
  const { calculateFleetPremiums, calculationErrorMessage } =
    useFleetPremiumCalculation({ form, riskOptions, factorContext });
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessages, setLookupMessages] = useState<Record<string, string>>(
    {},
  );
  const [importErrors, setImportErrors] = useState<string[]>([]);
  // Vehicle open in the editor dialog. A new vehicle is appended to the fleet
  // immediately so the editor can bind to it, and hidden from the list until
  // confirmed. An existing vehicle keeps a snapshot so Cancel can restore it.
  const [editingVehicle, setEditingVehicle] = useState<{
    index: number;
    isNew: boolean;
    /** Editing the untouched starter row, presented as adding a vehicle. */
    isFirstVehicle?: boolean;
    snapshot: FleetItemValues | null;
  } | null>(null);
  const [vehicleErrors, setVehicleErrors] = useState<string[]>([]);
  const [showVehicleValidationErrors, setShowVehicleValidationErrors] =
    useState(false);
  const selectedCustomerId = form.watch('customer_id');
  const policyholderMode = form.watch('policyholder_mode');
  const policyholder = form.watch('policyholder');
  const selectedCustomer = customerOptions.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const ownerDefaults = ownerDefaultsFromPolicyholder(
    { policyholder_mode: policyholderMode, policyholder },
    selectedCustomer,
  );
  const fleetValues = form.watch('fleet');
  const selectedFleetRiskId = form.watch('fleet.header.cover.risk_id');
  const ruleExplanation = usePricingExplanation(
    selectedFleetRiskId || undefined,
  );
  const currentRule =
    ruleExplanation.data?.risk_id === selectedFleetRiskId
      ? ruleExplanation.data
      : undefined;
  const showSumInsured = Boolean(
    currentRule && Number(currentRule.percentage_rate) > 0,
  );
  const fleetSumInsuredKey = JSON.stringify(
    fleetValues.items.map((item) =>
      item.risks_covered.map((risk) => [
        risk.risk_id,
        risk.sum_insured,
        risk.sum_insured_equivalent,
        risk.factor_values.sum_insured,
      ]),
    ),
  );
  useEffect(() => {
    // Unknown/loading/failed rule lookups must never erase entered values.
    if (
      !ruleExplanation.isSuccess ||
      !currentRule ||
      !Number.isFinite(Number(currentRule.percentage_rate)) ||
      Number(currentRule.percentage_rate) > 0
    )
      return;
    zeroFleetSumInsured(form, selectedFleetRiskId);
  }, [
    currentRule,
    fleetSumInsuredKey,
    form,
    ruleExplanation.isSuccess,
    selectedFleetRiskId,
  ]);
  const productId = form.watch('product_id');
  const validFrom = form.watch('valid_from');
  const validUntil = form.watch('valid_until');
  const product = productOptions.find((option) => option.id === productId);
  const productName = product?.product_name ?? product?.name;
  const sharedDescription = form.watch('cover_note_desc');
  const sharedClause = form.watch('operative_clause');
  const commonDescription = sharedDescription?.trim()
    ? sharedDescription
    : (buildDefaultCoverNoteDescription(productName, validFrom, validUntil) ??
      '');
  const commonClause = sharedClause?.trim()
    ? sharedClause
    : (buildDefaultOperativeClause(productName, validFrom, validUntil) ?? '');
  const generatedRef = useRef(
    new Map<
      string,
      {
        description: string;
        clause: string;
      }
    >(),
  );
  useEffect(() => {
    fleetValues.items.forEach((item, index) => {
      const key = item.risks_covered[0]?.client_ref ?? String(index);
      const previous = generatedRef.current.get(key);
      if (
        !item.cover_note_desc?.trim() ||
        item.cover_note_desc === previous?.description
      )
        if (item.cover_note_desc !== commonDescription)
          form.setValue(
            `fleet.items.${index}.cover_note_desc`,
            commonDescription,
          );
      if (
        !item.operative_clause?.trim() ||
        item.operative_clause === previous?.clause
      )
        if (item.operative_clause !== commonClause)
          form.setValue(`fleet.items.${index}.operative_clause`, commonClause);
      if (item.fleet_entry !== String(index + 1))
        form.setValue(`fleet.items.${index}.fleet_entry`, String(index + 1));
      generatedRef.current.set(key, {
        description: commonDescription,
        clause: commonClause,
      });
    });
  }, [form, fields, fleetValues, commonDescription, commonClause]);
  async function lookupFleetVehicles() {
    if (lookupPending) return;
    setLookupPending(true);
    const queue = form
      .getValues('fleet.items')
      .map((item) => ({ item, key: item.risks_covered[0]?.client_ref ?? '' }));
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const { item, key } = queue[cursor++];
        const motor = item.motor_dtl;
        if (!motor.registration_number && !motor.chassis_number) {
          setLookupMessages((current) => ({
            ...current,
            [key]: 'Enter a registration or chassis number.',
          }));
          continue;
        }
        try {
          const category = motor.motor_category === '2' ? 2 : 1;
          const result = await verificationsApi.motor({
            motorCategory: category,
            ...(motor.registration_number
              ? { motorRegistrationNumber: motor.registration_number }
              : { motorChassisNumber: motor.chassis_number }),
          });
          const details = readVerifiedMotorDetails(
            result,
            String(category) as '1' | '2',
          );
          const index = form
            .getValues('fleet.items')
            .findIndex((row) => row.risks_covered[0]?.client_ref === key);
          if (index < 0) continue;
          const current = form.getValues(`fleet.items.${index}.motor_dtl`);
          if (
            current.registration_number !== motor.registration_number ||
            current.chassis_number !== motor.chassis_number
          )
            continue;
          if (details) {
            form.setValue(
              `fleet.items.${index}.motor_dtl`,
              { ...current, ...toFleetMotorDetails(details) },
              { shouldDirty: true, shouldValidate: true },
            );
            setLookupMessages((messages) => ({
              ...messages,
              [key]: 'Vehicle details fetched.',
            }));
          } else
            setLookupMessages((messages) => ({
              ...messages,
              [key]:
                result.status === 'PENDING'
                  ? 'Verification pending. Retry shortly.'
                  : 'Vehicle not found. Complete the details manually.',
            }));
        } catch (error) {
          setLookupMessages((messages) => ({
            ...messages,
            [key]: getApiErrorMessage(error),
          }));
        }
      }
    };
    try {
      await Promise.all([worker(), worker(), worker()]);
    } finally {
      setLookupPending(false);
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([buildFleetCsvTemplate()], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fleet-vehicles-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Append rows (replacing the untouched starter row) and fetch from TIRA. */
  function importVehicles(rows: FleetCsvRow[]) {
    if (showEmptyState && fields.length === 1) fieldArray.remove(0);
    onImportVehicles(rows);
    void lookupFleetVehicles().then(() =>
      calculateFleetPremiums(undefined, true),
    );
  }

  async function handleCsvFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const { rows, errors } = parseFleetCsv(text);
    setImportErrors(errors);

    if (rows.length > 0) {
      importVehicles(rows);
      toast.success(
        `Imported ${rows.length} vehicle${rows.length === 1 ? '' : 's'} from CSV.`,
      );
    }
    if (errors.length > 0) {
      const shown = errors.slice(0, 5).join(' ');
      const more = errors.length > 5 ? ` (+${errors.length - 5} more)` : '';
      toast.error(`${errors.length} row(s) skipped: ${shown}${more}`);
    }
  }
  useEffect(() => {
    form.setValue('fleet.header.fleet_size', String(fields.length || 0));
  }, [fields.length, form]);

  const values = form.watch();
  // Pricing is requested by explicit vehicle save/import or the fleet calculation action.
  // Input edits and step navigation only invalidate the existing pricing signature.
  const currency = values.currency?.trim().toUpperCase() || 'TZS';
  const showEmptyState =
    fields.length === 0 ||
    (fields.length === 1 &&
      !editingVehicle &&
      isBlankFleetItem(values.fleet.items[0]));
  const tableRows = showEmptyState
    ? []
    : fields.flatMap((field, index) =>
        editingVehicle?.isNew && index === editingVehicle.index
          ? []
          : [{ key: field.id, index, item: values.fleet.items[index] }],
      );

  function openNewVehicleDialog() {
    setVehicleErrors([]);
    setShowVehicleValidationErrors(false);
    // Fill the untouched starter row rather than appending a second vehicle;
    // Cancel restores it from the snapshot.
    if (showEmptyState && fields.length === 1) {
      applyNewVehicleOwnerDefaults(0);
      openEditVehicleDialog(0, true);
      return;
    }
    const index = fields.length;
    onAddVehicle();
    applyNewVehicleOwnerDefaults(index);
    form.clearErrors(`fleet.items.${index}`);
    setEditingVehicle({ index, isNew: true, snapshot: null });
  }

  function applyNewVehicleOwnerDefaults(index: number) {
    const path = `fleet.items.${index}.motor_dtl` as const;
    const defaults = ownerDefaults ?? {
      owner_name: '',
      owner_category: '1',
      owner_address: '',
    };
    (['owner_name', 'owner_category', 'owner_address'] as const).forEach(
      (key) => {
        form.setValue(`${path}.${key}`, defaults[key], {
          shouldDirty: false,
          shouldValidate: false,
        });
      },
    );
  }

  function openEditVehicleDialog(index: number, isFirstVehicle = false) {
    setVehicleErrors([]);
    setShowVehicleValidationErrors(false);
    // A previous wizard validation can leave errors on this vehicle while its
    // editor is closed. Start each editing session clean and show them again
    // only after the user tries to add/save the vehicle.
    form.clearErrors(`fleet.items.${index}`);
    const ownerPath = `fleet.items.${index}.motor_dtl` as const;
    const ownerValues = form.getValues(ownerPath);
    if (ownerDefaults) {
      (['owner_name', 'owner_category', 'owner_address'] as const).forEach(
        (key) => {
          if (!ownerValues[key]) {
            form.setValue(`${ownerPath}.${key}`, ownerDefaults[key], {
              shouldDirty: false,
              shouldValidate: false,
            });
          }
        },
      );
    }
    setEditingVehicle({
      index,
      isNew: false,
      isFirstVehicle,
      snapshot: structuredClone(form.getValues(`fleet.items.${index}`)),
    });
  }

  function cancelVehicleDialog() {
    if (!editingVehicle) return;
    if (editingVehicle.isNew) {
      // Drop the draft directly: onRemoveVehicle asks for confirmation and
      // keeps the last vehicle, neither of which applies to an unsaved draft.
      fieldArray.remove(editingVehicle.index);
    } else if (editingVehicle.snapshot) {
      form.setValue(
        `fleet.items.${editingVehicle.index}`,
        editingVehicle.snapshot,
      );
    }
    form.clearErrors(`fleet.items.${editingVehicle.index}`);
    setVehicleErrors([]);
    setEditingVehicle(null);
  }

  function focusVehicleIssue(issue: string) {
    if (!editingVehicle) return;
    const item = form.getValues(`fleet.items.${editingVehicle.index}`);
    const motor = Object.fromEntries(
      motorFields.map((field) => [
        field.key,
        item.motor_dtl[field.fleetKey as keyof typeof item.motor_dtl],
      ]),
    );
    const definition = motorFields.find(
      (field) => motorFieldError(field.key, motor[field.key], motor) === issue,
    );
    let field = definition ? 'motor_dtl.' + definition.fleetKey : '';
    if (issue.includes('cover note description')) field = 'cover_note_desc';
    else if (issue.includes('operative clause')) field = 'operative_clause';
    else if (issue.startsWith('Registration number'))
      field = 'motor_dtl.registration_number';
    else if (issue.startsWith('Vehicle chassis'))
      field = 'motor_dtl.chassis_number';
    else if (issue.startsWith('Vehicle make'))
      field = !item.motor_dtl.make ? 'motor_dtl.make' : 'motor_dtl.model';
    if (field)
      form.setFocus(
        `fleet.items.${editingVehicle.index}.${field}` as FieldPath<QuotationFormSchemaValues>,
      );
    else
      document
        .getElementById('fleet-vehicle-editor')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function confirmVehicleDialog() {
    if (!editingVehicle) return;
    setShowVehicleValidationErrors(true);
    const path = `fleet.items.${editingVehicle.index}` as const;
    const item = form.getValues(path);
    if (!item.cover_note_desc?.trim() && commonDescription)
      form.setValue(`${path}.cover_note_desc`, commonDescription, {
        shouldDirty: true,
      });
    if (!item.operative_clause?.trim() && commonClause)
      form.setValue(`${path}.operative_clause`, commonClause, {
        shouldDirty: true,
      });
    const fieldsValid = await form.trigger(path, { shouldFocus: true });
    // The schema checks fleet items in a root-level refinement, which Zod
    // skips while another step has invalid fields, so re-check here too.
    const issues = getVehicleIssues(form.getValues(path));
    if (fieldsValid && issues.length === 0) {
      setVehicleErrors([]);
      setEditingVehicle(null);
      void calculateFleetPremiums(undefined, true);
      return;
    }
    setVehicleErrors(
      issues.length > 0
        ? issues
        : ['Some fields need correction. Review the highlighted fields.'],
    );
  }

  const dialogTitle =
    editingVehicle?.isNew || editingVehicle?.isFirstVehicle
      ? 'Add Vehicle'
      : `Edit Vehicle ${(editingVehicle?.index ?? 0) + 1}`;

  return (
    <>
      <StepSection
        title="Vehicles"
        description={
          showEmptyState
            ? undefined
            : `${tableRows.length} vehicle${tableRows.length === 1 ? '' : 's'} in this fleet`
        }
        action={
          <>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleCsvFileSelected(event)}
            />
            {/* The empty state offers its own start options. */}
            {!showEmptyState && (
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  type="button"
                  className="col-span-2 min-h-11 sm:col-span-1"
                  onClick={openNewVehicleDialog}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add vehicle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={handleDownloadTemplate}
                  title="Download CSV template"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download template
                </Button>
              </div>
            )}
          </>
        }
        contentClassName="space-y-3"
      >
        {importErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 p-3 text-sm text-red-600"
          >
            <p>Rows needing correction</p>
            {importErrors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
        {showEmptyState ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center sm:px-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-slate-200">
              <Truck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              Add the vehicles in this fleet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Add vehicles one at a time, or import many at once from a CSV
              file. Each vehicle is priced as soon as it is saved.
            </p>
            <div className="mx-auto mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    icon: Plus,
                    title: 'Add a vehicle',
                    hint: 'Enter the details yourself',
                    onClick: openNewVehicleDialog,
                  },
                  {
                    icon: Upload,
                    title: 'Import from CSV',
                    hint: 'Upload many vehicles at once',
                    onClick: () => csvInputRef.current?.click(),
                  },
                ] as const
              ).map(({ icon: Icon, title, hint, onClick }) => (
                <button
                  key={title}
                  type="button"
                  onClick={onClick}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {title}
                    </span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CSV template
            </button>
          </div>
        ) : (
          <FleetVehicleTable
            rows={tableRows}
            currency={currency}
            canRemove={fields.length > 1}
            lookupMessages={lookupMessages}
            onEdit={(index) => openEditVehicleDialog(index)}
            onDuplicate={onDuplicateVehicle}
            onRemove={onRemoveVehicle}
          />
        )}
      </StepSection>

      <Dialog
        open={editingVehicle !== null}
        onOpenChange={(open) => {
          if (!open) cancelVehicleDialog();
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[100dvh] sm:h-auto max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] max-sm:inset-0 max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
            <DialogTitle className="pr-6 break-words">
              {dialogTitle}
              {editingVehicle &&
              (form.getValues(
                `fleet.items.${editingVehicle.index}.motor_dtl.registration_number`,
              ) ||
                form.getValues(
                  `fleet.items.${editingVehicle.index}.motor_dtl.chassis_number`,
                ))
                ? ' · ' +
                  (form.getValues(
                    `fleet.items.${editingVehicle!.index}.motor_dtl.registration_number`,
                  ) ||
                    form.getValues(
                      `fleet.items.${editingVehicle!.index}.motor_dtl.chassis_number`,
                    ))
                : ''}
            </DialogTitle>
          </DialogHeader>
          <div
            id="fleet-vehicle-editor"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 [&_input]:min-h-11 [&_input]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_textarea]:text-sm"
          >
            {editingVehicle && (
              <FleetVehicleEditor
                form={form}
                riskOptions={riskOptions}
                vehicleOptions={vehicleOptions}
                index={editingVehicle.index}
                calculationErrorMessage={
                  calculationErrorMessage ??
                  (ruleExplanation.isError
                    ? 'Could not load the selected risk rate. Try calculating again.'
                    : null)
                }
                showVehicleValidationErrors={showVehicleValidationErrors}
                showSumInsured={showSumInsured}
              />
            )}
          </div>
          <div className="space-y-3 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {vehicleErrors.length > 0 && (
              <div
                role="alert"
                className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <p className="font-medium">This vehicle can't be saved yet:</p>
                <ul className="mt-1 list-disc pl-5">
                  {vehicleErrors.map((error) => (
                    <li key={error}>
                      <button
                        type="button"
                        className="py-1 text-left underline underline-offset-2"
                        onClick={() => focusVehicleIssue(error)}
                      >
                        {error}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={cancelVehicleDialog}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void confirmVehicleDialog()}>
                {editingVehicle?.isNew || editingVehicle?.isFirstVehicle
                  ? 'Add vehicle'
                  : 'Save vehicle'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
