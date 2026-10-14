import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type QuotationFormSchemaValues } from '../../schemas';
import { useIntermediaryCompanyOptions } from '../../hooks';
import { WizardInput } from '../components/WizardInput';
import { StepSection } from '../components/StepSection';
import { useCoverNoteAutoText } from '../hooks/useCoverNoteAutoText';
import {
  computeCoverNoteEndFromStart,
  resolveCoverDurationDays,
  todayLocalDatePart,
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
  canSelectInsuranceChannel?: boolean;
  showCategoryPicker?: boolean;
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
  canSelectInsuranceChannel = true,
  showCategoryPicker = true,
}: Props) {
  const values = form.watch();
  const product = productOptions.find((item) => item.id === values.product_id);
  const intermediaries = useIntermediaryCompanyOptions(
    canSelectInsuranceChannel ? values.channel_type : 'DIRECT',
    values.product_id,
  );
  const { generatedCoverNoteDesc, generatedOperativeClause } =
    useCoverNoteAutoText({
      form,
      productName: product?.product_name ?? product?.name,
      validFrom: values.valid_from,
      validUntil: values.valid_until,
      isHydrating,
    });
  const [wordingExpanded, setWordingExpanded] = useState(false);
  const hasCustomWording =
    (Boolean(values.cover_note_desc) &&
      values.cover_note_desc !== generatedCoverNoteDesc) ||
    (Boolean(values.operative_clause) &&
      values.operative_clause !== generatedOperativeClause);
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
  const days =
    resolveCoverDurationDays(values.valid_from, values.valid_until) ?? 365;
  const hasCoverOptions =
    (canSelectInsuranceChannel && values.channel_type !== 'DIRECT') ||
    values.currency !== 'TZS' ||
    values.cover_note_type !== '1';
  // Fleet wording is captured per vehicle, so the header wording is optional.
  const wordingRequired = values.quotation_flow !== 'MOTOR_FLEET';
  return (
    <StepSection title={title} first={firstSection}>
      {showCategoryPicker &&
        !values.category_id &&
        categoryOptions.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('category_id', 'Insurance category', {
            required: true,
            options: categoryOptions.map((item) => ({
              value: item.id,
              label: item.name ?? 'Category',
            })),
          })}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="cover-duration" required>
            Date range
          </Label>
          <Select
            value={String(days)}
            onValueChange={(value) =>
              form.setValue(
                'valid_until',
                computeCoverNoteEndFromStart(values.valid_from, Number(value)),
                { shouldDirty: true, shouldValidate: true },
              )
            }
          >
            <SelectTrigger id="cover-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {![30, 60, 90, 365].includes(days) && (
                <SelectItem value={String(days)}>Custom period</SelectItem>
              )}
              {[30, 60, 90, 365].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value === 365 ? '1 year' : value + ' days'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field('valid_from', 'Cover starts', {
          required: true,
          type: 'date',
          min: todayLocalDatePart(),
          onChange: (start) =>
            form.setValue(
              'valid_until',
              computeCoverNoteEndFromStart(start, days),
            ),
        })}
        {field('valid_until', 'Cover ends', {
          required: true,
          type: 'date',
          readOnly: true,
        })}
      </div>
      {hasCoverOptions && (
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Cover options</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {canSelectInsuranceChannel &&
              values.channel_type !== 'DIRECT' &&
              field('intermediary_company_id', 'Intermediary company', {
                required: true,
                options: intermediaries.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              })}
            {values.currency !== 'TZS' &&
              field('exchange_rate', 'Exchange rate to TZS', {
                required: true,
                type: 'number',
              })}
            {values.cover_note_type !== '1' &&
              field('prev_cover_note_reference', 'Previous cover reference', {
                required: true,
              })}
            {values.cover_note_type === '3' && (
              <>
                {field('endorsement_type', 'Endorsement type', {
                  required: true,
                  options: [
                    { value: '1', label: 'Increase premium' },
                    { value: '2', label: 'Decrease premium' },
                    { value: '3', label: 'Change cover details' },
                    { value: '4', label: 'Cancellation' },
                  ],
                })}
                {field('endorsement_reason', 'Reason', { required: true })}
                {field('endorsement_premium_earned', 'Earned premium', {
                  type: 'number',
                })}
              </>
            )}
            {canSelectInsuranceChannel && values.channel_type !== 'DIRECT' && (
              <>
                {field('commission_paid', 'Commission amount', {
                  type: 'number',
                })}
                {field('commission_rate', 'Commission rate', {
                  type: 'number',
                })}
              </>
            )}
          </div>
        </div>
      )}
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
            {field('cover_note_desc', 'Cover description', {
              required: wordingRequired,
              multiline: true,
            })}
            {field('operative_clause', 'Operative clause', {
              required: wordingRequired,
              multiline: true,
            })}
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>{values.cover_note_desc || '—'}</p>
            <p className="text-slate-500">{values.operative_clause || '—'}</p>
            {hasCustomWording && (
              <p className="text-xs text-slate-400">Custom wording</p>
            )}
          </div>
        )}
      </div>
    </StepSection>
  );
}
