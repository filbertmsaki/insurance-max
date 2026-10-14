import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import {
  useLocalTrackingDetail,
  useLocalTrackingByBusinessReference,
  useSyncOneLocalTracking,
  useSubmitTenantTiramisSubmission,
  useTenantSubmissionByRequestId,
  useTenantSubmissionDetail,
} from '../hooks';
import {
  formatDateTime,
  getSubmissionDetailId,
  isTiramisFinalSuccess,
} from '../utils';
import type { TiramisRequestType } from '../types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-40 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function TiramisSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trackingDetail = useLocalTrackingDetail(id);
  const tenantDetail = useTenantSubmissionDetail(
    trackingDetail.isFetched && !trackingDetail.data ? id : undefined,
  );
  const requestIdLookup =
    trackingDetail.data?.finalResponseReceivedAt ||
    trackingDetail.data?.finalResponseId
      ? (trackingDetail.data?.tiramisRequestId ?? undefined)
      : undefined;
  const tenantDetailByRequestId =
    useTenantSubmissionByRequestId(requestIdLookup);
  const submitMutation = useSubmitTenantTiramisSubmission();
  const syncMutation = useSyncOneLocalTracking();

  const tenantSubmission = tenantDetail.data ?? tenantDetailByRequestId.data;
  const trackingSubmission = trackingDetail.data;
  const trackingByReference = useLocalTrackingByBusinessReference(
    tenantSubmission && !trackingSubmission
      ? (tenantSubmission.business_reference ?? undefined)
      : undefined,
  );
  const matchingTracking =
    trackingSubmission ??
    trackingByReference.data?.find(
      (record) =>
        record.tiramisRequestId === tenantSubmission?.tiramis_request_id,
    );
  const isLoading =
    !tenantSubmission &&
    !trackingSubmission &&
    (tenantDetail.isLoading ||
      tenantDetailByRequestId.isLoading ||
      trackingDetail.isLoading);

  if (isLoading) return <Skeleton className="h-[640px] w-full" />;

  if (!tenantSubmission && !trackingSubmission) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Submission not found</p>
        <Button variant="link" onClick={() => navigate('/tiramis/submissions')}>
          Back to submissions
        </Button>
      </div>
    );
  }

  if (tenantSubmission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/tiramis/submissions')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <PageHeader
              title={
                tenantSubmission.tiramis_request_id ||
                tenantSubmission.business_reference ||
                tenantSubmission.id
              }
              description={
                tenantSubmission.request_type || 'TIRAMIS submission'
              }
            />
          </div>
          {(matchingTracking ||
            !isTiramisFinalSuccess(tenantSubmission.status)) && (
            <div className="flex gap-2">
              {matchingTracking && (
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate(matchingTracking.id)}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Sync
                </Button>
              )}
              {!isTiramisFinalSuccess(tenantSubmission.status) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    submitMutation.mutate(
                      {
                        requestType:
                          (tenantSubmission.request_type as TiramisRequestType | null) ||
                          'NON_MOTOR',
                        policy_id: tenantSubmission.policy_id ?? undefined,
                        quotation_id:
                          tenantSubmission.quotation_id ?? undefined,
                        source_module:
                          tenantSubmission.source_module ?? undefined,
                        source_record_id:
                          tenantSubmission.source_record_id ?? undefined,
                        business_reference:
                          tenantSubmission.business_reference ??
                          tenantSubmission.id,
                        payload: tenantSubmission.last_payload ?? {},
                      },
                      {
                        onSuccess: (result) => {
                          const submissionDetailId = getSubmissionDetailId(
                            result?.submission,
                          );
                          if (submissionDetailId) {
                            navigate(
                              `/tiramis/submissions/${submissionDetailId}`,
                            );
                          }
                        },
                      },
                    )
                  }
                  disabled={submitMutation.isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resubmit
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Submission Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row
                label="Status"
                value={<TiramisStatusBadge status={tenantSubmission.status} />}
              />
              <Row
                label="Request ID"
                value={tenantSubmission.tiramis_request_id}
              />
              <Row
                label="Transaction ID"
                value={tenantSubmission.tiramis_transaction_id}
              />
              <Row
                label="Business Reference"
                value={tenantSubmission.business_reference}
              />
              <Row
                label="Source Module"
                value={tenantSubmission.source_module}
              />
              <Row
                label="Source Record"
                value={tenantSubmission.source_record_id}
              />
              <Row
                label="Policy"
                value={
                  tenantSubmission.policy?.policy_no ??
                  tenantSubmission.policy_id
                }
              />
              <Row
                label="Quotation"
                value={
                  tenantSubmission.quotation?.quotation_no ??
                  tenantSubmission.quotation_id
                }
              />
              <Row
                label="Submitted At"
                value={formatDateTime(tenantSubmission.submitted_at)}
              />
              <Row
                label="Completed At"
                value={formatDateTime(tenantSubmission.completed_at)}
              />
              <Row
                label="Last Event"
                value={formatDateTime(tenantSubmission.last_event_at)}
              />
              <Row label="Last Error" value={tenantSubmission.last_error} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Events</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {(tenantSubmission.events ?? []).map((event) => (
                <div
                  key={event.id}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <Row label="Event" value={event.event_type} />
                  <Row label="Request ID" value={event.request_id} />
                  <Row label="Response ID" value={event.response_id} />
                  <Row label="Status" value={event.status_code} />
                  <Row label="Description" value={event.status_description} />
                  <Row
                    label="Created"
                    value={formatDateTime(event.created_at)}
                  />
                </div>
              ))}
              {(tenantSubmission.events ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No events yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/tiramis/submissions')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={
            trackingSubmission!.tiramisRequestId ||
            trackingSubmission!.businessReference ||
            trackingSubmission!.id
          }
          description={trackingSubmission!.requestType || 'TIRAMIS tracking'}
        />
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate(trackingSubmission!.id)}
          disabled={syncMutation.isPending}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Sync
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tracking Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label="Status"
            value={<TiramisStatusBadge status={trackingSubmission!.status} />}
          />
          <Row
            label="Request ID"
            value={trackingSubmission!.tiramisRequestId}
          />
          <Row
            label="Transaction ID"
            value={trackingSubmission!.tiramisTransactionId}
          />
          <Row
            label="Business Reference"
            value={trackingSubmission!.businessReference}
          />
          <Row label="Source Module" value={trackingSubmission!.sourceModule} />
          <Row
            label="Source Record"
            value={trackingSubmission!.sourceRecordId}
          />
          <Row
            label="Quotation"
            value={
              trackingSubmission!.quotation?.quotation_no ??
              trackingSubmission!.quotationId
            }
          />
          <Row
            label="Policy"
            value={
              trackingSubmission!.policy?.policy_no ??
              trackingSubmission!.policyId
            }
          />
          <Row
            label="Submitted At"
            value={formatDateTime(trackingSubmission!.submittedAt)}
          />
          <Row
            label="Acknowledged At"
            value={formatDateTime(trackingSubmission!.acknowledgedAt)}
          />
          <Row
            label="Final Response At"
            value={formatDateTime(trackingSubmission!.finalResponseReceivedAt)}
          />
          <Row
            label="Last Synced At"
            value={formatDateTime(trackingSubmission!.lastSyncedAt)}
          />
          <Row
            label="ACK Code"
            value={trackingSubmission!.acknowledgementStatusCode}
          />
          <Row
            label="ACK Description"
            value={trackingSubmission!.acknowledgementStatusDesc}
          />
          <Row
            label="Final Response Code"
            value={trackingSubmission!.finalResponseStatusCode}
          />
          <Row
            label="Final Response Description"
            value={trackingSubmission!.finalResponseStatusDesc}
          />
          <Row
            label="Retryable"
            value={trackingSubmission!.isRetryable ? 'Yes' : 'No'}
          />
          <Row
            label="Last Error"
            value={trackingSubmission!.lastErrorMessage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
