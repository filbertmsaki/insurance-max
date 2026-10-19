import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  displayValue,
  formatDate,
  formatMoney,
} from '@/components/shared/detailFormat';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { QuotationStatusBadge } from './QuotationStatusBadge';
import { getFriendlyTiramisStatus } from '../utils/quotationWorkflowLabels';
import type { QuotationPreviewRecord } from '../types';

/** Quotation-scoped presentation, so policy and finance pages retain their layouts. */
export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border-b border-slate-200 px-4 py-5 last:border-b-0 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; meta?: string }>;
}) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className="mt-1 min-w-0 whitespace-pre-wrap text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
            {item.value === null ||
            item.value === undefined ||
            item.value === ''
              ? 'N/A'
              : item.value}
          </dd>
          {item.meta && (
            <dd className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">
              {item.meta}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function QuotationDetailHeader({
  preview,
  workflowLabel,
  actions,
  onBack,
}: {
  preview: QuotationPreviewRecord;
  workflowLabel: string;
  actions: ReactNode;
  onBack: () => void;
}) {
  const { overview, premium_summary } = preview;
  return (
    <header className="min-w-0 rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            variant="ghost"
            className="h-11 w-11 shrink-0 px-0"
            aria-label="Back to quotations"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Quotation</p>
            <h1 className="text-lg font-semibold text-slate-900 [overflow-wrap:anywhere]">
              {overview.quotation_no}
            </h1>
            <p className="mt-1 text-sm text-slate-700 [overflow-wrap:anywhere]">
              {preview.policyholders
                .map((holder) => holder.full_name)
                .filter(Boolean)
                .join(', ') || 'Policyholder not provided'}
            </p>
            <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">
              {[
                overview.insurance_category.name ??
                  overview.insurance_category.code,
                overview.product.name ?? overview.product.code,
              ]
                .filter(Boolean)
                .join(' · ') || 'Product not provided'}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <QuotationStatusBadge status={overview.display_status} />
            <PaymentStatusBadge status={overview.payment_status} />
          </div>
          {actions}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 px-4 py-4 sm:px-5 xl:grid-cols-4">
        {[
          ['Quotation date', formatDate(overview.created_at)],
          ['Workflow', workflowLabel],
          ['TIRAMIS status', getFriendlyTiramisStatus(preview.tiramis)],
          [
            'Total premium',
            formatMoney(
              premium_summary.total_premium_including_tax,
              premium_summary.currency,
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 font-semibold text-slate-900 [overflow-wrap:anywhere]">
              {displayValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
