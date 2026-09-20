import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { type QuotationFormSchemaValues } from '../../schemas';
import { useIntermediaryCompanyOptions } from '../../hooks';
import { WizardInput } from '../components/WizardInput';
import { StepSection } from '../components/StepSection';
import { useCoverNoteAutoText } from '../hooks/useCoverNoteAutoText';
import {
  computeCoverNoteEndFromStart,
  inclusiveDayCount,
  dateOnlyPart,
} from '../utils/coverNoteDateRange';
interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
  category_id?: string;
}
interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  isHydrating?: boolean;
  title?: string;
  enforceFreshCoverPeriod?: boolean;
  firstSection?: boolean;
}
// eslint-disable-next-line react-refresh/only-export-components
export const CHANNEL_TYPES = [
  'DIRECT',
  'BROKER',
  'AGENCY',
  'BANCASSURANCE',
  'API',
] as const;
export function CoverNoteSetupStep({
  form,
  categoryOptions,
  productOptions,
  isHydrating = false,
  title = 'Cover',
  firstSection = true,
}: Props) {
  const values = form.watch();
  const product = productOptions.find((item) => item.id === values.product_id);
  const intermediaries = useIntermediaryCompanyOptions(
    values.channel_type,
    values.product_id,
  );
  useCoverNoteAutoText({
    form,
    productName: product?.product_name ?? product?.name,
    validFrom: values.valid_from,
    validUntil: values.valid_until,
    isHydrating,
  });
  useEffect(() => {
    if (isHydrating) return;
    if (!values.product_id && productOptions.length === 1) {
      form.setValue('product_id', productOptions[0].id);
      if (productOptions[0].category_id)
        form.setValue('category_id', productOptions[0].category_id);
    }
    if (!values.category_id && categoryOptions.length === 1)
      form.setValue('category_id', categoryOptions[0].id);
  }, [
    form,
    isHydrating,
    values.product_id,
    values.category_id,
    productOptions,
    categoryOptions,
  ]);
  const field = (
    name: Parameters<typeof WizardInput>[0]['name'],
    label: string,
    extra: Partial<Parameters<typeof WizardInput>[0]> = {},
  ) => <WizardInput form={form} name={name} label={label} {...extra} />;
  const days = inclusiveDayCount(values.valid_from, values.valid_until) ?? 365;
  return (
    <StepSection title={title} first={firstSection}>
      {!values.category_id && categoryOptions.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('category_id', 'Insurance category', {
            options: categoryOptions.map((item) => ({
              value: item.id,
              label: item.name ?? 'Category',
            })),
          })}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="cover-duration">
            Date range
          </label>
          <select
            id="cover-duration"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={String(days)}
            onChange={(event) =>
              form.setValue(
                'valid_until',
                dateOnlyPart(
                  computeCoverNoteEndFromStart(
                    values.valid_from,
                    Number(event.target.value),
                  ),
                ),
                { shouldDirty: true, shouldValidate: true },
              )
            }
          >
            {![30, 60, 90, 365].includes(days) && (
              <option value={days}>Custom period</option>
            )}
            {[30, 60, 90, 365].map((value) => (
              <option key={value} value={value}>
                {value === 365 ? '1 year' : value + ' days'}
              </option>
            ))}
          </select>
        </div>
        {field('valid_from', 'Cover starts', {
          type: 'date',
          onChange: (start) =>
            form.setValue(
              'valid_until',
              dateOnlyPart(computeCoverNoteEndFromStart(start, days)),
            ),
        })}
        {field('valid_until', 'Cover ends', {
          type: 'date',
          readOnly: true,
        })}
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">Cover options</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {values.channel_type !== 'DIRECT' &&
            field('intermediary_company_id', 'Intermediary company', {
              options: intermediaries.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            })}
          {values.currency !== 'TZS' &&
            field('exchange_rate', 'Exchange rate to TZS', { type: 'number' })}
          {field('payment_mode_tira', 'Payment method', {
            options: [
              { value: '1', label: 'Cash' },
              { value: '2', label: 'Cheque' },
              { value: '3', label: 'EFT' },
            ],
          })}
          {values.cover_note_type !== '1' &&
            field('prev_cover_note_reference', 'Previous cover reference')}
          {values.cover_note_type === '3' && (
            <>
              {field('endorsement_type', 'Endorsement type', {
                options: [
                  { value: '1', label: 'Increase premium' },
                  { value: '2', label: 'Decrease premium' },
                  { value: '3', label: 'Change cover details' },
                  { value: '4', label: 'Cancellation' },
                ],
              })}
              {field('endorsement_reason', 'Reason')}
              {field('endorsement_premium_earned', 'Earned premium', {
                type: 'number',
              })}
            </>
          )}
          {values.channel_type !== 'DIRECT' && (
            <>
              {field('commission_paid', 'Commission amount', {
                type: 'number',
              })}
              {field('commission_rate', 'Commission rate', { type: 'number' })}
            </>
          )}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">Cover wording</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field('cover_note_desc', 'Cover description', { multiline: true })}
          {field('operative_clause', 'Operative clause', { multiline: true })}
        </div>
      </div>
    </StepSection>
  );
}
