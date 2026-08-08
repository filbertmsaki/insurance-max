import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  FileText,
  HandCoins,
  ReceiptText,
  Search,
  Users,
} from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import {
  portalApi,
  type PortalAudience,
  type PortalBusinessRecord,
} from '../api';

type PortalResource =
  | 'quotations'
  | 'policies'
  | 'invoices'
  | 'receipts'
  | 'requests'
  | 'customers'
  | 'commissions';

const resourceConfig: Record<
  PortalResource,
  {
    title: string;
    description: string;
    icon: typeof FileText;
    columns: Array<{
      label: string;
      render: (record: PortalBusinessRecord) => string | number | null;
    }>;
  }
> = {
  quotations: {
    title: 'Quotations',
    description:
      'Quotation drafts and submitted quotations visible to this portal account.',
    icon: FileText,
    columns: [
      { label: 'Quotation', render: (record) => text(record.quotation_no) },
      { label: 'Product', render: (record) => text(record.product_name) },
      { label: 'Customer', render: (record) => text(record.customer_name) },
      { label: 'Premium', render: (record) => money(record.total_premium) },
      { label: 'Created', render: (record) => date(record.created_at) },
    ],
  },
  policies: {
    title: 'Policies',
    description:
      'Issued policies and coverage details linked to the portal account.',
    icon: BriefcaseBusiness,
    columns: [
      { label: 'Policy', render: (record) => text(record.policy_no) },
      { label: 'Cover note', render: (record) => text(record.cover_note_no) },
      { label: 'Product', render: (record) => text(record.product_name) },
      { label: 'Premium', render: (record) => money(record.total_premium) },
      {
        label: 'Period',
        render: (record) => period(record.start_date, record.end_date),
      },
    ],
  },
  invoices: {
    title: 'Invoices',
    description:
      'Premium invoices issued against portal-visible quotations and policies.',
    icon: ReceiptText,
    columns: [
      { label: 'Invoice', render: (record) => text(record.invoice_no) },
      {
        label: 'Reference',
        render: (record) => text(record.policy_no ?? record.quotation_no),
      },
      {
        label: 'Amount',
        render: (record) => money(record.total_amount ?? record.balance_amount),
      },
      { label: 'Balance', render: (record) => money(record.balance_amount) },
      { label: 'Due', render: (record) => date(record.due_date) },
    ],
  },
  receipts: {
    title: 'Receipts',
    description: 'Receipts allocated to portal-visible billing records.',
    icon: HandCoins,
    columns: [
      { label: 'Receipt', render: (record) => text(record.receipt_no) },
      {
        label: 'Reference',
        render: (record) => text(record.invoice_no ?? record.policy_no),
      },
      {
        label: 'Amount',
        render: (record) => money(record.amount ?? record.receipt_amount),
      },
      { label: 'Method', render: (record) => text(record.payment_method) },
      {
        label: 'Received',
        render: (record) => date(record.receipt_date ?? record.created_at),
      },
    ],
  },
  requests: {
    title: 'Service Requests',
    description:
      'Policy service, claim notification, quotation assistance, and payment-proof requests.',
    icon: FileText,
    columns: [
      { label: 'Request', render: (record) => text(record.request_no) },
      { label: 'Type', render: (record) => text(record.request_type) },
      {
        label: 'Target',
        render: (record) => text(record.policy_no ?? record.quotation_no),
      },
      {
        label: 'Submitted',
        render: (record) => date(record.submitted_at ?? record.created_at),
      },
    ],
  },
  customers: {
    title: 'Customers',
    description: 'Customer portfolio linked to the intermediary account.',
    icon: Users,
    columns: [
      { label: 'Customer', render: (record) => text(record.customer_no) },
      { label: 'Name', render: (record) => text(record.name) },
      { label: 'Phone', render: (record) => text(record.phone) },
      { label: 'Email', render: (record) => text(record.email) },
      { label: 'KYC', render: (record) => text(record.kyc_status) },
    ],
  },
  commissions: {
    title: 'Commissions',
    description:
      'Commission transactions earned through intermediary portfolio business.',
    icon: BadgeDollarSign,
    columns: [
      { label: 'Policy', render: (record) => text(record.policy_no) },
      { label: 'Type', render: (record) => text(record.commission_type) },
      { label: 'Rate', render: (record) => percent(record.commission_rate) },
      { label: 'Amount', render: (record) => money(record.commission_amount) },
      { label: 'Earned', render: (record) => date(record.earned_at) },
    ],
  },
};

export function PortalBusinessListPage({
  audience,
  resource,
}: {
  audience: PortalAudience;
  resource: PortalResource;
}) {
  const [search, setSearch] = useState('');
  const config = resourceConfig[resource];
  const Icon = config.icon;
  const queryParams = useMemo(
    () => ({ search: search.trim() || undefined, limit: 25 }),
    [search],
  );
  const recordsQuery = useQuery({
    queryKey: ['portal', audience, resource, queryParams],
    queryFn: () =>
      portalApi.listBusinessRecords(audience, resource, queryParams),
  });
  const records = recordsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          audience === 'customer' ? 'Customer Portal' : 'Intermediary Portal'
        }
        title={config.title}
        description={config.description}
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-slate-500" />
            Records
          </CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {recordsQuery.isError ? (
            <ErrorState
              description={`${config.title} could not be loaded.`}
              onRetry={() => {
                void recordsQuery.refetch();
              }}
            />
          ) : records.length === 0 ? (
            <EmptyState
              title={`No ${config.title.toLowerCase()}`}
              description="Records will appear here when they are available to this portal account."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((column) => (
                    <TableHead key={column.label}>{column.label}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    {config.columns.map((column) => (
                      <TableCell key={column.label}>
                        {column.render(record) ?? '-'}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(status(record))}
                      >
                        {status(record)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || null;
}

function status(record: PortalBusinessRecord) {
  return (
    text(record.status) ??
    text(record.policy_status) ??
    text(record.quotation_status) ??
    'UNKNOWN'
  );
}

function money(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : text(value);
}

function percent(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : text(value);
}

function date(value: unknown) {
  return value ? formatDateTime(String(value)) : null;
}

function period(start: unknown, end: unknown) {
  const from = start ? String(start).slice(0, 10) : null;
  const to = end ? String(end).slice(0, 10) : null;

  return from && to ? `${from} - ${to}` : (from ?? to);
}
