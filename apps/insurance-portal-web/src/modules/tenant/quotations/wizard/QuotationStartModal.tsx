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
import {
  useQuotationCategories,
  useQuotationProducts,
} from '../hooks';
import {
  CHANNEL_TYPES,
  COVER_NOTE_TYPES,
} from './steps/CoverNoteSetupStep';
import type { QuotationWizardFlow } from './types';

export const CURRENCY_OPTIONS = ['TZS', 'USD', 'GBP', 'EUR'] as const;

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

export interface QuotationStartSelection {
  quotation_flow: QuotationWizardFlow;
  quotation_type: 'MOTOR' | 'NON_MOTOR';
  is_fleet: boolean;
  category_id: string;
  product_id: string;
  channel_type: (typeof CHANNEL_TYPES)[number];
  currency: string;
  cover_note_type: '1' | '2' | '3';
}

interface Props {
  open: boolean;
  onProceed: (selection: QuotationStartSelection) => void;
  onClose: () => void;
}

const FIELD_LABELS = {
  quotation_flow: 'Quotation Type',
  category_id: 'Insurance Category',
  product_id: 'Product',
  channel_type: 'Insurance Channel',
  currency: 'Currency',
  cover_note_type: 'Cover Note Type',
} as const;

export function QuotationStartModal({ open, onProceed, onClose }: Props) {
  const [quotationFlow, setQuotationFlow] = useState<
    QuotationWizardFlow | ''
  >('');
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [channelType, setChannelType] = useState<
    (typeof CHANNEL_TYPES)[number] | ''
  >('');
  const [currency, setCurrency] = useState('');
  const [coverNoteType, setCoverNoteType] = useState<
    '1' | '2' | '3' | ''
  >('');
  const [touched, setTouched] = useState(false);

  const businessLine = useMemo(
    () => (quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR'),
    [quotationFlow],
  );

  const { data: categoryOptions = [] } = useQuotationCategories(
    quotationFlow ? businessLine : undefined,
  );
  const { data: productOptions = [] } = useQuotationProducts({
    category_id: categoryId || undefined,
    business_line: quotationFlow ? businessLine : undefined,
    supports_fleet: quotationFlow === 'MOTOR_FLEET' ? true : undefined,
  });

  useEffect(() => {
    if (!open) {
      setQuotationFlow('');
      setCategoryId('');
      setProductId('');
      setChannelType('');
      setCurrency('');
      setCoverNoteType('');
      setTouched(false);
    }
  }, [open]);

  const handleFlowChange = (flow: QuotationWizardFlow) => {
    setQuotationFlow(flow);
    setCategoryId('');
    setProductId('');
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setProductId('');
  };

  const errors: Partial<Record<keyof typeof FIELD_LABELS, string>> = {};
  if (!quotationFlow) errors.quotation_flow = `${FIELD_LABELS.quotation_flow} is required`;
  if (!categoryId) errors.category_id = `${FIELD_LABELS.category_id} is required`;
  if (!productId) errors.product_id = `${FIELD_LABELS.product_id} is required`;
  if (!channelType) errors.channel_type = `${FIELD_LABELS.channel_type} is required`;
  if (!currency) errors.currency = `${FIELD_LABELS.currency} is required`;
  if (!coverNoteType) errors.cover_note_type = `${FIELD_LABELS.cover_note_type} is required`;
  const isValid = Object.keys(errors).length === 0;

  const handleProceed = () => {
    setTouched(true);
    if (!isValid || !quotationFlow || !channelType || !coverNoteType) return;

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
      channel_type: channelType,
      currency,
      cover_note_type: coverNoteType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-xl" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Start a New Quotation</DialogTitle>
          <DialogDescription>
            Select the details below to set up the quotation wizard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-2 block">{FIELD_LABELS.quotation_flow}</Label>
            <div className="grid gap-2 md:grid-cols-3">
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
                      'rounded-lg border p-2.5 text-left text-sm transition-colors',
                      active
                        ? 'border-sky-300 bg-sky-50 text-sky-900'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    ].join(' ')}
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    <div className="font-medium">{option.label}</div>
                  </button>
                );
              })}
            </div>
            {touched && errors.quotation_flow && (
              <p className="mt-1 text-sm text-red-600">{errors.quotation_flow}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">{FIELD_LABELS.category_id}</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
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
            <Label className="mb-2 block">{FIELD_LABELS.product_id}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.product_name ?? option.name ?? option.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && errors.product_id && (
              <p className="mt-1 text-sm text-red-600">{errors.product_id}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">{FIELD_LABELS.channel_type}</Label>
            <Select
              value={channelType}
              onValueChange={(value) =>
                setChannelType(value as (typeof CHANNEL_TYPES)[number])
              }
            >
              <SelectTrigger>
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
              <p className="mt-1 text-sm text-red-600">{errors.channel_type}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">{FIELD_LABELS.currency}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((option) => (
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

          <div>
            <Label className="mb-2 block">{FIELD_LABELS.cover_note_type}</Label>
            <Select
              value={coverNoteType}
              onValueChange={(value) =>
                setCoverNoteType(value as '1' | '2' | '3')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cover note type" />
              </SelectTrigger>
              <SelectContent>
                {COVER_NOTE_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && errors.cover_note_type && (
              <p className="mt-1 text-sm text-red-600">{errors.cover_note_type}</p>
            )}
          </div>
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
