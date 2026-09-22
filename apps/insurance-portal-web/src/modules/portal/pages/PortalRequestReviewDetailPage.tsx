import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';
import { getApiErrorMessage } from '@/lib/api-error';

import {
  portalApi,
  type PortalBusinessRecord,
  type PortalRequestStatus,
} from '../api';

const reviewStatuses: PortalRequestStatus[] = [
  'IN_REVIEW',
  'ADDITIONAL_INFO_REQUIRED',
  'APPROVED',
  'REJECTED',
];

export function PortalRequestReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] =
    useState<PortalRequestStatus>('IN_REVIEW');
  const [reason, setReason] = useState('');
  const [completion, setCompletion] = useState({
    result_type: '',
    result_id: '',
    result_reference: '',
    reason: '',
  });
  const [paymentReason, setPaymentReason] = useState('');

  const query = useQuery({
    queryKey: ['tenant', 'portal', 'requests', id],
    enabled: Boolean(id),
    queryFn: () => portalApi.getAdminRequest(id!),
  });

  const record = query.data;
  const fields = useMemo(() => (record ? flattenRecord(record) : []), [record]);
  const attachments = arrayOfObjects(record?.attachments);
  const events = arrayOfObjects(record?.events);
  const paymentProof = objectRecord(record?.payment_proof);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'portal', 'requests'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'portal', 'requests', id],
      }),
    ]);
  };

  const transitionMutation = useMutation({
    mutationFn: () =>
      portalApi.transitionAdminRequest(id!, {
        status: nextStatus,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success('Request status updated');
      setReason('');
      await invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      portalApi.completeAdminRequest(id!, {
        result_type: completion.result_type.trim() || undefined,
        result_id: completion.result_id.trim() || undefined,
        result_reference: completion.result_reference.trim() || undefined,
        reason: completion.reason.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success('Request completed');
      await invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const paymentMutation = useMutation({
    mutationFn: (status: 'VERIFIED' | 'REJECTED') =>
      portalApi.reviewPaymentProof(id!, {
        status,
        reason: paymentReason.trim() || undefined,
      }),
    onSuccess: async (_, status) => {
      toast.success(
        status === 'VERIFIED'
          ? 'Payment proof verified'
          : 'Payment proof rejected',
      );
      setPaymentReason('');
      await invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const submitTransition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    transitionMutation.mutate();
  };

  const submitCompletion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    completeMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/portal-requests">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <PageHeader
        eyebrow="Portal Requests"
        title={text(record?.request_no) ?? 'Request Review'}
        description={text(record?.subject) ?? 'Review portal submission'}
      />

      {query.isError ? (
        <ErrorState
          description="This portal request could not be loaded."
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !record ? (
        <EmptyState
          title="Loading request"
          description="The request will appear once loaded."
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Review Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitTransition}>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={nextStatus}
                      onValueChange={(value) =>
                        setNextStatus(value as PortalRequestStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewStatuses.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portal-request-reason">Reason</Label>
                    <Textarea
                      id="portal-request-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Required when requesting information or rejecting."
                    />
                  </div>
                  <Button type="submit" disabled={transitionMutation.isPending}>
                    Apply Decision
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Complete Request</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitCompletion}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="portal-result-type">Result type</Label>
                      <Input
                        id="portal-result-type"
                        value={completion.result_type}
                        onChange={(event) =>
                          setCompletion((current) => ({
                            ...current,
                            result_type: event.target.value,
                          }))
                        }
                        placeholder="CLAIM, RECEIPT, ENDORSEMENT"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="portal-result-id">Result ID</Label>
                      <Input
                        id="portal-result-id"
                        value={completion.result_id}
                        onChange={(event) =>
                          setCompletion((current) => ({
                            ...current,
                            result_id: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portal-result-ref">Result reference</Label>
                    <Input
                      id="portal-result-ref"
                      value={completion.result_reference}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          result_reference: event.target.value,
                        }))
                      }
                      placeholder="Official receipt, claim, endorsement, or renewal reference"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portal-complete-reason">Note</Label>
                    <Textarea
                      id="portal-complete-reason"
                      value={completion.reason}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button type="submit" disabled={completeMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" />
                    Complete
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {paymentProof ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Payment Proof</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="payment-review-reason">Review note</Label>
                  <Textarea
                    id="payment-review-reason"
                    value={paymentReason}
                    onChange={(event) => setPaymentReason(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => paymentMutation.mutate('VERIFIED')}
                    disabled={paymentMutation.isPending}
                  >
                    Verify Proof
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => paymentMutation.mutate('REJECTED')}
                    disabled={paymentMutation.isPending}
                  >
                    Reject Proof
                  </Button>
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
                        void portalApi.downloadAdminRequestAttachment(
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

const hiddenFields = new Set([
  'id',
  'payload',
  'attachments',
  'events',
  'payment_proof',
]);

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
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value))
    return value.length ? `${value.length} item(s)` : '-';
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

function status(record: PortalBusinessRecord) {
  return text(record.status) ?? 'UNKNOWN';
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
