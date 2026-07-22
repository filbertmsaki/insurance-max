import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Pencil,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  useFieldArray,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormField,
  FormItem,
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
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'fleet.items'>;
  onAddVehicle: () => void;
  onRemoveVehicle: (index: number) => void;
  onDuplicateVehicle: (index: number) => void;
}

type VehicleStep = 0 | 1 | 2 | 3 | 4;

const VEHICLE_STEPS: Array<{ id: VehicleStep; label: string }> = [
  { id: 0, label: 'Vehicle Cover Note' },
  { id: 1, label: 'Risk & Premium' },
  { id: 2, label: 'Subject Matter & Add-ons' },
  { id: 3, label: 'Motor Details' },
  { id: 4, label: 'Review & Save Vehicle' },
];

function getVehicleIssues(
  item: QuotationFormSchemaValues['fleet']['items'][number],
): string[] {
  const issues: string[] = [];

  if (!item.cover_note_desc.trim()) issues.push('Missing cover note description');
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
  if (!item.motor_dtl.registration_number.trim() && !item.motor_dtl.chassis_number.trim()) {
    issues.push('Vehicle registration or chassis number is required');
  }
  if (!item.motor_dtl.make.trim() || !item.motor_dtl.model.trim()) {
    issues.push('Vehicle make and model are required');
  }

  return issues;
}

function FleetVehicleEditor({
  form,
  riskOptions,
  customerName,
  index,
  step,
  onStepChange,
  onClose,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  customerName: string;
  index: number;
  step: VehicleStep;
  onStepChange: (step: VehicleStep) => void;
  onClose: () => void;
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
  const item = form.watch(`fleet.items.${index}` as const);
  const coverNoteType = form.watch('cover_note_type');

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
    <Card className="border-slate-300">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Vehicle Wizard - Fleet Entry {item.fleet_entry || index + 1}
            </CardTitle>
            <p className="text-sm text-slate-500">
              Shared policyholder: {customerName || 'Not selected yet'}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Back to Fleet Vehicles
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_STEPS.map((vehicleStep) => (
            <button
              key={vehicleStep.id}
              type="button"
              onClick={() => onStepChange(vehicleStep.id)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                step === vehicleStep.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              ].join(' ')}
            >
              {vehicleStep.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name={`fleet.items.${index}.fleet_entry` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fleet Entry Number</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly />
                  </FormControl>
                </FormItem>
              )}
            />
            {coverNoteType !== '1' && (
              <FormField
                control={form.control}
                name={`fleet.items.${index}.prev_cover_note_reference_number` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Cover Note Reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name={`fleet.items.${index}.cover_note_desc` as const}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Cover Note Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.operative_clause` as const}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Operative Clause</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {coverNoteType === '3' && (
              <>
                <FormField
                  control={form.control}
                  name={`fleet.items.${index}.endorsement_type` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endorsement Type</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`fleet.items.${index}.endorsement_premium_earned` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endorsement Premium Earned</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`fleet.items.${index}.endorsement_reason` as const}
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Endorsement Reason</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">Vehicle Risks</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  riskArray.append({
                    risk_code: '',
                    sum_insured: '',
                    sum_insured_equivalent: '',
                    premium_rate: '',
                    premium_before_discount: '',
                    premium_after_discount: '',
                    premium_excluding_tax_equivalent: '',
                    premium_including_tax: '',
                    discounts_offered: [
                      { discount_type: '1', discount_rate: '', discount_amount: '' },
                    ],
                    taxes_charged: [
                      {
                        tax_code: '',
                        is_tax_exempted: false,
                        tax_exemption_type: '',
                        tax_exemption_reference: '',
                        tax_rate: '',
                        tax_amount: '',
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Risk
              </Button>
            </div>
            {riskArray.fields.map((field, riskIndex) => {
              const discountRows =
                form.watch(
                  `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
                ) ?? [];
              const taxRows =
                form.watch(
                  `fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged` as const,
                ) ?? [];

              return (
                <Card key={field.id} className="border-slate-200 bg-slate-50/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Risk #{riskIndex + 1}</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => riskArray.remove(riskIndex)}
                      disabled={riskArray.fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.risk_code` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Risk Code</FormLabel>
                            <Select
                              value={toSelectValue(field.value)}
                              onValueChange={(value) =>
                                field.onChange(fromSelectValue(value))
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select risk" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                                {riskOptions.map((risk) => (
                                  <SelectItem key={risk.id} value={risk.risk_code}>
                                    {risk.risk_name} ({risk.risk_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.sum_insured` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sum Insured</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.sum_insured_equivalent` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sum Insured Equivalent</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.premium_rate` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Premium Rate</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.000001" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.premium_before_discount` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Premium Before Discount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.premium_after_discount` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Premium After Discount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.premium_excluding_tax_equivalent` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Premium Excluding Tax Equivalent</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.risks_covered.${riskIndex}.premium_including_tax` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Premium Including Tax</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-3">
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
                                  discount_type: '1',
                                  discount_rate: '',
                                  discount_amount: '',
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
                            name={`fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_type` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_rate` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.000001" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="flex items-end gap-2">
                            <FormField
                              control={form.control}
                              name={`fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered.${discountIndex}.discount_amount` as const}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel>Amount</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                form.setValue(
                                  `fleet.items.${index}.risks_covered.${riskIndex}.discounts_offered` as const,
                                  discountRows.filter((__, rowIndex) => rowIndex !== discountIndex),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Taxes
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            form.setValue(
                              `fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged` as const,
                              [
                                ...taxRows,
                                {
                                  tax_code: '',
                                  is_tax_exempted: false,
                                  tax_exemption_type: '',
                                  tax_exemption_reference: '',
                                  tax_rate: '',
                                  tax_amount: '',
                                },
                              ],
                            )
                          }
                        >
                          <Plus className="mr-2 h-3.5 w-3.5" />
                          Add Tax
                        </Button>
                      </div>
                      {taxRows.map((_, taxIndex) => (
                        <div
                          key={`${riskIndex}-tax-${taxIndex}`}
                          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3"
                        >
                          <FormField
                            control={form.control}
                            name={`fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged.${taxIndex}.tax_code` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Code</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged.${taxIndex}.tax_rate` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.000001" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="flex items-end gap-2">
                            <FormField
                              control={form.control}
                              name={`fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged.${taxIndex}.tax_amount` as const}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel>Amount</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                form.setValue(
                                  `fleet.items.${index}.risks_covered.${riskIndex}.taxes_charged` as const,
                                  taxRows.filter((__, rowIndex) => rowIndex !== taxIndex),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Subject Matters Covered</CardTitle>
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
              </CardHeader>
              <CardContent className="space-y-3">
                {subjectArray.fields.map((field, subjectIndex) => (
                  <div key={field.id} className="grid gap-3 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`fleet.items.${index}.subject_matters_covered.${subjectIndex}.subject_matter_reference` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.subject_matters_covered.${subjectIndex}.subject_matter_desc` as const}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Add-ons</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addonArray.append({
                      addon_reference: '',
                      addon_desc: '',
                      addon_amount: '',
                      addon_premium_rate: '',
                      premium_excluding_tax: '',
                      premium_excluding_tax_equivalent: '',
                      premium_including_tax: '',
                      taxes: [],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Add-on
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {addonArray.fields.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No add-ons for this vehicle yet.
                  </p>
                ) : (
                  addonArray.fields.map((field, addonIndex) => (
                    <div
                      key={field.id}
                      className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2"
                    >
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.cover_note_addons.${addonIndex}.addon_reference` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Add-on Reference</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.cover_note_addons.${addonIndex}.addon_desc` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fleet.items.${index}.cover_note_addons.${addonIndex}.addon_amount` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Insured Amount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end gap-2">
                        <FormField
                          control={form.control}
                          name={`fleet.items.${index}.cover_note_addons.${addonIndex}.premium_including_tax` as const}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Premium Including Tax</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => addonArray.remove(addonIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.motor_category` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motor Category</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.motor_type` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motor Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.registration_number` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.chassis_number` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chassis Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.make` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.model` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.model_number` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.body_type` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.color` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.engine_number` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.engine_capacity` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine Capacity</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.fuel_used` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuel Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.number_of_axles` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Axles</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.sitting_capacity` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seating Capacity</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.year_of_manufacture` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year of Manufacture</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.owner_name` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`fleet.items.${index}.motor_dtl.owner_address` as const}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Owner Address</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">Vehicle Summary</p>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p>Cover note: {item.cover_note_number || '-'}</p>
                  <p>
                    Vehicle: {item.motor_dtl.registration_number || '-'} /{' '}
                    {item.motor_dtl.chassis_number || '-'}
                  </p>
                  <p>Make & model: {item.motor_dtl.make || '-'} {item.motor_dtl.model || ''}</p>
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
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Save Vehicle
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onStepChange(Math.max(0, step - 1) as VehicleStep)}
            disabled={step === 0}
          >
            Previous
          </Button>
          <Button
            type="button"
            onClick={() => onStepChange(Math.min(4, step + 1) as VehicleStep)}
            disabled={step === 4}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MotorFleetDetailsStep({
  form,
  customerOptions,
  riskOptions,
  fieldArray,
  onAddVehicle,
  onRemoveVehicle,
  onDuplicateVehicle,
}: Props) {
  const { fields } = fieldArray;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [vehicleStep, setVehicleStep] = useState<VehicleStep>(0);
  const policyholderName = useMemo(() => {
    const customerId = form.watch('customer_id');
    const existingCustomer = customerOptions.find((customer) => customer.id === customerId);
    return existingCustomer?.company_name ||
      [existingCustomer?.first_name, existingCustomer?.last_name]
        .filter(Boolean)
        .join(' ') ||
      form.watch('policyholder.full_name') ||
      form.watch('policyholder.company_name') ||
      '';
  }, [customerOptions, form]);

  useEffect(() => {
    form.setValue('fleet.header.fleet_size', String(fields.length || 0));
  }, [fields.length, form]);

  useEffect(() => {
    if (activeIndex != null && activeIndex >= fields.length) {
      setActiveIndex(fields.length > 0 ? fields.length - 1 : null);
    }
  }, [activeIndex, fields.length]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Step 3. Fleet Vehicles</CardTitle>
            <p className="text-sm text-slate-500">
              Manage fleet entries first, then complete each vehicle through the nested editor.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              onAddVehicle();
              setActiveIndex(fields.length);
              setVehicleStep(0);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => {
            const item = form.watch(`fleet.items.${index}` as const);
            const issues = getVehicleIssues(item);
            const vehicleName =
              item.motor_dtl.registration_number ||
              item.motor_dtl.chassis_number ||
              `Vehicle ${index + 1}`;
            const makeModel =
              `${item.motor_dtl.make || ''} ${item.motor_dtl.model || ''}`.trim() ||
              '-';
            const totalSumInsured = item.risks_covered.reduce(
              (sum, risk) => sum + (Number(risk.sum_insured) || 0),
              0,
            );
            const totalPremium = item.risks_covered.reduce(
              (sum, risk) => sum + (Number(risk.premium_including_tax) || 0),
              0,
            );

            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Fleet Entry {item.fleet_entry || index + 1}
                  </p>
                  <p className="text-xs text-slate-500">{item.cover_note_number || 'No cover note number yet'}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{vehicleName}</p>
                  <p className="text-xs text-slate-500">{makeModel}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>SI</p>
                  <p className="font-medium text-slate-900">{totalSumInsured.toFixed(2)}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>Premium</p>
                  <p className="font-medium text-slate-900">{totalPremium.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {issues.length > 0 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">{issues.length} issue(s)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">Complete</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setActiveIndex(index);
                      setVehicleStep(0);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onDuplicateVehicle(index)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveVehicle(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {activeIndex != null && fields[activeIndex] ? (
        <FleetVehicleEditor
          form={form}
          riskOptions={riskOptions}
          customerName={policyholderName}
          index={activeIndex}
          step={vehicleStep}
          onStepChange={setVehicleStep}
          onClose={() => setActiveIndex(null)}
        />
      ) : null}
    </div>
  );
}
