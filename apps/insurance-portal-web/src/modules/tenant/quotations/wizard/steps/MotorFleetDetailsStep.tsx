import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFieldArray,
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
import { createBrowserSafeId } from '@/lib/ids';
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
import {
  dateOnlyPart,
  pricingCoverEndDate,
} from '../utils/coverNoteDateRange';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import {
  PricingStatusAlert,
  RatingFactorFields,
  readPricingQuoteMetadata,
  usePricingCalculator,
  type PricingFactorValue,
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
  recomputeFleetRiskRow,
  resolveSelectedTaxCodes,
  toNumber,
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
  getDiscountRateForType,
} from '../utils/taxOptions';
import { RiskTaxesFields } from '../components/RiskTaxesFields';
import { VehicleLookup } from '../components/VehicleLookup';
import { VehicleDetailsFields } from '../components/VehicleDetailsFields';
import { motorFields, motorFieldError } from '../utils/motorFields';
import { verificationsApi } from '@/modules/tenant/verifications/api';
import { readVerifiedMotorDetails } from '../utils/vehicleVerification';
import { toFleetMotorDetails } from '../utils/vehicleVerification';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  riskOptions: InsuranceRisk[];
  vehicleOptions: MotorVehicleRecord[];
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
    item.subject_matters_covered.length === 0 ||
    !item.subject_matters_covered.some(
      (subject) =>
        subject.subject_matter_reference.trim() &&
        subject.subject_matter_desc.trim(),
    )
  ) {
    issues.push('At least one subject matter is required');
  }
  if (
    !item.motor_dtl.registration_number.trim() &&
    !item.motor_dtl.chassis_number.trim()
  ) {
    issues.push('Vehicle registration or chassis number is required');
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
    taxes_charged: [createEmptyRiskTaxRow()],
    rating_result_metadata: null,
  };
}

function FleetVehicleEditor({
  form,
  riskOptions,
  vehicleOptions,
  index,
  isCalculating,
  calculationErrorMessage,
  onCalculateVehicle,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  vehicleOptions: MotorVehicleRecord[];
  index: number;
  isCalculating: boolean;
  calculationErrorMessage: string | null;
  onCalculateVehicle: (index: number) => void;
}) {
  const riskArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.risks_covered`,
  });
  const subjectArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.subject_matters_covered`,
  });
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

  const riskIds = useMemo(
    () => [
      ...new Set(
        item.risks_covered
          .map((risk) => risk.risk_id.trim())
          .filter((riskId) => riskId.length > 0),
      ),
    ],
    [item.risks_covered],
  );
  const requiredFactorsQueries = useQueries({
    queries: riskIds.map((riskId) => ({
      queryKey: peKeys.requiredFactors.byRisk(riskId),
      queryFn: () => requiredFactorsApi.getByRisk(riskId),
      staleTime: 30_000,
    })),
  });
  const requiredFactorsByRiskId = useMemo(() => {
    const map = new Map<string, RiskRequiredFactor[]>();
    riskIds.forEach((riskId, queryIndex) => {
      map.set(riskId, requiredFactorsQueries[queryIndex]?.data ?? []);
    });
    return map;
  }, [riskIds, requiredFactorsQueries]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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
        />
      </div>
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Cover wording</p>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setWordingExpanded((previous) => !previous)}
          >
            {wordingExpanded ? 'Hide' : 'Edit wording'}
          </button>
        </div>
        {wordingExpanded ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <WizardFormItem>
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
                <WizardFormItem>
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
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>{item.cover_note_desc || '—'}</p>
            <p className="text-slate-500">{item.operative_clause || '—'}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">
            Cover &amp; premium
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onCalculateVehicle(index)}
              disabled={isCalculating}
            >
              Calculate Vehicle Premiums
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                riskArray.append({
                  client_ref: createBrowserSafeId(),
                  risk_id: '',
                  risk_code: '',
                  factor_values: {},
                  sum_insured: '',
                  sum_insured_equivalent: '',
                  premium_rate: '',
                  premium_before_discount: '',
                  premium_after_discount: '',
                  premium_excluding_tax_equivalent: '',
                  premium_including_tax: '',
                  discounts_offered: [createEmptyRiskDiscountRow()],
                  taxes_charged: [createEmptyRiskTaxRow()],
                  rating_result_metadata: null,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Risk
            </Button>
          </div>
        </div>
        {calculationErrorMessage ? (
          <PricingStatusAlert compact errorMessage={calculationErrorMessage} />
        ) : null}
        {riskArray.fields.map((field, riskIndex) => {
          const discountRows =
            form.watch(
              `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
            ) ?? [];
          const taxRows =
            form.watch(
              `fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged` as const,
            ) ?? [];
          const premiumAfterDiscount = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.premium_after_discount` as const,
          );
          const premiumExcludingTax = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.premium_excluding_tax_equivalent` as const,
          );
          const premiumIncludingTax = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.premium_including_tax` as const,
          );
          const totalDiscount = discountRows.reduce(
            (sum, row) => sum + toNumber(row.discount_amount),
            0,
          );
          const totalTax = taxRows.reduce(
            (sum, row) => sum + toNumber(row.tax_amount),
            0,
          );
          const currencyCode = form.watch('currency')?.trim().toUpperCase();
          const ratingMetadata = readPricingQuoteMetadata(
            form.watch(
              `fleet.items.${index}.risks_covered.${riskIndex}.rating_result_metadata` as const,
            ),
          );
          const riskId = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.risk_id` as const,
          );
          const riskCode = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.risk_code` as const,
          );
          const selectedRisk =
            riskOptions.find((risk) => risk.id === riskId) ??
            riskOptions.find((risk) => risk.risk_code === riskCode);
          const rowFactorValues =
            (form.watch(
              `fleet.items.${index}.risks_covered.${riskIndex}.factor_values` as const,
            ) as Record<string, PricingFactorValue> | undefined) ?? {};
          const requiresSumInsured = (
            requiredFactorsByRiskId.get(riskId.trim()) ?? []
          ).some(
            (requiredFactor) => requiredFactor.factor.code === 'sum_insured',
          );
          const visibleRequiredFactors = (
            requiredFactorsByRiskId.get(riskId.trim()) ?? []
          ).filter(
            (requiredFactor) =>
              ![
                'sum_insured',
                'payment_mode',
                'currency_code',
                'exchange_rate',
                'sale_point_code',
                'officer_name',
                'officer_title',
                'policy_holder_type',
              ].includes(requiredFactor.factor.code) &&
              !isFleetMotorFactorCovered(requiredFactor.factor.code),
          );

          return (
            <StepSection
              key={field.client_ref || riskIndex}
              variant="item"
              className="bg-slate-50/50"
              title={
                <>
                  Risk #{riskIndex + 1}{' '}
                  {selectedRisk?.risk_name ? (
                    <span className="text-slate-500">
                      {selectedRisk.risk_name}
                    </span>
                  ) : null}
                </>
              }
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => riskArray.remove(riskIndex)}
                  disabled={riskArray.fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.risks_covered.${riskIndex}.risk_id` as const
                  }
                  render={({ field }) => (
                    <WizardFormItem>
                      <FormLabel required>Risk</FormLabel>
                      <Select
                        value={toSelectValue(field.value)}
                        onValueChange={(value) => {
                          const nextRiskId = fromSelectValue(value);
                          const selectedRisk =
                            riskOptions.find(
                              (risk) => risk.id === nextRiskId,
                            ) ?? null;
                          field.onChange(nextRiskId);
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}.risk_code`,
                            selectedRisk?.risk_code ?? '',
                          );
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}`,
                            {
                              ...resetFleetRiskPricing(
                                form.getValues(
                                  `fleet.items.${index}.risks_covered.${riskIndex}`,
                                ),
                              ),
                              risk_code: selectedRisk?.risk_code ?? '',
                              risk_id: nextRiskId,
                            },
                          );
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select risk" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE_VALUE}>
                            None
                          </SelectItem>
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
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.risks_covered.${riskIndex}.sum_insured` as const
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
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);
                            form.setValue(
                              `fleet.items.${index}.risks_covered.${riskIndex}.sum_insured_equivalent` as const,
                              event.target.value,
                            );
                          }}
                        />
                      </FormControl>
                    </WizardFormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.0.discount_type` as const
                  }
                  render={() => (
                    <WizardFormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select
                        value={toSelectValue(discountRows[0]?.discount_type)}
                        onValueChange={(value) => {
                          const nextType = fromSelectValue(value);
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
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
                          );
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No discount" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE_VALUE}>
                            No discount
                          </SelectItem>
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
                <RiskTaxesFields
                  form={form}
                  riskPath={`fleet.items.${index}.risks_covered.${riskIndex}`}
                  inline
                />
              </div>

              <PricingStatusAlert
                compact
                isPending={isCalculating}
                minimumAmount={ratingMetadata?.minimum_amount}
                metadata={ratingMetadata}
                showQuoteMetadata={false}
              />

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
                        `fleet.items.${index}.risks_covered.${riskIndex}.factor_values.${code}` as const,
                        value,
                      )
                    }
                  />
                </div>
              )}
              <dl className="col-span-full grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:grid-cols-4">
                {totalDiscount > 0 && (
                  <div>
                    <dt className="text-xs">Discount</dt>
                    <dd>{formatMoney(totalDiscount, currencyCode)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs">Premium excl. tax</dt>
                  <dd>
                    {formatMoney(toNumber(premiumExcludingTax), currencyCode)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs">Tax</dt>
                  <dd>{formatMoney(totalTax, currencyCode)}</dd>
                </div>
                <div>
                  <dt className="text-xs">Total premium</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatMoney(
                      toNumber(premiumIncludingTax) ||
                        toNumber(premiumAfterDiscount) + totalTax,
                      currencyCode,
                    )}
                  </dd>
                </div>
              </dl>
            </StepSection>
          );
        })}
      </div>

      <div className="space-y-6">
        <StepSection
          first
          title="Insured items"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                subjectArray.append({
                  subject_matter_reference: '',
                  subject_matter_desc: '',
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          }
          contentClassName="space-y-1"
        >
          {subjectArray.fields.map((field, subjectIndex) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name={
                  `fleet.items.${index}.subject_matters_covered.${subjectIndex}.subject_matter_reference` as const
                }
                render={({ field }) => (
                  <WizardFormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </WizardFormItem>
                )}
              />
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.subject_matters_covered.${subjectIndex}.subject_matter_desc` as const
                  }
                  render={({ field }) => (
                    <WizardFormItem className="flex-1">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </WizardFormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => subjectArray.remove(subjectIndex)}
                  disabled={subjectArray.fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </StepSection>

        <StepSection
          title="Add-ons"
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
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onEdit(index)}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit
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
        title={canRemove ? undefined : 'A fleet needs at least one vehicle'}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Remove
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Vehicles', String(rows.length)],
          ['Ready', `${totals.ready} of ${rows.length}`],
          ['Total sum insured', formatMoney(totals.sumInsured, currency)],
          ['Total premium', formatMoney(totals.premium, currency)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

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
            {rows.map(({ key, index, item }, rowIndex) => {
              const motor = item.motor_dtl;
              const summary = summaries[rowIndex];
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
        {rows.map(({ key, index, item }, rowIndex) => {
          const motor = item.motor_dtl;
          const summary = summaries[rowIndex];
          const message = lookupMessages[item.risks_covered[0]?.client_ref];
          return (
            <li key={key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
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
    </div>
  );
}

export function MotorFleetDetailsStep({
  form,
  riskOptions,
  vehicleOptions,
  fieldArray,
  onAddVehicle,
  onRemoveVehicle,
  onDuplicateVehicle,
  onImportVehicles,
  factorContext,
}: Props) {
  const { fields } = fieldArray;
  const queryClient = useQueryClient();
  const { calculateMultiMutation } = usePricingCalculator();
  const [calculationErrorMessage, setCalculationErrorMessage] = useState<
    string | null
  >(null);
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
  const fleetValues = form.watch('fleet');
  const commonDescription = form.watch('cover_note_desc');
  const commonClause = form.watch('operative_clause');
  const generatedRef = useRef(
    new Map<
      string,
      {
        description: string;
        clause: string;
        reference: string;
        subject: string;
      }
    >(),
  );
  useEffect(() => {
    fleetValues.items.forEach((item, index) => {
      const key = item.risks_covered[0]?.client_ref ?? String(index);
      const previous = generatedRef.current.get(key);
      const reference =
        item.motor_dtl.registration_number || item.motor_dtl.chassis_number;
      const subject = [item.motor_dtl.make, item.motor_dtl.model]
        .filter(Boolean)
        .join(' ');
      if (
        !item.cover_note_desc ||
        item.cover_note_desc === previous?.description
      )
        if (item.cover_note_desc !== commonDescription)
          form.setValue(
            `fleet.items.${index}.cover_note_desc`,
            commonDescription,
          );
      if (!item.operative_clause || item.operative_clause === previous?.clause)
        if (item.operative_clause !== commonClause)
          form.setValue(`fleet.items.${index}.operative_clause`, commonClause);
      const first = item.subject_matters_covered[0];
      if (
        first &&
        (!first.subject_matter_reference ||
          first.subject_matter_reference === previous?.reference) &&
        first.subject_matter_reference !== reference
      )
        form.setValue(
          `fleet.items.${index}.subject_matters_covered.0.subject_matter_reference`,
          reference,
        );
      if (
        first &&
        (!first.subject_matter_desc ||
          first.subject_matter_desc === previous?.subject) &&
        first.subject_matter_desc !== subject
      )
        form.setValue(
          `fleet.items.${index}.subject_matters_covered.0.subject_matter_desc`,
          subject,
        );
      if (item.fleet_entry !== String(index + 1))
        form.setValue(`fleet.items.${index}.fleet_entry`, String(index + 1));
      generatedRef.current.set(key, {
        description: commonDescription,
        clause: commonClause,
        reference,
        subject,
      });
    });
  }, [form, fleetValues, commonDescription, commonClause]);
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

  async function handleCsvFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const { rows, errors } = parseFleetCsv(text);
    setImportErrors(errors);

    if (rows.length > 0) {
      onImportVehicles(rows);
      void lookupFleetVehicles();
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

  async function calculateFleetPremiums(
    targetVehicleIndex?: number,
    silent = false,
  ) {
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

    const calculableRows = fleetRisks.filter(
      ({ row, vehicleIndex }) =>
        row.risk_id.trim() &&
        (!silent || getVehicleIssues(fleetItems[vehicleIndex]).length === 0),
    );
    if (calculableRows.length === 0) {
      if (silent) return;
      toast.error(
        'Select at least one valid fleet risk before calculating premiums.',
      );
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
      const request = {
        effective_date: dateOnlyPart(form.getValues('valid_from')),
        quotation_type: 'MOTOR',
        currency_code:
          form.getValues('currency')?.trim().toUpperCase() || 'TZS',
        exchange_rate:
          (form.getValues('currency')?.trim().toUpperCase() || 'TZS') === 'TZS'
            ? 1
            : Number(form.getValues('exchange_rate')) || 1,
        risks: calculableRows.map(({ vehicleIndex, riskIndex, row }) => {
          const requiredFactors =
            requiredFactorsByRisk.get(row.risk_id.trim()) ?? [];
          const item = form.getValues(`fleet.items.${vehicleIndex}`);

          return {
            client_reference: row.client_ref,
            risk_id: row.risk_id.trim(),
            sum_insured: row.sum_insured.trim()
              ? Number(row.sum_insured)
              : undefined,
            cover_start_date: dateOnlyPart(form.getValues('valid_from')),
            cover_end_date: pricingCoverEndDate(form.getValues('valid_until')),
            factors: resolveFleetFactorValues(
              requiredFactors,
              item,
              riskIndex,
              form.getValues(),
              factorContext,
            ),
            discount: resolveFleetRequestedDiscount(row.discounts_offered),
            // Restrict charges to exactly what was picked in this vehicle's
            // "Taxes Charged" rows, not every active company tax rule.
            tax_codes: resolveSelectedTaxCodes(row.taxes_charged),
          };
        }),
      };
      const response = await calculateMultiMutation.mutateAsync(request);
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
          const nextRow = recomputeFleetRiskRow(
            applyFleetRiskPremiumResult(
              form.getValues(
                `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}`,
              ),
              success,
            ),
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

  const values = form.watch();
  const fleetSignature = JSON.stringify(
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
  const calculateRef = useRef(calculateFleetPremiums);
  useEffect(() => {
    calculateRef.current = calculateFleetPremiums;
  });
  useEffect(() => {
    if (!values.product_id || !values.fleet.items.length) return;
    const timeout = setTimeout(
      () => void calculateRef.current(undefined, true),
      600,
    );
    return () => clearTimeout(timeout);
  }, [fleetSignature, values.product_id, values.fleet.items.length]);

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
    // Fill the untouched starter row rather than appending a second vehicle;
    // Cancel restores it from the snapshot.
    if (showEmptyState && fields.length === 1) {
      openEditVehicleDialog(0, true);
      return;
    }
    const index = fields.length;
    onAddVehicle();
    setEditingVehicle({ index, isNew: true, snapshot: null });
  }

  function openEditVehicleDialog(index: number, isFirstVehicle = false) {
    setVehicleErrors([]);
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

  async function confirmVehicleDialog() {
    if (!editingVehicle) return;
    const path = `fleet.items.${editingVehicle.index}` as const;
    const fieldsValid = await form.trigger(path, { shouldFocus: true });
    // The schema checks fleet items in a root-level refinement, which Zod
    // skips while another step has invalid fields, so re-check here too.
    const issues = getVehicleIssues(form.getValues(path));
    if (fieldsValid && issues.length === 0) {
      setVehicleErrors([]);
      setEditingVehicle(null);
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
        description="Import a list or add vehicles one at a time. Use Edit to complete missing details."
        first
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleCsvFileSelected(event)}
            />
            {!showEmptyState && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lookupPending}
                  onClick={() => void lookupFleetVehicles()}
                >
                  {lookupPending
                    ? 'Fetching vehicles...'
                    : 'Fetch vehicle details'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void calculateFleetPremiums()}
                  disabled={calculateMultiMutation.isPending}
                >
                  Calculate Fleet Premiums
                </Button>
                <Button type="button" size="sm" onClick={openNewVehicleDialog}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Vehicle
                </Button>
              </>
            )}
          </div>
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
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
            <p className="text-sm text-slate-500">
              No vehicles added yet. Add a vehicle or import a CSV list.
            </p>
            <Button type="button" onClick={openNewVehicleDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
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
          className="flex max-w-5xl flex-col gap-0 p-0 sm:max-h-[90vh]"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {editingVehicle && (
              <FleetVehicleEditor
                form={form}
                riskOptions={riskOptions}
                vehicleOptions={vehicleOptions}
                index={editingVehicle.index}
                isCalculating={calculateMultiMutation.isPending}
                calculationErrorMessage={calculationErrorMessage}
                onCalculateVehicle={(vehicleIndex) =>
                  void calculateFleetPremiums(vehicleIndex)
                }
              />
            )}
          </div>
          <div className="space-y-3 border-t border-slate-100 px-4 py-3 sm:px-6">
            {vehicleErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <p className="font-medium">This vehicle can't be saved yet:</p>
                <ul className="mt-1 list-disc pl-5">
                  {vehicleErrors.map((error) => (
                    <li key={error}>{error}</li>
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
