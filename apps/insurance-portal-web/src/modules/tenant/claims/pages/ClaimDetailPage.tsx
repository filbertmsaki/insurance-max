import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Ban,
  ClipboardList,
  Clock,
  FileSearch,
  FileSignature,
  Lock,
  RotateCcw,
  Wallet,
  Pencil,
  RefreshCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import {
  ClaimStatusBadge,
  RegulatoryStatusBadge,
} from '../components/ClaimBadges';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';
import { TIRA_OPERATION_LABELS } from '../constants';
import { ApprovalsTab } from './detail/ApprovalsTab';
import { AssessmentTab } from './detail/AssessmentTab';
import { ClaimantsTab } from './detail/ClaimantsTab';
import { DocumentsTab } from './detail/DocumentsTab';
import { IntimationTab } from './detail/IntimationTab';
import { PaymentsTab } from './detail/PaymentsTab';
import { RejectionTab } from './detail/RejectionTab';
import { ReserveTab } from './detail/ReserveTab';
import { VoucherTab } from './detail/VoucherTab';
import { ReasonDialog } from '../components/ReasonDialog';
import { claimsApi } from '../api';
import {
  useClaim,
  useClaimAction,
  useClaimTimeline,
  useDeleteClaimDraft,
  useSubmitNotification,
} from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimDetail, ClaimRegulatoryOperation } from '../types';
import {
  claimCustomerName,
  claimErrorLines,
  claimUserName,
  formatClaimDate,
  formatClaimDateTime,
  formatClaimMoney,
} from '../utils';

function notificationOperation(claim: ClaimDetail) {
  return [...(claim.regulatory_operations ?? [])]
    .reverse()
    .find((operation) => operation.operation_type === 'NOTIFICATION');
}

/** Where the claim stands with TIRA for the notification (§9). */
function NotificationPanel({
  claim,
  onRetry,
  retrying,
}: {
  claim: ClaimDetail;
  onRetry?: () => void;
  retrying: boolean;
}) {
  const operation = notificationOperation(claim);

  if (claim.claim_reference_number) {
    return (
      <Alert variant="success">
        <AlertTitle>Registered with TIRA</AlertTitle>
        <AlertDescription>
          TIRA claim reference <strong>{claim.claim_reference_number}</strong>.
          It is used for every later stage and cannot be changed.
        </AlertDescription>
      </Alert>
    );
  }

  if (claim.status === 'NOTIFICATION_SUBMITTED') {
    return (
      <Alert variant="info">
        <Clock className="h-4 w-4" />
        <AlertTitle>Waiting for TIRA</AlertTitle>
        <AlertDescription>
          Notification {claim.claim_notification_number} was submitted
          {operation?.submitted_at
            ? ` on ${formatClaimDateTime(operation.submitted_at)}`
            : ''}
          . This page refreshes when TIRA responds with the claim reference.
        </AlertDescription>
      </Alert>
    );
  }

  if (claim.status === 'NOTIFICATION_FAILED') {
    return (
      <Alert variant="destructive">
        <AlertTitle>TIRA did not accept the notification</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {[operation?.final_response_code, operation?.final_response_message]
              .filter(Boolean)
              .join(' – ') ||
              operation?.acknowledgement_message ||
              'No reason was returned.'}
          </p>
          <p>Correct the claim if needed, then submit it again.</p>
          {onRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={retrying}
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              {retrying ? 'Resubmitting...' : 'Resubmit to TIRA'}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  if (claim.status === 'DRAFT') {
    return (
      <Alert>
        <Send className="h-4 w-4" />
        <AlertTitle>Not yet reported to TIRA</AlertTitle>
        <AlertDescription>
          Submit the claim notification to obtain the TIRA claim reference
          number. The draft can still be edited or deleted until then.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function OverviewTab({ claim }: { claim: ClaimDetail }) {
  return (
    <SectionCard title="Claim">
      <KeyValueGrid
        items={[
          { label: 'Claim number', value: claim.claim_no },
          {
            label: 'Notification number',
            value: claim.claim_notification_number ?? '-',
          },
          {
            label: 'TIRA claim reference',
            value: claim.claim_reference_number ?? '-',
          },
          {
            label: 'TIRA cover note',
            value: claim.cover_note_reference_number ?? '-',
          },
          {
            label: 'Status',
            value: <ClaimStatusBadge status={claim.status} />,
          },
          { label: 'Priority', value: humanizeCode(claim.priority) },
          { label: 'Assigned to', value: claimUserName(claim.assigned_user) },
          { label: 'Branch', value: claim.branch?.name ?? '-' },
          { label: 'Registered', value: formatClaimDateTime(claim.created_at) },
          {
            label: 'Coverage check',
            value: claim.coverage_status
              ? humanizeCode(claim.coverage_status)
              : '-',
          },
          ...(claim.duplicate_override_reason
            ? [
                {
                  label: 'Recorded despite possible duplicate',
                  value: claim.duplicate_override_reason,
                },
              ]
            : []),
        ]}
      />
    </SectionCard>
  );
}

function PolicyTab({ claim }: { claim: ClaimDetail }) {
  const risk = claim.policy_risk;
  const vehicle = risk?.motor_vehicle;
  const currency = claim.currency_code;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Policy"
        description="Read-only; taken from the policy."
      >
        <KeyValueGrid
          items={[
            { label: 'Policy', value: claim.policy?.policy_no ?? '-' },
            { label: 'Policyholder', value: claimCustomerName(claim.customer) },
            {
              label: 'Period of cover',
              value: `${formatClaimDate(claim.policy?.start_date)} – ${formatClaimDate(claim.policy?.end_date)}`,
            },
            {
              label: 'Line',
              value: claim.policy?.business_line
                ? humanizeCode(claim.policy.business_line)
                : '-',
            },
            {
              label: 'Sum insured',
              value: formatClaimMoney(claim.policy?.sum_insured, currency),
            },
            {
              label: 'Policy status',
              value: claim.policy?.policy_status
                ? humanizeCode(claim.policy.policy_status)
                : '-',
            },
          ]}
        />
      </SectionCard>
      <SectionCard title={vehicle ? 'Vehicle' : 'Risk'}>
        {risk ? (
          <KeyValueGrid
            items={[
              ...(vehicle
                ? [
                    {
                      label: 'Registration',
                      value: vehicle.registration_no ?? '-',
                    },
                    { label: 'Chassis', value: vehicle.chassis_no ?? '-' },
                    {
                      label: 'Make and model',
                      value:
                        [vehicle.make, vehicle.model]
                          .filter(Boolean)
                          .join(' ') || '-',
                    },
                  ]
                : []),
              {
                label: 'Risk',
                value: risk.risk?.name ?? risk.risk?.risk_name ?? '-',
              },
              {
                label: 'Sum insured',
                value: formatClaimMoney(risk.sum_insured, currency),
              },
            ]}
          />
        ) : (
          <EmptyState text="The claim is recorded against the policy as a whole." />
        )}
      </SectionCard>
    </div>
  );
}

function IncidentTab({ claim }: { claim: ClaimDetail }) {
  const details = Object.entries(claim.incident_details ?? {}).filter(
    ([, value]) => value != null && String(value).trim(),
  );
  const formReceived =
    claim.claim_form_dully_filled === true ||
    claim.claim_form_dully_filled === 'Y';

  return (
    <SectionCard title="Incident">
      <div className="space-y-4">
        <KeyValueGrid
          items={[
            { label: 'Loss date', value: formatClaimDateTime(claim.loss_date) },
            {
              label: 'Reported',
              value: formatClaimDateTime(claim.claim_report_date),
            },
            { label: 'Location', value: claim.loss_location ?? '-' },
            { label: 'Nature of loss', value: claim.loss_nature ?? '-' },
            { label: 'Type of loss', value: claim.loss_type ?? '-' },
            {
              label: 'Estimated amount',
              value: formatClaimMoney(
                claim.estimated_amount,
                claim.currency_code,
              ),
            },
            {
              label: 'Police report',
              value: claim.police_report_number ?? '-',
            },
            {
              label: 'Claim form received',
              value: formReceived ? 'Yes' : 'No',
            },
            {
              label: 'Reported via',
              value: claim.notification_source
                ? humanizeCode(claim.notification_source)
                : '-',
            },
            { label: 'Reported by', value: claim.reporter_name ?? '-' },
            ...details.map(([key, value]) => ({
              label: humanizeCode(key),
              value: String(value),
            })),
          ]}
        />
        {claim.description ? (
          <p className="whitespace-pre-line text-sm text-slate-700">
            {claim.description}
          </p>
        ) : null}
        {claim.cause_of_loss ? (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Cause: </span>
            {claim.cause_of_loss}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function TiraTab({ operations }: { operations: ClaimRegulatoryOperation[] }) {
  // The server strips payloads without this permission; this only explains why.
  const canViewPayload = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.TIRAMIS_VIEW_PAYLOAD),
  );

  if (operations.length === 0) {
    return <EmptyState text="Nothing has been submitted to TIRAMIS yet." />;
  }

  return (
    <div className="space-y-4">
      {operations.map((operation) => (
        <SectionCard
          key={operation.id}
          title={
            TIRA_OPERATION_LABELS[operation.operation_type] ??
            humanizeCode(operation.operation_type)
          }
          description={operation.source_record_number ?? undefined}
          action={<RegulatoryStatusBadge status={operation.status} />}
        >
          <KeyValueGrid
            items={[
              {
                label: 'Submitted',
                value: formatClaimDateTime(operation.submitted_at),
              },
              {
                label: 'Completed',
                value: formatClaimDateTime(operation.completed_at),
              },
              {
                label: 'Acknowledgement',
                value:
                  [
                    operation.acknowledgement_code,
                    operation.acknowledgement_message,
                  ]
                    .filter(Boolean)
                    .join(' – ') || '-',
              },
              {
                label: 'Final response',
                value:
                  [
                    operation.final_response_code,
                    operation.final_response_message,
                  ]
                    .filter(Boolean)
                    .join(' – ') || '-',
              },
              {
                label: 'TIRA reference',
                value: operation.regulatory_reference ?? '-',
              },
            ]}
          />
          {canViewPayload ? (
            <>
              <PayloadDetails
                label="Request payload"
                payload={operation.request_snapshot}
              />
              <PayloadDetails
                label="Response payload"
                payload={operation.response_snapshot}
              />
            </>
          ) : null}
        </SectionCard>
      ))}
      {canViewPayload ? null : (
        <p className="text-xs text-slate-500">
          Request and response payloads are shown only to users allowed to view
          TIRAMIS payloads.
        </p>
      )}
    </div>
  );
}

function PayloadDetails({
  label,
  payload,
}: {
  label: string;
  payload: unknown;
}) {
  if (payload == null) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-slate-600">{label}</summary>
      <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  );
}

function ActivityTab({ claimId }: { claimId: string }) {
  const timeline = useClaimTimeline(claimId);

  if (timeline.isLoading) return <Skeleton className="h-40 w-full" />;
  if (timeline.isError)
    return <EmptyState text="The activity could not be loaded." />;

  return (
    <ActivityTimeline
      entries={[...(timeline.data ?? [])].reverse().map((event) => ({
        id: event.id,
        dateTime: event.created_at,
        action: event.summary ?? event.event_type,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        performedBy: event.actor_name,
      }))}
      renderStatus={(status) => <ClaimStatusBadge status={status} />}
    />
  );
}

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const claimQuery = useClaim(id);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const setTab = (next: string) =>
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        if (next === 'overview') updated.delete('tab');
        else updated.set('tab', next);
        return updated;
      },
      { replace: true },
    );
  const submit = useSubmitNotification();
  const remove = useDeleteClaimDraft();
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  const [lifecycle, setLifecycle] = useState<'close' | 'reopen' | null>(null);
  const changeLifecycle = useClaimAction(
    id ?? '',
    ({ kind, reason }: { kind: 'close' | 'reopen'; reason: string }) =>
      kind === 'close'
        ? claimsApi.closeClaim(id!, reason)
        : claimsApi.reopenClaim(id!, reason),
    (result) =>
      `Claim ${result.claim_no} ${result.status === 'CLOSED' ? 'closed' : 'reopened'}`,
  );

  if (claimQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (claimQuery.isError || !claimQuery.data) {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-slate-600">
        <p>This claim was not found or you do not have access to it.</p>
        <Button variant="outline" onClick={() => navigate(claimsPaths.list)}>
          Back to claims
        </Button>
      </div>
    );
  }

  const claim = claimQuery.data;
  const actions = new Set(claim.allowed_actions ?? []);
  const currency = claim.currency_code;

  const runSubmit = (retry: boolean) =>
    submit.mutate(
      { id: claim.id, retry },
      {
        onSuccess: () =>
          toast.success('Notification submitted to TIRAMIS', {
            description: 'The claim reference arrives when TIRA responds.',
          }),
        onSettled: () => setConfirm(null),
      },
    );

  return (
    <div className="space-y-6">
      <DetailPageHeader
        onBack={() => navigate(claimsPaths.list)}
        title={claim.claim_no}
        badges={
          <>
            <ClaimStatusBadge status={claim.status} />
            {claim.claim_reference_number ? (
              <Badge variant="outline">
                TIRA {claim.claim_reference_number}
              </Badge>
            ) : null}
          </>
        }
        subtitle={[
          claim.policy?.policy_no,
          claimCustomerName(claim.customer),
          claim.loss_nature,
        ]
          .filter((part) => part && part !== '-')
          .join(' · ')}
        kpis={[
          {
            label: 'Estimated',
            value: formatClaimMoney(claim.estimated_amount, currency),
          },
          {
            label: 'Reserve',
            value: formatClaimMoney(claim.outstanding_reserve, currency),
          },
          {
            label: 'Approved',
            value: formatClaimMoney(claim.approved_amount, currency),
          },
          {
            label: 'Paid',
            value: formatClaimMoney(claim.paid_amount, currency),
          },
          {
            label: 'Outstanding',
            value: formatClaimMoney(claim.outstanding_amount, currency),
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {actions.has('edit') ? (
              <Button
                variant="outline"
                onClick={() => navigate(claimsPaths.edit(claim.id))}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {actions.has('delete') ? (
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete draft
              </Button>
            ) : null}
            {actions.has('create_intimation') ||
            actions.has('submit_intimation') ? (
              <Button onClick={() => setTab('intimation')}>
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Intimation
              </Button>
            ) : null}
            {actions.has('create_discharge') ? (
              <Button onClick={() => setTab('voucher')}>
                <FileSignature className="mr-1.5 h-4 w-4" />
                Discharge voucher
              </Button>
            ) : null}
            {actions.has('create_payment') ? (
              <Button onClick={() => setTab('payments')}>
                <Wallet className="mr-1.5 h-4 w-4" />
                Payments
              </Button>
            ) : null}
            {actions.has('reject') ? (
              <Button variant="outline" onClick={() => setTab('rejection')}>
                <Ban className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
            ) : null}
            {actions.has('close') ? (
              <Button variant="outline" onClick={() => setLifecycle('close')}>
                <Lock className="mr-1.5 h-4 w-4" />
                Close claim
              </Button>
            ) : null}
            {actions.has('reopen') ? (
              <Button variant="outline" onClick={() => setLifecycle('reopen')}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reopen
              </Button>
            ) : null}
            {actions.has('create_assessment') ? (
              <Button onClick={() => setTab('assessment')}>
                <FileSearch className="mr-1.5 h-4 w-4" />
                Assessment
              </Button>
            ) : null}
            {actions.has('submit_notification') ? (
              <Button
                onClick={() => setConfirm('submit')}
                disabled={submit.isPending}
              >
                <Send className="mr-1.5 h-4 w-4" />
                Submit to TIRA
              </Button>
            ) : null}
          </div>
        }
      />

      {submit.error ? (
        <ClaimErrorAlert
          error={submit.error}
          title="The notification was not submitted"
        />
      ) : null}

      <NotificationPanel
        claim={claim}
        retrying={submit.isPending}
        onRetry={
          actions.has('retry_notification') ? () => runSubmit(true) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policy">Policy & Risk</TabsTrigger>
          <TabsTrigger value="incident">Incident</TabsTrigger>
          <TabsTrigger value="claimants">Claimants</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="intimation">Intimation</TabsTrigger>
          <TabsTrigger value="reserve">Reserve</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="voucher">Discharge Voucher</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="rejection">Rejection</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="tira">TIRA Transactions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab claim={claim} />
        </TabsContent>
        <TabsContent value="policy">
          <PolicyTab claim={claim} />
        </TabsContent>
        <TabsContent value="incident">
          <IncidentTab claim={claim} />
        </TabsContent>
        <TabsContent value="claimants">
          <ClaimantsTab claim={claim} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab claim={claim} />
        </TabsContent>
        <TabsContent value="intimation">
          <IntimationTab claim={claim} />
        </TabsContent>
        <TabsContent value="reserve">
          <ReserveTab claim={claim} />
        </TabsContent>
        <TabsContent value="assessment">
          <AssessmentTab claim={claim} />
        </TabsContent>
        <TabsContent value="voucher">
          <VoucherTab claim={claim} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab claim={claim} />
        </TabsContent>
        <TabsContent value="rejection">
          <RejectionTab claim={claim} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsTab claim={claim} />
        </TabsContent>
        <TabsContent value="tira">
          <TiraTab operations={claim.regulatory_operations ?? []} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab claimId={claim.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm === 'submit'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Submit claim notification to TIRA"
        description={`Notification ${claim.claim_notification_number} will be sent to TIRAMIS. After TIRA accepts it the claim can no longer be edited or deleted.`}
        confirmLabel="Submit"
        variant="default"
        loading={submit.isPending}
        onConfirm={() => runSubmit(false)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete draft claim"
        description={`Draft ${claim.claim_no} will be cancelled and removed from the claim lists. It was never reported to TIRA.`}
        confirmLabel="Delete draft"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(claim.id, {
            onSuccess: () => {
              toast.success(`Draft ${claim.claim_no} deleted`);
              navigate(claimsPaths.list);
            },
            onError: (error) => {
              setConfirm(null);
              toast.error(claimErrorLines(error).message);
            },
          })
        }
      />
      {lifecycle ? (
        <ReasonDialog
          title={
            lifecycle === 'close'
              ? `Close claim ${claim.claim_no}`
              : `Reopen claim ${claim.claim_no}`
          }
          description={
            lifecycle === 'close'
              ? 'Any remaining reserve is released. A claim can only be closed once TIRA has accepted every submission.'
              : 'The claim returns to assessment; a new assessment is reported to TIRA as a reassessment.'
          }
          label={
            lifecycle === 'close' ? 'Closure reason' : 'Reason for reopening'
          }
          confirmLabel={lifecycle === 'close' ? 'Close claim' : 'Reopen claim'}
          destructive={lifecycle === 'close'}
          pending={changeLifecycle.isPending}
          error={changeLifecycle.error}
          onClose={() => {
            changeLifecycle.reset();
            setLifecycle(null);
          }}
          onConfirm={(reason) =>
            changeLifecycle.mutate(
              { kind: lifecycle, reason },
              { onSuccess: () => setLifecycle(null) },
            )
          }
        />
      ) : null}
    </div>
  );
}
