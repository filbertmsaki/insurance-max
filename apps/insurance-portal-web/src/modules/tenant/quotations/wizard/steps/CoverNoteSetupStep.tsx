import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { WizardFormItem } from '../components/WizardFormItem';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIntermediaryCompanyOptions } from '../../hooks';
import type { QuotationFormSchemaValues } from '../../schemas';
import { StepSection } from '../components/StepSection';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import {
  addLocalDays,
  computeCoverNoteEndFromStart,
  dateOnlyPart,
  formatLocalDateTime,
  inclusiveDayCount,
} from '../utils/coverNoteDateRange';
import { useCoverNoteAutoText } from '../hooks/useCoverNoteAutoText';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  isHydrating?: boolean;
  title?: string;
  showFlowSelector?: boolean;
  isEndorsementMode?: boolean;
  /** Enforces "no earlier than now" / "minimum 30-day period" for brand-new Motor/Non-Motor quotations only. */
  enforceFreshCoverPeriod?: boolean;
  /** Suppresses the leading section divider when this step isn't the first thing on the page (e.g. composed inside FleetSetupStep). */
  firstSection?: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components -- shared constant intentionally co-located with the step it configures
export const CHANNEL_TYPES = [
  'DIRECT',
  'BROKER',
  'AGENCY',
  'BANCASSURANCE',
  'API',
] as const;
// eslint-disable-next-line react-refresh/only-export-components -- shared constant intentionally co-located with the step it configures
export const COVER_NOTE_TYPES = [
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
  { value: '4', label: 'Cancellation' },
] as const;

export function CoverNoteSetupStep({
  form,
  categoryOptions,
  productOptions,
  isHydrating = false,
  title = 'Step 1. Cover Note Setup',
  showFlowSelector = true,
  isEndorsementMode = false,
  enforceFreshCoverPeriod = false,
  firstSection = true,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const validFrom = form.watch('valid_from');
  const quotationFlow = form.watch('quotation_flow');
  const currency = form.watch('currency');
  const coverNoteType = form.watch('cover_note_type');
  const channelType = form.watch('channel_type');
  const productId = form.watch('product_id');
  const requiresStandardCoverNoteFields = quotationFlow !== 'MOTOR_FLEET';
  const validFromDateOnly = dateOnlyPart(validFrom) || today;
  const minValidUntil =
    enforceFreshCoverPeriod && requiresStandardCoverNoteFields
      ? dateOnlyPart(
          formatLocalDateTime(
            addLocalDays(new Date(`${validFromDateOnly}T00:00:00`), 29),
          ),
        )
      : validFromDateOnly;
  const intermediaryOptions = useIntermediaryCompanyOptions(
    channelType,
    productId,
  );
  const validUntil = form.watch('valid_until');

  const selectedProduct = productOptions.find(
    (option) => option.id === productId,
  );
  const selectedProductName =
    selectedProduct?.product_name ?? selectedProduct?.name ?? '';

  const {
    generatedCoverNoteDesc,
    generatedOperativeClause,
    resetCoverNoteDescToDefault,
    resetOperativeClauseToDefault,
  } = useCoverNoteAutoText({
    form,
    productName: selectedProductName,
    validFrom,
    validUntil,
    isHydrating,
  });

  const [coverPeriodDays] = useState(
    () =>
      inclusiveDayCount(
        form.getValues('valid_from'),
        form.getValues('valid_until'),
      ) ?? 30,
  );

  useEffect(() => {
    if (!enforceFreshCoverPeriod || !requiresStandardCoverNoteFields || !validFrom) {
      return;
    }
    const nextValidUntil = computeCoverNoteEndFromStart(validFrom, coverPeriodDays);
    if (nextValidUntil && nextValidUntil !== form.getValues('valid_until')) {
      form.setValue('valid_until', nextValidUntil, { shouldValidate: true });
    }
  }, [
    coverPeriodDays,
    enforceFreshCoverPeriod,
    form,
    requiresStandardCoverNoteFields,
    validFrom,
  ]);

  if (enforceFreshCoverPeriod && requiresStandardCoverNoteFields) {
    return (
      <StepSection
        title={title}
        first={firstSection}
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="valid_from"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Cover Start Date (required)</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={today}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={dateOnlyPart(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valid_until"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Cover End Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  disabled
                  className="cursor-not-allowed bg-slate-50 text-slate-500"
                  value={dateOnlyPart(field.value)}
                  readOnly
                />
              </FormControl>
            </WizardFormItem>
          )}
        />

        {currency?.trim().toUpperCase() !== 'TZS' && (
          <FormField
            control={form.control}
            name="exchange_rate"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Exchange Rate (to TZS, required)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        )}


        {coverNoteType !== '1' && (
          <FormField
            control={form.control}
            name="prev_cover_note_reference"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>
                  Previous Cover Note Reference (required)
                </FormLabel>
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
          name="cover_note_desc"
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <div className="flex items-center justify-between">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Cover Note Description (required)'
                    : 'Cover Note Description'}
                </FormLabel>
                {generatedCoverNoteDesc !== null && (
                  <button
                    type="button"
                    onClick={resetCoverNoteDescToDefault}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="operative_clause"
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <div className="flex items-center justify-between">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Operative Clause (required)'
                    : 'Operative Clause'}
                </FormLabel>
                {generatedOperativeClause !== null && (
                  <button
                    type="button"
                    onClick={resetOperativeClauseToDefault}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Reset to default
                  </button>
                )}
              </div>
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
              name="endorsement_type"
              render={({ field }) => (
                <WizardFormItem>
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
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endorsement_premium_earned"
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Endorsement Premium Earned</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endorsement_reason"
              render={({ field }) => (
                <WizardFormItem className="md:col-span-2">
                  <FormLabel>Endorsement Reason (required)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
          </>
        )}

        {channelType !== 'DIRECT' && (
          <>
        <FormField
          control={form.control}
          name="commission_paid"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Commission Paid</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="commission_rate"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Commission Rate</FormLabel>
              <FormControl>
                <Input type="number" step="0.000001" {...field} />
              </FormControl>
            </WizardFormItem>
          )}
        />
          </>
        )}

        <FormField
          control={form.control}
          name="officer_name"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Authorizing Officer Name (required)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="officer_title"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Authorizing Officer Title (required)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payment_mode_tira"
          render={({ field }) => (
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />
      </StepSection>
    );
  }

  return (
    <>
      <StepSection
        title={title}
        first={firstSection}
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        {showFlowSelector && (
          <div className="md:col-span-2">
            <Label className="mb-2 block">Quotation Flow</Label>
            <div className="grid gap-2 md:grid-cols-2">
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
                      if (option.quotation_flow === 'MOTOR_FLEET') {
                        form.setValue(
                          'valid_from',
                          dateOnlyPart(form.getValues('valid_from')),
                        );
                        form.setValue(
                          'valid_until',
                          dateOnlyPart(form.getValues('valid_until')),
                        );
                      }
                    }}
                    className={[
                      'cursor-pointer rounded-lg border p-4 text-left transition-colors',
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
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="channel_type"
          render={({ field }) => (
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />

        {channelType !== 'DIRECT' ? (
          <FormField
            control={form.control}
            name="intermediary_company_id"
            render={({ field }) => (
              <WizardFormItem>
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
                    className="flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
              </WizardFormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Currency (required)</FormLabel>
              <FormControl>
                <Input {...field} readOnly />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        {currency?.trim().toUpperCase() !== 'TZS' && (
          <FormField
            control={form.control}
            name="exchange_rate"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Exchange Rate (to TZS, required)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="valid_from"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Cover Start Date (required)</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={today}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={dateOnlyPart(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valid_until"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Cover End Date (required)</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={minValidUntil}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={dateOnlyPart(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
      </StepSection>

      <StepSection
        title="TIRAMIS Cover Note Header"
        contentClassName="grid gap-3 md:grid-cols-1"
      >
        <FormField
          control={form.control}
          name="cover_note_type"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Cover Note Type (required)</FormLabel>
              <Select
                value={toSelectValue(field.value)}
                disabled={isEndorsementMode}
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
              {isEndorsementMode ? (
                <p className="text-xs text-slate-500">
                  Endorsement mode is fixed from the completed quotation.
                </p>
              ) : null}
            </WizardFormItem>
          )}
        />

        {coverNoteType !== '1' && (
          <FormField
            control={form.control}
            name="prev_cover_note_reference"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>
                  Previous Cover Note Reference (required)
                </FormLabel>
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
          name="cover_note_desc"
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <div className="flex items-center justify-between">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Cover Note Description (required)'
                    : 'Cover Note Description'}
                </FormLabel>
                {generatedCoverNoteDesc !== null && (
                  <button
                    type="button"
                    onClick={resetCoverNoteDescToDefault}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="operative_clause"
          render={({ field }) => (
            <WizardFormItem className="md:col-span-2">
              <div className="flex items-center justify-between">
                <FormLabel>
                  {requiresStandardCoverNoteFields
                    ? 'Operative Clause (required)'
                    : 'Operative Clause'}
                </FormLabel>
                {generatedOperativeClause !== null && (
                  <button
                    type="button"
                    onClick={resetOperativeClauseToDefault}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Reset to default
                  </button>
                )}
              </div>
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
              name="endorsement_type"
              render={({ field }) => (
                <WizardFormItem>
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
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endorsement_premium_earned"
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Endorsement Premium Earned</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endorsement_reason"
              render={({ field }) => (
                <WizardFormItem className="md:col-span-2">
                  <FormLabel>Endorsement Reason (required)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </WizardFormItem>
              )}
            />
          </>
        )}

        {channelType !== 'DIRECT' && (
          <>
        <FormField
          control={form.control}
          name="commission_paid"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Commission Paid</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="commission_rate"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Commission Rate</FormLabel>
              <FormControl>
                <Input type="number" step="0.000001" {...field} />
              </FormControl>
            </WizardFormItem>
          )}
        />
          </>
        )}

        <FormField
          control={form.control}
          name="officer_name"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Authorizing Officer Name (required)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="officer_title"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Authorizing Officer Title (required)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payment_mode_tira"
          render={({ field }) => (
            <WizardFormItem>
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
            </WizardFormItem>
          )}
        />
      </StepSection>
    </>
  );
}
