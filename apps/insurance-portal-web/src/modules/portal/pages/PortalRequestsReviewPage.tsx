import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Eye } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalBusinessRecord } from '../api';

const REQUEST_FILTER_KEYS = ['status', 'request_type'] as const;
type RequestFilterKey = (typeof REQUEST_FILTER_KEYS)[number];

const toOptions = (values: string[]) =>
  values.map((value) => ({ label: value.replaceAll('_', ' '), value }));
const STATUS_OPTIONS = toOptions([
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'ADDITIONAL_INFO_REQUIRED',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
]);
const TYPE_OPTIONS = toOptions([
  'QUOTATION_ASSISTANCE',
  'ENDORSEMENT',
  'CANCELLATION',
  'RENEWAL',
  'CLAIM_NOTIFICATION',
  'PAYMENT_PROOF',
]);

const columns: Column<PortalBusinessRecord>[] = [
  {
    key: 'request_no',
    header: 'Request',
    cell: (request) => text(request.request_no),
  },
  { key: 'actor', header: 'Actor', cell: (request) => actorLabel(request) },
  {
    key: 'request_type',
    header: 'Type',
    cell: (request) => text(request.request_type),
  },
  {
    key: 'subject',
    header: 'Subject',
    hideOnMobile: true,
    cell: (request) => text(request.subject),
  },
  {
    key: 'submitted_at',
    header: 'Submitted',
    cell: (request) => date(request.submitted_at ?? request.created_at),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (request) => (
      <Badge variant="outline" className={statusTone(status(request))}>
        {status(request)}
      </Badge>
    ),
  },
];

export function PortalRequestsReviewPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    PortalBusinessRecord,
    RequestFilterKey
  >({
    queryKey: ['tenant', 'portal', 'requests'],
    fetcher: (params, signal) => portalApi.pageAdminRequests(params, signal),
    filterKeys: REQUEST_FILTER_KEYS,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Portal Requests"
        description="Review customer and intermediary submissions, approvals, payment proofs, and completion evidence."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
            Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search request or subject"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
              { key: 'request_type', label: 'Type', options: TYPE_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Review',
                icon: Eye,
                onClick: (request) =>
                  navigate(`/apps/portal-requests/${request.id}`),
              },
            ]}
            emptyMessage="No portal requests. Customer and intermediary submissions will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function status(record: PortalBusinessRecord) {
  return text(record.status) ?? 'UNKNOWN';
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || '-';
}

function date(value: unknown) {
  return value ? formatDateTime(String(value)) : '-';
}

function actorLabel(record: PortalBusinessRecord) {
  const actor = record.portal_actor as Record<string, unknown> | undefined;
  const intermediary = actor?.intermediary_company as
    | Record<string, unknown>
    | undefined;
  const customer = actor?.customer as Record<string, unknown> | undefined;
  const user = actor?.user as Record<string, unknown> | undefined;

  return (
    text(intermediary?.name) ||
    text(customer?.customer_no) ||
    text(user?.name) ||
    text(actor?.actor_type)
  );
}
