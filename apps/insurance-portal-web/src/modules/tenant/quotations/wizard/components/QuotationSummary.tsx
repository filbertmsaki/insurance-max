import {
  Calculator,
  CalendarDays,
  Car,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { QuotationFormSchemaValues } from '../../schemas';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  riskCount: number;
}

function formatCurrencyValue(currency: string, rawValue?: string) {
  const numeric = Number(rawValue ?? 0);
  if (!Number.isFinite(numeric)) {
    return `${currency} ${rawValue ?? '0.00'}`;
  }

  return `${currency} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: 'default' | 'highlight';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-3.5 py-3',
        tone === 'highlight'
          ? 'border-sky-200 bg-sky-50/70'
          : 'border-slate-200 bg-slate-50/80',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl',
            tone === 'highlight'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'bg-white text-slate-500 shadow-sm',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function QuotationSummary({
  form,
  categoryOptions,
  productOptions,
  riskCount,
}: Props) {
  const values = form.watch();

  const category = categoryOptions.find(
    (item) => item.id === values.category_id,
  );
  const product = productOptions.find((item) => item.id === values.product_id);

  const flow =
    values.quotation_flow === 'NON_MOTOR'
      ? 'Non-motor'
      : values.is_fleet
        ? 'Motor fleet'
        : 'Motor single';
  const total = values.total_premium || values.net_premium || '0.00';
  const currency = values.currency || 'TZS';
  const statusLabel = values.status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
  const dateRange = `${formatCoverDateLabel(values.valid_from)} to ${formatCoverDateLabel(
    values.valid_until,
  )}`;

  return (
    <Card className="overflow-hidden rounded-[28px] border-slate-200/90 bg-white/95 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] xl:sticky xl:top-6">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 pb-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge
              className="border-0 bg-white/12 text-sky-100"
              variant="outline"
            >
              Live summary
            </Badge>
            <CardTitle className="mt-3 text-xl text-white">
              Quotation briefing
            </CardTitle>
            <CardDescription className="mt-1 text-sky-100/80">
              A compact view of the details that matter while you complete the
              workflow.
            </CardDescription>
          </div>
          <Badge className="bg-white text-slate-900" variant="secondary">
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/75">
            Estimated premium
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {formatCurrencyValue(currency, total)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-sky-100/80">
            <span className="rounded-full bg-white/10 px-2.5 py-1">{flow}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">
              {riskCount} risk item{riskCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3">
          <SummaryMetric
            icon={FileText}
            label="Product"
            value={product?.product_name || 'Not selected'}
          />
          <SummaryMetric
            icon={ShieldCheck}
            label="Category"
            value={category?.name || 'Not selected'}
          />
          <SummaryMetric
            icon={CalendarDays}
            label="Cover period"
            value={dateRange}
          />
          <SummaryMetric icon={Car} label="Risk items" value={`${riskCount}`} />
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            Premium breakdown
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Basic premium</span>
              <span className="font-medium text-slate-900">
                {formatCurrencyValue(currency, values.basic_premium)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Tax</span>
              <span className="font-medium text-slate-900">
                {formatCurrencyValue(currency, values.total_tax)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-slate-900">
                {formatCurrencyValue(currency, values.total_discount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Payment mode</span>
              <span className="font-medium text-slate-900">
                {values.payment_mode_tira || 'Not set'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
