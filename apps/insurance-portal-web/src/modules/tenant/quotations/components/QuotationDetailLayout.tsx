import { useId, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Car,
  ShieldCheck,
  User,
  Wallet,
  Workflow,
} from 'lucide-react';
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
  mobileCollapsible = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  mobileCollapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <section className="min-w-0 border-b border-slate-200 px-4 py-5 last:border-b-0 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {mobileCollapsible && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 sm:hidden"
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide' : 'Show'}
              <span className="sr-only"> {title}</span>
            </Button>
          )}
        </div>
      </div>
      <div
        id={contentId}
        className={
          mobileCollapsible && !expanded ? 'hidden sm:block' : undefined
        }
      >
        {children}
      </div>
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
  /** Omit to hide the back button (the host page has its own). */
  onBack?: () => void;
}) {
  const { overview, premium_summary } = preview;
  const isFleet = overview.quotation_flow === 'MOTOR_FLEET';
  const policyholder =
    preview.policyholders
      .map((holder) => holder.full_name)
      .filter(Boolean)
      .join(', ') || 'Policyholder not provided';
  const product =
    [
      overview.insurance_category.name ?? overview.insurance_category.code,
      overview.product.name ?? overview.product.code,
    ]
      .filter(Boolean)
      .join(' · ') || 'Product not provided';
  const tiramisStatus = getFriendlyTiramisStatus(preview.tiramis);
  const tiramisNeedsAttention = /action|fail|error|reject/i.test(
    tiramisStatus ?? '',
  );

  const stats: Array<{
    label: string;
    value: ReactNode;
    icon: typeof Calendar;
    tone?: 'warning';
  }> = [
    {
      label: 'Quotation date',
      value: formatDate(overview.created_at),
      icon: Calendar,
    },
    { label: 'Workflow', value: workflowLabel, icon: Workflow },
    {
      label: 'TIRAMIS status',
      value: tiramisStatus,
      icon: tiramisNeedsAttention ? AlertTriangle : ShieldCheck,
      tone: tiramisNeedsAttention ? 'warning' : undefined,
    },
    ...(isFleet
      ? []
      : [
          {
            label: 'Total premium',
            value: formatMoney(
              premium_summary.total_premium_including_tax,
              premium_summary.currency,
            ),
            icon: Wallet,
          },
        ]),
  ];

  return (
    <header className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {onBack && (
            <Button
              variant="outline"
              className="h-11 w-11 shrink-0 rounded-full px-0 sm:h-10 sm:w-10"
              aria-label="Back to quotations"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Quotation
            </p>
            <h1 className="mt-0.5 text-xl font-bold leading-tight text-slate-900 [overflow-wrap:anywhere] sm:text-2xl">
              {overview.quotation_no}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <QuotationStatusBadge status={overview.display_status} />
              <PaymentStatusBadge status={overview.payment_status} />
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="[overflow-wrap:anywhere]">{policyholder}</span>
              </p>
              <p className="flex min-w-0 items-center gap-2 text-slate-600">
                <Car className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="[overflow-wrap:anywhere]">{product}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="min-w-0 border-t border-slate-100 pt-4 lg:border-0 lg:pt-0">
          {actions}
        </div>
      </div>
      <dl
        className={
          'grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 ' +
          (isFleet ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4')
        }
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const warning = stat.tone === 'warning';
          return (
            <div
              key={stat.label}
              className={
                'flex min-w-0 items-start gap-3 bg-slate-50/60 px-4 py-3.5 sm:px-6 sm:py-4 ' +
                (isFleet && index === stats.length - 1
                  ? 'col-span-2 sm:col-span-1'
                  : '')
              }
            >
              <span
                className={
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' +
                  (warning
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200')
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">{stat.label}</dt>
                <dd
                  className={
                    'mt-0.5 text-sm font-semibold [overflow-wrap:anywhere] sm:text-base ' +
                    (warning ? 'text-amber-700' : 'text-slate-900')
                  }
                >
                  {displayValue(stat.value)}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </header>
  );
}
