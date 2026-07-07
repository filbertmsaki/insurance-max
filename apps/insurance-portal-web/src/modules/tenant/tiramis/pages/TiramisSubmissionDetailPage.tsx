import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { formatDateTime, prettyJson } from '../utils';
import { useSubmitTenantTiramisSubmission, useTenantSubmissionDetail } from '../hooks';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

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
  const { data: submission, isLoading } = useTenantSubmissionDetail(id);
  const submitMutation = useSubmitTenantTiramisSubmission();

  if (isLoading) return <Skeleton className="h-[640px] w-full" />;

  if (!submission) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Submission not found</p>
        <Button variant="link" onClick={() => navigate(underwritingPaths.submissions)}>Back to submissions</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.submissions)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={submission.tiramis_request_id || submission.business_reference || submission.id}
            description={submission.request_type || 'TIRAMIS submission'}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => submitMutation.mutate({
              requestType: (submission.request_type as any) || 'NON_MOTOR',
              policy_id: submission.policy_id ?? undefined,
              quotation_id: submission.quotation_id ?? undefined,
              source_module: submission.source_module ?? undefined,
              source_record_id: submission.source_record_id ?? undefined,
              business_reference: submission.business_reference ?? submission.id,
              payload: submission.last_payload ?? {},
            }, { onSuccess: (result) => navigate(underwritingPaths.submissionDetail(result.submission.id)) })}
            disabled={submitMutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            Resubmit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Submission Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Status" value={<TiramisStatusBadge status={submission.status} />} />
          <Row label="Request ID" value={submission.tiramis_request_id} />
          <Row label="Transaction ID" value={submission.tiramis_transaction_id} />
          <Row label="Business Reference" value={submission.business_reference} />
          <Row label="Source Module" value={submission.source_module} />
          <Row label="Source Record" value={submission.source_record_id} />
          <Row label="Policy" value={submission.policy?.policy_no ?? submission.policy_id} />
          <Row label="Quotation" value={submission.quotation?.quotation_no ?? submission.quotation_id} />
          <Row label="Submitted At" value={formatDateTime(submission.submitted_at)} />
          <Row label="Completed At" value={formatDateTime(submission.completed_at)} />
          <Row label="Last Event" value={formatDateTime(submission.last_event_at)} />
          <Row label="Last Error" value={submission.last_error} />
        </CardContent>
      </Card>

      <Tabs defaultValue="request">
        <TabsList>
          <TabsTrigger value="request">Request Payload</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="response">Submission</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{prettyJson(submission.last_payload)}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4 space-y-4">
          {(submission.events ?? []).map((event) => (
            <Card key={event.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Event" value={event.event_type} />
                <Row label="Request ID" value={event.request_id} />
                <Row label="Response ID" value={event.response_id} />
                <Row label="Status" value={event.status_code} />
                <Row label="Description" value={event.status_description} />
                <Row label="Created" value={formatDateTime(event.created_at)} />
                <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{prettyJson(event.payload)}</pre>
              </CardContent>
            </Card>
          ))}
          {(submission.events ?? []).length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{prettyJson(submission)}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
