import { useEffect } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  type FieldPath,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import {
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import { TAX_CODE_OPTIONS, TAX_EXEMPTION_OPTIONS, TAX_EXEMPTION_TYPE_OPTIONS, getTaxRateForCode } from '../utils/taxOptions';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'fleet.items'>;
  onAddVehicle: () => void;
  onRemoveVehicle: (index: number) => void;
  onDuplicateVehicle: (index: number) => void;
}

const FLEET_TYPES = [
  { value: '1', label: '1. For new' },
  { value: '2', label: '2. For addition' },
] as const;

function itemPath(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function riskPath(index: number, riskIndex: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.risks_covered.${riskIndex}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function addonPath(index: number, addonIndex: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.cover_note_addons.${addonIndex}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function subjectPath(index: number, subjectIndex: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.subject_matters_covered.${subjectIndex}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function motorPath(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.motor_dtl.${name}` as FieldPath<QuotationFormSchemaValues>;
}

function toNumber(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function FleetRiskEditor({
  form,
  vehicleIndex,
  riskIndex,
  riskOptions,
  onRemove,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  vehicleIndex: number;
  riskIndex: number;
  riskOptions: InsuranceRisk[];
  onRemove: () => void;
}) {
  const discountArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}.discounts_offered`,
  });
  const taxArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${vehicleIndex}.risks_covered.${riskIndex}.taxes_charged`,
  });
  const selectedRiskCode = form.watch(riskPath(vehicleIndex, riskIndex, 'risk_code'));
  const selectedRisk = riskOptions.find((risk) => risk.risk_code === selectedRiskCode);

  useEffect(() => {
    const riskCode = selectedRisk?.risk_code ?? '';
    if (riskCode) {
      form.setValue(riskPath(vehicleIndex, riskIndex, 'risk_code'), riskCode);
    }
  }, [form, riskIndex, selectedRisk?.risk_code, vehicleIndex]);

  return (
    <Card className="border-slate-200 bg-slate-50/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-sm">Risk #{riskIndex + 1}</CardTitle>
          <p className="text-xs text-slate-500">
            {selectedRisk ? `${selectedRisk.risk_name} (${selectedRisk.risk_code})` : 'Select a fleet risk'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'risk_code')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Code</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => field.onChange(fromSelectValue(value))}
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
            name={riskPath(vehicleIndex, riskIndex, 'sum_insured')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} value={field.value as string} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'premium_rate')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Rate</FormLabel>
                <FormControl>
                  <Input type="number" step="0.000001" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'premium_including_tax')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Including Tax</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'premium_before_discount')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Before Discount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'premium_after_discount')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium After Discount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'premium_excluding_tax_equivalent')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Excluding Tax</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={riskPath(vehicleIndex, riskIndex, 'sum_insured_equivalent')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured Equivalent</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Discounts</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                discountArray.append({
                  discount_type: '1',
                  discount_rate: '',
                  discount_amount: '',
                })
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Discount
            </Button>
          </div>
          {discountArray.fields.map((discountField, discountIndex) => (
            <div key={discountField.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `discounts_offered.${discountIndex}.discount_type`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `discounts_offered.${discountIndex}.discount_rate`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.000001" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-end justify-between gap-2">
                <FormField
                  control={form.control}
                  name={riskPath(vehicleIndex, riskIndex, `discounts_offered.${discountIndex}.discount_amount`)}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value as string} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => discountArray.remove(discountIndex)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Taxes</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                taxArray.append({
                  tax_code: '',
                  is_tax_exempted: false,
                  tax_exemption_type: '',
                  tax_exemption_reference: '',
                  tax_rate: '',
                  tax_amount: '',
                })
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Tax
            </Button>
          </div>
          {taxArray.fields.map((taxField, taxIndex) => (
            <div key={taxField.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4">
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_code`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Code</FormLabel>
                    <Select value={toSelectValue(field.value as string)} onValueChange={(value) => {
                      field.onChange(fromSelectValue(value));
                      form.setValue(riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_rate`), getTaxRateForCode(value));
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        {TAX_CODE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_rate`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.000001" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_amount`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.is_tax_exempted`)}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exempted</FormLabel>
                      <Select value={field.value ? 'Y' : 'N'} onValueChange={(value) => field.onChange(value === 'Y')}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="N">No</SelectItem>
                          <SelectItem value="Y">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => taxArray.remove(taxIndex)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_exemption_type`)}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Exemption Type</FormLabel>
                    <Select value={toSelectValue(field.value as string)} onValueChange={(value) => field.onChange(fromSelectValue(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exemption type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        {TAX_EXEMPTION_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={riskPath(vehicleIndex, riskIndex, `taxes_charged.${taxIndex}.tax_exemption_reference`)}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Exemption Reference</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FleetAddonEditor({
  form,
  vehicleIndex,
  addonIndex,
  onRemove,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  vehicleIndex: number;
  addonIndex: number;
  onRemove: () => void;
}) {
  const taxArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${vehicleIndex}.cover_note_addons.${addonIndex}.taxes`,
  });

  return (
    <Card className="border-slate-200 bg-slate-50/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm">Add-on #{addonIndex + 1}</CardTitle>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'addon_reference')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Add-on Reference</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'addon_desc')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'addon_amount')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Insured Amount</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'addon_premium_rate')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Rate</FormLabel>
                <FormControl>
                  <Input type="number" step="0.000001" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'premium_excluding_tax')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Excluding Tax</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={addonPath(vehicleIndex, addonIndex, 'premium_including_tax')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium Including Tax</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Taxes</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                taxArray.append({
                  tax_code: '',
                  is_tax_exempted: false,
                  tax_exemption_type: '',
                  tax_exemption_reference: '',
                  tax_rate: '',
                  tax_amount: '',
                })
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Tax
            </Button>
          </div>
          {taxArray.fields.map((taxField, taxIndex) => (
            <div key={taxField.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4">
              <FormField
                control={form.control}
                name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_code`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Code</FormLabel>
                    <Select value={toSelectValue(field.value as string)} onValueChange={(value) => {
                      field.onChange(fromSelectValue(value));
                      form.setValue(addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_rate`), getTaxRateForCode(value));
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        {TAX_CODE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_rate`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.000001" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_amount`)}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.is_tax_exempted`)}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exempted</FormLabel>
                      <Select value={field.value ? 'Y' : 'N'} onValueChange={(value) => field.onChange(value === 'Y')}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="N">No</SelectItem>
                          <SelectItem value="Y">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => taxArray.remove(taxIndex)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <FormField
                control={form.control}
                name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_exemption_type`)}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Exemption Type</FormLabel>
                    <Select value={toSelectValue(field.value as string)} onValueChange={(value) => field.onChange(fromSelectValue(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exemption type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        {TAX_EXEMPTION_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={addonPath(vehicleIndex, addonIndex, `taxes.${taxIndex}.tax_exemption_reference`)}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Exemption Reference</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FleetVehicleCard({
  form,
  customerOptions,
  riskOptions,
  index,
  onRemove,
  onDuplicate,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  riskOptions: InsuranceRisk[];
  index: number;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const riskArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.risks_covered`,
  });
  const addonArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.cover_note_addons`,
  });
  const subjectArray = useFieldArray({
    control: form.control,
    name: `fleet.items.${index}.subject_matters_covered`,
  });
  const selectedCustomerId = form.watch('customer_id');
  const selectedCustomer = customerOptions.find((customer) => customer.id === selectedCustomerId);
  const entry = form.watch(itemPath(index, 'fleet_entry')) || String(index + 1);
  const vehicleName =
    form.watch(motorPath(index, 'registration_number')) ||
    form.watch(itemPath(index, 'registration_no')) ||
    `Vehicle ${index + 1}`;

  return (
    <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Fleet Entry {entry}</p>
          <p className="text-xs text-slate-500">{vehicleName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.preventDefault(); onDuplicate(); }}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onRemove(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </summary>

      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fleet Entry and Cover Note</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name={itemPath(index, 'fleet_entry')} render={({ field }) => (
              <FormItem>
                <FormLabel>Fleet Entry</FormLabel>
                <FormControl><Input {...field} value={field.value as string} readOnly /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={itemPath(index, 'cover_note_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Note Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={itemPath(index, 'prev_cover_note_reference_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Previous Cover Note Reference</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={itemPath(index, 'cover_note_desc')} render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Note Description</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={itemPath(index, 'operative_clause')} render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Operative Clause</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Motor Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name={motorPath(index, 'motor_category')} render={({ field }) => (
              <FormItem>
                <FormLabel>Motor Category</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'motor_type')} render={({ field }) => (
              <FormItem>
                <FormLabel>Motor Type</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'registration_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'chassis_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Chassis Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'make')} render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'model')} render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'model_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Model Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'body_type')} render={({ field }) => (
              <FormItem>
                <FormLabel>Body Type</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'color')} render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'engine_number')} render={({ field }) => (
              <FormItem>
                <FormLabel>Engine Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'engine_capacity')} render={({ field }) => (
              <FormItem>
                <FormLabel>Engine Capacity</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'fuel_used')} render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Used</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'number_of_axles')} render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Axles</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'axle_distance')} render={({ field }) => (
              <FormItem>
                <FormLabel>Axle Distance</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'sitting_capacity')} render={({ field }) => (
              <FormItem>
                <FormLabel>Sitting Capacity</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'year_of_manufacture')} render={({ field }) => (
              <FormItem>
                <FormLabel>Year of Manufacture</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'tare_weight')} render={({ field }) => (
              <FormItem>
                <FormLabel>Tare Weight</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'gross_weight')} render={({ field }) => (
              <FormItem>
                <FormLabel>Gross Weight</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'motor_usage')} render={({ field }) => (
              <FormItem>
                <FormLabel>Motor Usage</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'owner_name')} render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Name</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'owner_category')} render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Category</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={motorPath(index, 'owner_address')} render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Owner Address</FormLabel>
                <FormControl><Textarea {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Subject Matters</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => subjectArray.append({ subject_matter_reference: '', subject_matter_desc: '' })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjectArray.fields.map((subjectField, subjectIndex) => (
              <div key={subjectField.id} className="grid gap-3 md:grid-cols-2">
                <FormField control={form.control} name={subjectPath(index, subjectIndex, 'subject_matter_reference')} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl><Input {...field} value={field.value as string} /></FormControl>
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <FormField control={form.control} name={subjectPath(index, subjectIndex, 'subject_matter_desc')} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Description</FormLabel>
                      <FormControl><Input {...field} value={field.value as string} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => subjectArray.remove(subjectIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Risks and Premium</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => riskArray.append({
              risk_code: '',
              sum_insured: '',
              sum_insured_equivalent: '',
              premium_rate: '',
              premium_before_discount: '',
              premium_after_discount: '',
              premium_excluding_tax_equivalent: '',
              premium_including_tax: '',
              discounts_offered: [{ discount_type: '1', discount_rate: '', discount_amount: '' }],
              taxes_charged: [{ tax_code: '', is_tax_exempted: false, tax_exemption_type: '', tax_exemption_reference: '', tax_rate: '', tax_amount: '' }],
            })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Risk
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskArray.fields.map((riskField, riskIndex) => (
              <FleetRiskEditor
                key={riskField.id}
                form={form}
                vehicleIndex={index}
                riskIndex={riskIndex}
                riskOptions={riskOptions}
                onRemove={() => riskArray.remove(riskIndex)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Add-ons</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addonArray.append({
              addon_reference: '',
              addon_desc: '',
              addon_amount: '',
              addon_premium_rate: '',
              premium_excluding_tax: '',
              premium_excluding_tax_equivalent: '',
              premium_including_tax: '',
              taxes: [],
            })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Add-on
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {addonArray.fields.map((addonField, addonIndex) => (
              <FleetAddonEditor
                key={addonField.id}
                form={form}
                vehicleIndex={index}
                addonIndex={addonIndex}
                onRemove={() => addonArray.remove(addonIndex)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </details>
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

  useEffect(() => {
    form.setValue('fleet.header.fleet_size', String(fields.length));
  }, [fields.length, form]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fleet Header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField control={form.control} name="fleet.header.fleet_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet ID</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  placeholder="FLEET-2026-000001"
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    form.setValue('fleet.header.fleet_no', event.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.fleet_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Name (optional)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.fleet_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Type</FormLabel>
              <Select
                value={toSelectValue(field.value as string)}
                onValueChange={(value) => field.onChange(fromSelectValue(value))}
              >
                <FormControl><SelectTrigger><SelectValue placeholder="Select fleet type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {FLEET_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.comprehensive_insured" render={({ field }) => (
            <FormItem>
              <FormLabel>Comprehensive Insured Count (optional)</FormLabel>
              <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.fleet_size" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Size</FormLabel>
              <FormControl><Input {...field} value={field.value as string} readOnly /></FormControl>
            </FormItem>
          )} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Fleet Vehicles ({fields.length})</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onAddVehicle}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <FleetVehicleCard
              key={field.id}
              form={form}
              customerOptions={customerOptions}
              riskOptions={riskOptions}
              index={index}
              onRemove={() => onRemoveVehicle(index)}
              onDuplicate={() => onDuplicateVehicle(index)}
            />
          ))}
          <p className="text-xs text-slate-400">
            Each vehicle carries its own motor details, risks, discounts, taxes, subject matters, and add-ons.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
