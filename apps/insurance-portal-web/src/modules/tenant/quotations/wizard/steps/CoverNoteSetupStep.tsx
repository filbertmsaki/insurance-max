import { useEffect, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { Branch } from '@/types';
import type { TiramisSalePointRecord } from '@/modules/tenant/tiramis/types';
import { useQuotationDistributionChannels } from '../../hooks';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  branchOptions: Branch[];
  salePointOptions: TiramisSalePointRecord[];
  salePointRequired: boolean;
  title?: string;
  showFlowSelector?: boolean;
}

const CHANNEL_TYPES = [
  'DIRECT',
  'BROKER',
  'AGENCY',
  'BANCASSURANCE',
  'API',
] as const;
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
const ENDORSEMENT_TYPES = [
  { value: '1', label: 'Increasing Premium Charged' },
  { value: '2', label: 'Decreasing Premium Charged' },
  { value: '3', label: 'Cover Details Change' },
  { value: '4', label: 'Cover Cancellation' },
] as const;

export function CoverNoteSetupStep({
  form,
  categoryOptions,
  productOptions,
  branchOptions,
  salePointOptions,
  salePointRequired,
  title = 'Step 1. Cover Note Setup',
  showFlowSelector = true,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const validFrom = form.watch('valid_from');
  const quotationFlow = form.watch('quotation_flow');
  const currency = form.watch('currency');
  const coverNoteType = form.watch('cover_note_type');
  const channelType = form.watch('channel_type');
  const productId = form.watch('product_id');
  const branchId = form.watch('branch_id');
  const salePointId = form.watch('sale_point_id');
  const requiresStandardCoverNoteFields = quotationFlow !== 'MOTOR_FLEET';
  const intermediaryCompanyId = form.watch('intermediary_company_id');
  const { data: distributionChannels = [] } =
    useQuotationDistributionChannels();
  const defaultSalePointId =
    salePointOptions.find((salePoint) => salePoint.isDefault)?.id ??
    salePointOptions[0]?.id ??
    '';
  const intermediaryOptions = useMemo(() => {
    if (channelType === 'DIRECT' || !productId) return [];

    const uniqueCompanies = new Map<
      string,
      { id: string; name: string; slug: string; company_type: string }
    >();

    distributionChannels.forEach((channel) => {
      if (
        channel.channel_type !== channelType ||
        channel.product_id !== productId ||
        channel.status !== 'ACTIVE' ||
        !channel.can_quote ||
        !channel.intermediary_company
      ) {
        return;
      }

      const company = channel.intermediary_company;
      if (!uniqueCompanies.has(company.id)) {
        uniqueCompanies.set(company.id, company);
      }
    });

    return [...uniqueCompanies.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [channelType, distributionChannels, productId]);

  useEffect(() => {
    if (!branchId) {
      if (salePointId) {
        form.setValue('sale_point_id', '');
      }
      return;
    }

    if (!salePointOptions.length) {
      if (salePointId) {
        form.setValue('sale_point_id', '');
      }
      return;
    }

    const selectedSalePoint = salePointOptions.find(
      (salePoint) => salePoint.id === salePointId,
    );

    if (!selectedSalePoint) {
      form.setValue('sale_point_id', defaultSalePointId);
      form.clearErrors('sale_point_id');
    }
  }, [branchId, defaultSalePointId, form, salePointId, salePointOptions]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {showFlowSelector && (
            <div className="md:col-span-2">
              <Label className="mb-2 block">Quotation Flow</Label>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  {
                    label: 'Non-Motor',
                    description:
                      'Fire, Marine, Engineering, GIT, Miscellaneous',
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
                      }}
                      className={[
                        'rounded-lg border p-4 text-left transition-colors',
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <div className="text-sm font-semibold">
                        {option.label}
                      </div>
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
          )}

          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    field.onChange(fromSelectValue(value));
                    form.setValue('product_id', '');
                    form.setValue('intermediary_company_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
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
                <FormLabel>Product (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    field.onChange(fromSelectValue(value));
                    form.setValue('intermediary_company_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
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
            name="channel_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    field.onChange(fromSelectValue(value));
                    form.setValue('intermediary_company_id', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
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

          {channelType !== 'DIRECT' ? (
            <FormField
              control={form.control}
              name="intermediary_company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {channelType === 'BROKER'
                      ? 'Broker Company'
                      : channelType === 'AGENCY'
                        ? 'Agency Company'
                        : channelType === 'BANCASSURANCE'
                          ? 'Bancassurance Company'
                          : 'Intermediary Company'}{' '}
                    (required)
                  </FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      disabled={intermediaryOptions.length === 0}
                    >
                      <option value="">
                        {intermediaryOptions.length === 0
                          ? 'No linked companies available'
                          : 'Select intermediary company'}
                      </option>
                      {intermediaryOptions.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency (required)</FormLabel>
                <FormControl>
                  <Input {...field} readOnly />
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
                  <FormLabel>Exchange Rate (to TZS, required)</FormLabel>
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
                <FormLabel>Cover Start Date (required)</FormLabel>
                <FormControl>
                  <Input type="date" min={today} {...field} />
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
                <FormLabel>Cover End Date (required)</FormLabel>
                <FormControl>
                  <Input type="date" min={validFrom || today} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branch &amp; Sale Point</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="branch_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch (required)</FormLabel>
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
            name="sale_point_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TIRAMIS Sale Point (required)</FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) =>
                    field.onChange(value === 'none' ? '' : value)
                  }
                  disabled={salePointOptions.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          salePointOptions.length === 0
                            ? 'Select a branch first'
                            : 'Select sale point'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {salePointOptions.map((salePoint) => (
                      <SelectItem key={salePoint.id} value={salePoint.id}>
                        {salePoint.salePointName ?? salePoint.salePointCode} (
                        {salePoint.salePointCode})
                        {salePoint.isDefault ? ' - default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {salePointRequired && salePointOptions.length > 1 && (
                  <p className="text-xs text-amber-600">
                    This branch has more than one active sale point. The default
                    is selected automatically, but you can change it here.
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
        <CardContent className="grid gap-4 md:grid-cols-1">
          <FormField
            control={form.control}
            name="cover_note_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Note Type (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    field.onChange(fromSelectValue(value));
                    if (value === SELECT_NONE_VALUE) {
                      form.setValue('prev_cover_note_reference', '');
                    }
                    if (value !== '3') {
                      form.setValue('endorsement_type', '');
                      form.setValue('endorsement_reason', '');
                      form.setValue('endorsement_premium_earned', '');
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
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
                  <FormLabel>
                    Previous Cover Note Reference (required)
                  </FormLabel>
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
            name="cover_note_desc"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Cover Note Description (required)'
                    : 'Cover Note Description'}
                </FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operative_clause"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Operative Clause (required)'
                    : 'Operative Clause'}
                </FormLabel>
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
                name="endorsement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endorsement Type (required)</FormLabel>
                    <Select
                      value={toSelectValue(field.value)}
                      onValueChange={(value) =>
                        field.onChange(fromSelectValue(value))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select endorsement type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                        {ENDORSEMENT_TYPES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
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
                name="endorsement_premium_earned"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endorsement Premium Earned</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endorsement_reason"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Endorsement Reason (required)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="commission_paid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commission Paid</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="commission_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commission Rate</FormLabel>
                <FormControl>
                  <Input type="number" step="0.000001" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="officer_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorizing Officer Name (required)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="officer_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorizing Officer Title (required)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_mode_tira"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode (TIRAMIS, required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) =>
                    field.onChange(fromSelectValue(value))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {PAYMENT_MODES_TIRA.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
