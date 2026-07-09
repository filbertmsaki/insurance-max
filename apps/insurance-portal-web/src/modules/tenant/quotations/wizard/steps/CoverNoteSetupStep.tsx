import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Branch } from '@/types';
import type { DepartmentRecord } from '@/modules/tenant/departments/api/departments';
import type { TiramisSalePointRecord } from '@/modules/tenant/tiramis/types';
import type { QuotationFormSchemaValues } from '../../schemas';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  subClassOptions: OptionLike[];
  branchOptions: Branch[];
  departmentOptions: DepartmentRecord[];
  salePointOptions: TiramisSalePointRecord[];
  salePointRequired: boolean;
}

const CHANNEL_TYPES = ['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API'] as const;
const COVER_NOTE_TYPES = [
  { value: '1', label: 'New' },
  { value: '2', label: 'Renew' },
  { value: '3', label: 'Endorsement' },
] as const;
const PAYMENT_MODES_TIRA = [
  { value: '1', label: 'Cash' },
  { value: '2', label: 'Cheque' },
  { value: '3', label: 'EFT' },
] as const;

export function CoverNoteSetupStep({
  form,
  categoryOptions,
  productOptions,
  subClassOptions,
  branchOptions,
  departmentOptions,
  salePointOptions,
  salePointRequired,
}: Props) {
  const quotationFlow = form.watch('quotation_flow');
  const currency = form.watch('currency');
  const coverNoteType = form.watch('cover_note_type');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1. Cover Note Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-2 block">Quotation Flow</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                {
                  label: 'Non-Motor',
                  description: 'Fire, Marine, Engineering, GIT, Miscellaneous',
                  quotation_flow: 'NON_MOTOR' as const,
                  quotation_type: 'NON_MOTOR' as const,
                  is_fleet: false,
                },
                {
                  label: 'Motor - Single Vehicle',
                  description: 'One vehicle cover note',
                  quotation_flow: 'MOTOR_SINGLE' as const,
                  quotation_type: 'MOTOR' as const,
                  is_fleet: false,
                },
                {
                  label: 'Motor - Fleet',
                  description: 'Multiple vehicles under one fleet',
                  quotation_flow: 'MOTOR_FLEET' as const,
                  quotation_type: 'MOTOR' as const,
                  is_fleet: true,
                },
              ].map((option) => {
                const active = quotationFlow === option.quotation_flow;
                return (
                  <button
                    key={option.quotation_flow}
                    type="button"
                    onClick={() => {
                      form.setValue('quotation_flow', option.quotation_flow);
                      form.setValue('quotation_type', option.quotation_type);
                      form.setValue('is_fleet', option.is_fleet);
                      form.setValue('category_id', '');
                      form.setValue('product_id', '');
                      form.setValue('sub_class_id', '');
                    }}
                    className={[
                      'rounded-lg border p-4 text-left transition-colors',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div
                      className={[
                        'mt-1 text-xs',
                        active ? 'text-slate-200' : 'text-slate-400',
                      ].join(' ')}
                    >
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('product_id', '');
                    form.setValue('sub_class_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
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
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('sub_class_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {productOptions.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.product_name}
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
            name="sub_class_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-Class (optional)</FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {subClassOptions.map((subClass) => (
                      <SelectItem key={subClass.id} value={subClass.id}>
                        {subClass.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="channel_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHANNEL_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="intermediary_company_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Intermediary Company ID (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Broker/agency company ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {currency?.trim().toUpperCase() !== 'TZS' && (
            <FormField
              control={form.control}
              name="exchange_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange Rate (to TZS)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="valid_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valid_until"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branch, Department &amp; Sale Point</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="branch_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => {
                    field.onChange(value === 'none' ? '' : value);
                    form.setValue('department_id', '');
                    form.setValue('sale_point_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
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
            name="department_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department (optional)</FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sale_point_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  TIRAMIS Sale Point{salePointRequired ? ' (required)' : ' (optional)'}
                </FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                  disabled={salePointOptions.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={salePointOptions.length === 0 ? 'Select a branch first' : 'Select sale point'}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {salePointOptions.map((salePoint) => (
                      <SelectItem key={salePoint.id} value={salePoint.id}>
                        {salePoint.salePointName ?? salePoint.salePointCode} ({salePoint.salePointCode})
                        {salePoint.isDefault ? ' — default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {salePointRequired && !field.value && (
                  <p className="text-xs text-amber-600">
                    This branch has more than one active sale point — pick one explicitly. The
                    backend cannot auto-resolve it and will reject the TIRA submission otherwise.
                  </p>
                )}
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TIRAMIS Cover Note Header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="cover_note_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Note Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COVER_NOTE_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {coverNoteType !== '1' && (
            <FormField
              control={form.control}
              name="prev_cover_note_reference"
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
            name="officer_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorizing Officer Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="officer_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorizing Officer Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_mode_tira"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode (TIRAMIS)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_MODES_TIRA.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
