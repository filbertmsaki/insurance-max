import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import {
  portalApi,
  type PortalAudience,
  type PortalBusinessRecord,
} from '../api';

type PortalDetailResource =
  | 'quotations'
  | 'policies'
  | 'invoices'
  | 'receipts'
  | 'claims'
  | 'complaints'
  | 'requests'
  | 'customers'
  | 'commissions';

const titles: Record<PortalDetailResource, string> = {
  quotations: 'Quotation',
  policies: 'Policy',
  invoices: 'Invoice',
  receipts: 'Receipt',
  claims: 'Claim',
  complaints: 'Complaint',
  requests: 'Service Request',
  customers: 'Customer',
  commissions: 'Commission',
};

const hiddenFields = new Set([
  'id',
  'payload',
  'attachments',
  'events',
  'payment_proof',
]);

export function PortalBusinessDetailPage({
  audience,
  resource,
}: {
  audience: PortalAudience;
  resource: PortalDetailResource;
}) {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['portal', audience, resource, id],
    enabled: Boolean(id),
    queryFn: () => portalApi.getBusinessRecord(audience, resource, id!),
  });
  const record = query.data;
  const title = titles[resource];
  const backPath = `/${audience}/${resource}`;
  const fields = useMemo(() => (record ? flattenRecord(record) : []), [record]);
  const attachments = arrayOfObjects(record?.attachments);
  const events = arrayOfObjects(record?.events);
  const paymentProof = objectRecord(record?.payment_proof);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={
          audience === 'customer' ? 'Customer Portal' : 'Intermediary Portal'
        }
        title={title}
        description={record ? primaryReference(record) : 'Portal record detail'}
      />

      {query.isError ? (
        <ErrorState
          description={`${title} could not be loaded.`}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !record ? (
        <EmptyState
          title={`No ${title.toLowerCase()} selected`}
          description="The record will appear here once it has loaded."
        />
      ) : (
        <>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-slate-500" />
                Summary
              </CardTitle>
              <Badge variant="outline" className={statusTone(status(record))}>
                {status(record)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => (
                  <div key={field.label} className="min-w-0">
                    <div className="text-xs font-medium uppercase text-slate-500">
                      {field.label}
                    </div>
                    <div className="mt-1 break-words text-sm text-slate-950">
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {paymentProof ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Payment Proof</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {flattenRecord(paymentProof).map((field) => (
                    <div key={field.label}>
                      <div className="text-xs font-medium uppercase text-slate-500">
                        {field.label}
                      </div>
                      <div className="mt-1 text-sm text-slate-950">
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {attachments.length > 0 ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={String(attachment.id)}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-950">
                        {text(attachment.original_file_name) ?? 'Attachment'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {text(attachment.document_type)} -{' '}
                        {text(attachment.mime_type)} -{' '}
                        {date(attachment.created_at)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void portalApi.downloadRequestAttachment(
                          String(attachment.id),
                          text(attachment.original_file_name) ?? 'attachment',
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {events.length > 0 ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {events.map((event, index) => (
                  <div key={String(event.id ?? index)}>
                    <div className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {text(event.new_status) ?? 'UPDATE'}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {date(event.created_at)}
                        </span>
                      </div>
                      {text(event.message) ? (
                        <div className="mt-2 text-sm text-slate-700">
                          {text(event.message)}
                        </div>
                      ) : null}
                    </div>
                    {index < events.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function flattenRecord(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([key, value]) => !hiddenFields.has(key) && value !== null)
    .map(([key, value]) => ({
      label: key.replace(/_/g, ' '),
      value: display(value),
    }))
    .filter((field) => field.value !== '-');
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} item(s)` : '-';
  }

  if (value instanceof Date) {
    return formatDateTime(value.toISOString());
  }

  if (typeof value === 'object') {
    const nested = value as Record<string, unknown>;
    return (
      text(nested.name) ??
      text(nested.policy_no) ??
      text(nested.quotation_no) ??
      text(nested.invoice_no) ??
      text(nested.customer_no) ??
      text(nested.id) ??
      '-'
    );
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDateTime(value);
  }

  return String(value);
}

function primaryReference(record: PortalBusinessRecord) {
  return (
    text(record.request_no) ??
    text(record.policy_no) ??
    text(record.quotation_no) ??
    text(record.invoice_no) ??
    text(record.receipt_no) ??
    text(record.claim_no) ??
    text(record.complaint_no) ??
    text(record.customer_no) ??
    text(record.id) ??
    'Portal record detail'
  );
}

function status(record: PortalBusinessRecord) {
  return (
    text(record.status) ??
    text(record.policy_status) ??
    text(record.quotation_status) ??
    'UNKNOWN'
  );
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || null;
}

function date(value: unknown) {
  return value ? formatDateTime(String(value)) : '-';
}

function arrayOfObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      )
    : [];
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
