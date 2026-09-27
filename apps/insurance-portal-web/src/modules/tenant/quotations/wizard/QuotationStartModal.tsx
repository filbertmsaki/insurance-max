import { useEffect, useMemo, useState } from 'react';
import { Car, Shield, Truck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReferenceCurrencies } from '@/modules/platform/reference-data/hooks';
import {
  useIntermediaryCompanyOptions,
  useQuotationCategories,
  useQuotationProducts,
} from '../hooks';
import { CHANNEL_TYPES } from './steps/CoverNoteSetupStep';
import {
  COVER_NOTE_DATE_RANGE_OPTIONS,
  computeCoverNoteDateRange,
  formatCoverDateLabel,
  matchPresetDays,
  type CoverNoteDateRangeValue,
} from './utils/coverNoteDateRange';
import type { QuotationWizardFlow } from './types';

// eslint-disable-next-line react-refresh/only-export-components -- shared constant intentionally co-located with the modal it configures
export const CURRENCY_OPTIONS = ['TZS', 'USD', 'GBP', 'EUR'] as const;

// eslint-disable-next-line react-refresh/only-export-components -- shared constant intentionally co-located with the modal it configures
export const QUOTATION_FLOW_OPTIONS = [
  {
    label: 'Non-Motor',
    description: 'Fire, marine, engineering, GIT, and miscellaneous covers',
    icon: Shield,
    quotation_flow: 'NON_MOTOR' as const,
    quotation_type: 'NON_MOTOR' as const,
    is_fleet: false,
  },
  {
    label: 'Motor - Single Vehicle',
    description: 'One vehicle under a single motor quotation',
    icon: Car,
    quotation_flow: 'MOTOR_SINGLE' as const,
    quotation_type: 'MOTOR' as const,
    is_fleet: false,
  },
  {
    label: 'Motor - Fleet',
    description: 'Multiple vehicles under one fleet quotation',
    icon: Truck,
    quotation_flow: 'MOTOR_FLEET' as const,
    quotation_type: 'MOTOR' as const,
    is_fleet: true,
  },
] as const;

const DEFAULT_QUOTATION_FLOW: QuotationWizardFlow = 'MOTOR_SINGLE';
const DEFAULT_DATE_RANGE_DAYS: CoverNoteDateRangeValue = '365';

export interface QuotationStartSelection {
  quotation_flow: QuotationWizardFlow;
  quotation_type: 'MOTOR' | 'NON_MOTOR';
  is_fleet: boolean;
  category_id: string;
  product_id: string;
  channel_type: (typeof CHANNEL_TYPES)[number];
  currency: string;
  cover_note_type: '1' | '2' | '3';
  intermediary_company_id?: string;
  date_range?: CoverNoteDateRangeValue;
  valid_from?: string;
  valid_until?: string;
}

interface Props {
  open: boolean;
  initialSelection?: QuotationStartSelection | null;
  canSelectInsuranceChannel?: boolean;
  onProceed: (selection: QuotationStartSelection) => void;
  onClose: () => void;
}

const FIELD_LABELS = {
  quotation_flow: 'Quotation Type',
  category_id: 'Insurance Category',
  product_id: 'Product',
  channel_type: 'Insurance Channel',
  currency: 'Currency',
  date_range: 'Date Range',
} as const;

export function QuotationStartModal({
  open,
  initialSelection,
  canSelectInsuranceChannel = true,
  onProceed,
  onClose,
}: Props) {
  const [quotationFlow, setQuotationFlow] = useState<QuotationWizardFlow | ''>(
    '',
  );
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [channelType, setChannelType] = useState<
    (typeof CHANNEL_TYPES)[number] | ''
  >('');
  const [currency, setCurrency] = useState('TZS');
  const { data: referenceCurrencies = [] } = useReferenceCurrencies({
    is_active: true,
  });
  const [tranCompanyId, setTranCompanyId] = useState('');
  const [dateRangeDays, setDateRangeDays] = useState<
    CoverNoteDateRangeValue | ''
  >('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [touched, setTouched] = useState(false);

  const businessLine = useMemo(
    () => (quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR'),
    [quotationFlow],
  );
  const requiresDateRange =
    quotationFlow !== '' && quotationFlow !== 'MOTOR_FLEET';
  const effectiveChannelType = canSelectInsuranceChannel
    ? channelType
    : 'DIRECT';
  const requiresTranCompany =
    effectiveChannelType !== '' && effectiveChannelType !== 'DIRECT';
  const tranCompanyLabel =
    effectiveChannelType === 'BROKER'
      ? 'Broker Company'
      : effectiveChannelType === 'AGENCY'
        ? 'Agency Company'
        : effectiveChannelType === 'BANCASSURANCE'
          ? 'Bancassurance Company'
          : 'Intermediary Company';

  const { data: categoryOptions = [] } = useQuotationCategories(
    quotationFlow ? businessLine : undefined,
  );
  const { data: productOptions = [] } = useQuotationProducts({
    category_id: categoryId || undefined,
    business_line: quotationFlow ? businessLine : undefined,
    supports_fleet: quotationFlow === 'MOTOR_FLEET' ? true : undefined,
  });
  const tranCompanyOptions = useIntermediaryCompanyOptions(
    canSelectInsuranceChannel ? channelType : 'DIRECT',
    productId || undefined,
  );

  useEffect(() => {
    if (!open) return;

    if (initialSelection) {
      setQuotationFlow(initialSelection.quotation_flow);
      setCategoryId(initialSelection.category_id);
      setProductId(initialSelection.product_id);
      setChannelType(
        canSelectInsuranceChannel ? initialSelection.channel_type : 'DIRECT',
      );
      setCurrency(initialSelection.currency);
      setTranCompanyId(
        canSelectInsuranceChannel
          ? (initialSelection.intermediary_company_id ?? '')
          : '',
      );
      setValidFrom(initialSelection.valid_from ?? '');
      setValidUntil(initialSelection.valid_until ?? '');
      setDateRangeDays(
        initialSelection.date_range ??
          matchPresetDays(
            initialSelection.valid_from,
            initialSelection.valid_until,
          ),
      );
    } else {
      const { validFrom: defaultValidFrom, validUntil: defaultValidUntil } =
        computeCoverNoteDateRange(Number(DEFAULT_DATE_RANGE_DAYS));
      setQuotationFlow(DEFAULT_QUOTATION_FLOW);
      setCategoryId('');
      setProductId('');
      setChannelType(canSelectInsuranceChannel ? '' : 'DIRECT');
      setCurrency('TZS');
      setTranCompanyId('');
      setDateRangeDays(DEFAULT_DATE_RANGE_DAYS);
      setValidFrom(defaultValidFrom);
      setValidUntil(defaultValidUntil);
    }
    setTouched(false);
  }, [canSelectInsuranceChannel, initialSelection, open]);

  // Derived rather than cleared via effect: automatically drops out whenever the
  // channel is Direct or the selection no longer matches the current channel/product's
  // option list (e.g. switching between two non-Direct channels, or changing product).
  const effectiveTranCompanyId =
    requiresTranCompany &&
    tranCompanyOptions.some((option) => option.id === tranCompanyId)
      ? tranCompanyId
      : '';

  const handleFlowChange = (flow: QuotationWizardFlow) => {
    setQuotationFlow(flow);
    setCategoryId('');
    setProductId('');
    if (flow === 'MOTOR_FLEET') {
      setDateRangeDays('');
      setValidFrom('');
      setValidUntil('');
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setProductId('');
  };

  const handleDateRangeChange = (value: CoverNoteDateRangeValue) => {
    setDateRangeDays(value);
    const option = COVER_NOTE_DATE_RANGE_OPTIONS.find(
      (item) => item.value === value,
    );
    if (!option) return;
    const { validFrom: nextFrom, validUntil: nextUntil } =
      computeCoverNoteDateRange(option.days);
    setValidFrom(nextFrom);
    setValidUntil(nextUntil);
  };

  const errors: Partial<
    Record<keyof typeof FIELD_LABELS | 'intermediary_company_id', string>
  > = {};
  if (!quotationFlow)
    errors.quotation_flow = `${FIELD_LABELS.quotation_flow} is required`;
  if (!categoryId)
    errors.category_id = `${FIELD_LABELS.category_id} is required`;
  if (!productId) errors.product_id = `${FIELD_LABELS.product_id} is required`;
  if (canSelectInsuranceChannel && !channelType)
    errors.channel_type = `${FIELD_LABELS.channel_type} is required`;
  if (!currency) errors.currency = `${FIELD_LABELS.currency} is required`;
  if (requiresTranCompany && !effectiveTranCompanyId) {
    errors.intermediary_company_id = `${tranCompanyLabel} is required`;
  }
  if (requiresDateRange && (!validFrom || !validUntil)) {
    errors.date_range = `${FIELD_LABELS.date_range} is required`;
  }
  const isValid = Object.keys(errors).length === 0;

  const handleProceed = () => {
    setTouched(true);
    if (!isValid || !quotationFlow || !effectiveChannelType) return;

    const flowOption = QUOTATION_FLOW_OPTIONS.find(
      (option) => option.quotation_flow === quotationFlow,
    );
    if (!flowOption) return;

    onProceed({
      quotation_flow: flowOption.quotation_flow,
      quotation_type: flowOption.quotation_type,
      is_fleet: flowOption.is_fleet,
      category_id: categoryId,
      product_id: productId,
      channel_type: effectiveChannelType,
      currency,
      cover_note_type: '1',
      intermediary_company_id: canSelectInsuranceChannel
        ? effectiveTranCompanyId
        : undefined,
      ...(requiresDateRange
        ? {
            date_range: dateRangeDays || undefined,
            valid_from: validFrom,
            valid_until: validUntil,
          }
        : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Quotation Setup</DialogTitle>
          <DialogDescription>
            Choose the insurance type and cover details for the quotation
            wizard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 md:grid-cols-3">
          {QUOTATION_FLOW_OPTIONS.map((option) => {
            const active = quotationFlow === option.quotation_flow;
            const Icon = option.icon;
            return (
              <button
                key={option.quotation_flow}
                type="button"
                aria-pressed={active}
                onClick={() => handleFlowChange(option.quotation_flow)}
                className={[
                  'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors',
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {option.label}
              </button>
            );
          })}
        </div>
        {touched && errors.quotation_flow && (
          <p className="text-sm text-red-600">{errors.quotation_flow}</p>
        )}

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div>
            <Label
              required
              htmlFor="quotation-start-category"
              className="mb-2 block"
            >
              {FIELD_LABELS.category_id}
            </Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger id="quotation-start-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && errors.category_id && (
              <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
            )}
          </div>

          <div>
            <Label
              required
              htmlFor="quotation-start-product"
              className="mb-2 block"
            >
              {FIELD_LABELS.product_id}
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="quotation-start-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.product_name ?? option.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && errors.product_id && (
              <p className="mt-1 text-sm text-red-600">{errors.product_id}</p>
            )}
          </div>

          {canSelectInsuranceChannel && (
            <div>
              <Label
                required
                htmlFor="quotation-start-channel"
                className="mb-2 block"
              >
                {FIELD_LABELS.channel_type}
              </Label>
              <Select
                value={channelType}
                onValueChange={(value) =>
                  setChannelType(value as (typeof CHANNEL_TYPES)[number])
                }
              >
                <SelectTrigger id="quotation-start-channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched && errors.channel_type && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.channel_type}
                </p>
              )}
            </div>
          )}

          {requiresTranCompany && (
            <div>
              <Label
                required
                htmlFor="quotation-start-tran-company"
                className="mb-2 block"
              >
                {tranCompanyLabel}
              </Label>
              <Select
                value={effectiveTranCompanyId}
                onValueChange={setTranCompanyId}
                disabled={tranCompanyOptions.length === 0}
              >
                <SelectTrigger id="quotation-start-tran-company">
                  <SelectValue
                    placeholder={
                      tranCompanyOptions.length === 0
                        ? 'No linked companies available'
                        : 'Select Tran Company'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tranCompanyOptions.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched && errors.intermediary_company_id && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.intermediary_company_id}
                </p>
              )}
            </div>
          )}

          <div>
            <Label
              required
              htmlFor="quotation-start-currency"
              className="mb-2 block"
            >
              {FIELD_LABELS.currency}
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="quotation-start-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {(referenceCurrencies.length
                  ? referenceCurrencies.map((item) => item.code)
                  : CURRENCY_OPTIONS
                ).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && errors.currency && (
              <p className="mt-1 text-sm text-red-600">{errors.currency}</p>
            )}
          </div>

          {requiresDateRange && (
            <div>
              <Label
                required
                htmlFor="quotation-start-date-range"
                className="mb-2 block"
              >
                {FIELD_LABELS.date_range}
              </Label>
              <Select
                value={dateRangeDays}
                onValueChange={(value) =>
                  handleDateRangeChange(value as CoverNoteDateRangeValue)
                }
              >
                <SelectTrigger id="quotation-start-date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {COVER_NOTE_DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validFrom && validUntil ? (
                <p className="mt-1 text-xs text-slate-500">
                  Cover period: {formatCoverDateLabel(validFrom)} to{' '}
                  {formatCoverDateLabel(validUntil)}
                </p>
              ) : null}
              {touched && errors.date_range && (
                <p className="mt-1 text-sm text-red-600">{errors.date_range}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={handleProceed}>
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
