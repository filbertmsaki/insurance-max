import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFieldArray,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
  customerName,
  index,
  isCalculating,
  calculationErrorMessage,
  onCalculateVehicle,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  vehicleOptions: MotorVehicleRecord[];
  customerName: string;
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

  const totalPremium = item.risks_covered.reduce(
    (sum, risk) => sum + (Number(risk.premium_including_tax) || 0),
    0,
  );
  const totalSumInsured = item.risks_covered.reduce(
    (sum, risk) => sum + (Number(risk.sum_insured) || 0),
    0,
  );
  const issues = getVehicleIssues(item);

  return (
    <StepSection
      variant="item"
      title={`Vehicle ${index + 1}`}
      description={`Shared policyholder: ${customerName || 'Not selected yet'}`}
      contentClassName="space-y-6"
    >
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
        <p className="text-sm font-medium">Vehicle cover wording</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              <WizardFormItem className="md:col-span-2">
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
              <WizardFormItem className="md:col-span-2">
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
                  <WizardFormItem className="md:col-span-2">
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
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Vehicle Risks</p>
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
          const ratingMetadata = readPricingQuoteMetadata(
            form.watch(
              `fleet.items.${index}.risks_covered.${riskIndex}.rating_result_metadata` as const,
            ),
          );
          const riskId = form.watch(
            `fleet.items.${index}.risks_covered.${riskIndex}.risk_id` as const,
          );
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
              title={`Risk #${riskIndex + 1}`}
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
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={
                    `fleet.items.${index}.risks_covered.${riskIndex}.risk_code` as const
                  }
                  render={({ field }) => (
                    <WizardFormItem>
                      <FormLabel required>Cover</FormLabel>
                      <Select
                        value={toSelectValue(field.value)}
                        onValueChange={(value) => {
                          const nextRiskCode = fromSelectValue(value);
                          const selectedRisk =
                            riskOptions.find(
                              (risk) => risk.risk_code === nextRiskCode,
                            ) ?? null;
                          field.onChange(nextRiskCode);
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}.risk_id`,
                            selectedRisk?.id ?? '',
                          );
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}`,
                            {
                              ...resetFleetRiskPricing(
                                form.getValues(
                                  `fleet.items.${index}.risks_covered.${riskIndex}`,
                                ),
                              ),
                              risk_code: nextRiskCode,
                              risk_id: selectedRisk?.id ?? '',
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
                            <SelectItem key={risk.id} value={risk.risk_code}>
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

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Discounts
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setValue(
                        `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
                        [
                          ...discountRows,
                          {
                            ...createEmptyRiskDiscountRow(),
                            discount_amount: '',
                            request_reason_code: '',
                            request_comment: '',
                            effective_from: '',
                            effective_to: '',
                            requested_by: '',
                            requested_at: '',
                            max_permitted_rate: '',
                            max_permitted_amount: '',
                            approval_required: false,
                            approval_status: '',
                            approved_rate: '',
                            approved_amount: '',
                            approved_by: '',
                            approval_date: '',
                            rejection_reason: '',
                          },
                        ],
                      )
                    }
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Discount
                  </Button>
                </div>
                {discountRows.map((_, discountIndex) => (
                  <div
                    key={`${riskIndex}-discount-${discountIndex}`}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3"
                  >
                    <FormField
                      control={form.control}
                      name={
                        `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_type` as const
                      }
                      render={({ field }) => (
                        <WizardFormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </WizardFormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={
                        `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_rate` as const
                      }
                      render={({ field }) => (
                        <WizardFormItem>
                          <FormLabel>Rate</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.000001" {...field} />
                          </FormControl>
                        </WizardFormItem>
                      )}
                    />
                    <div className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={
                          `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_amount` as const
                        }
                        render={({ field }) => (
                          <WizardFormItem className="flex-1">
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                readOnly
                                {...field}
                              />
                            </FormControl>
                          </WizardFormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={
                          `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.request_reason_code` as const
                        }
                        render={({ field }) => (
                          <WizardFormItem className="flex-1">
                            <FormLabel>Reason Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="LOYALTY" />
                            </FormControl>
                          </WizardFormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          form.setValue(
                            `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
                            discountRows.filter(
                              (__, rowIndex) => rowIndex !== discountIndex,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormField
                      control={form.control}
                      name={
                        `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.request_comment` as const
                      }
                      render={({ field }) => (
                        <WizardFormItem className="md:col-span-3">
                          <FormLabel>Comment</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Why is this discount requested?"
                            />
                          </FormControl>
                        </WizardFormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              <RiskTaxesFields
                form={form}
                riskPath={`fleet.items.${index}.risks_covered.${riskIndex}`}
              />
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

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">
              Vehicle Summary
            </p>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>Cover note: {item.cover_note_number || '-'}</p>
              <p>
                Vehicle: {item.motor_dtl.registration_number || '-'} /{' '}
                {item.motor_dtl.chassis_number || '-'}
              </p>
              <p>
                Make & model: {item.motor_dtl.make || '-'}{' '}
                {item.motor_dtl.model || ''}
              </p>
              <p>Total sum insured: {totalSumInsured.toFixed(2)}</p>
              <p>Total premium: {totalPremium.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">Validation</p>
            {issues.length > 0 ? (
              <div className="mt-2 space-y-1 text-sm text-amber-700">
                {issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-emerald-700">
                This vehicle entry is ready to save back to the fleet list.
              </p>
            )}
          </div>
        </div>
      </div>
    </StepSection>
  );
}

export function MotorFleetDetailsStep({
  form,
  customerOptions,
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
  const policyholderName = useMemo(() => {
    const customerId = form.watch('customer_id');
    const existingCustomer = customerOptions.find(
      (customer) => customer.id === customerId,
    );
    return (
      existingCustomer?.company_name ||
      [existingCustomer?.first_name, existingCustomer?.last_name]
        .filter(Boolean)
        .join(' ') ||
      form.watch('policyholder.full_name') ||
      form.watch('policyholder.company_name') ||
      ''
    );
  }, [customerOptions, form]);

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
      const request = {
        effective_date: form.getValues('valid_from'),
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
            sum_insured: Number(row.sum_insured) || 0,
            cover_start_date: form.getValues('valid_from'),
            cover_end_date: form.getValues('valid_until'),
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

  return (
    <>
      <StepSection
        title="Vehicles"
        description="Import a list or add vehicles. Complete only the missing details."
        first
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV Template
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleCsvFileSelected(event)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={lookupPending}
              onClick={() => void lookupFleetVehicles()}
            >
              {lookupPending ? 'Fetching vehicles...' : 'Fetch vehicle details'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void calculateFleetPremiums()}
              disabled={calculateMultiMutation.isPending || fields.length === 0}
            >
              Calculate Fleet Premiums
            </Button>
            <Button
              type="button"
              onClick={() => {
                onAddVehicle();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </div>
        }
        contentClassName="space-y-1"
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
        {fields.map((field, index) => {
          const item = form.watch(`fleet.items.${index}` as const);
          return (
            <div key={field.id} className="space-y-3 rounded-xl border p-3">
              {lookupMessages[item.risks_covered[0]?.client_ref] && (
                <p role="status" className="text-xs">
                  {lookupMessages[item.risks_covered[0]?.client_ref]}
                </p>
              )}
              <FleetVehicleEditor
                form={form}
                riskOptions={riskOptions}
                vehicleOptions={vehicleOptions}
                customerName={policyholderName}
                index={index}
                isCalculating={calculateMultiMutation.isPending}
                calculationErrorMessage={calculationErrorMessage}
                onCalculateVehicle={(vehicleIndex) =>
                  void calculateFleetPremiums(vehicleIndex)
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDuplicateVehicle(index)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate Vehicle
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveVehicle(index)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Vehicle
                </Button>
              </div>
            </div>
          );
        })}
      </StepSection>
    </>
  );
}
