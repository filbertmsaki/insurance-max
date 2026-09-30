import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Pencil, RefreshCcw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  CLAIMANT_CATEGORY_OPTIONS,
  CLAIMANT_TYPE_OPTIONS,
  ID_TYPE_OPTIONS,
  PARTY_TYPE_OPTIONS,
  TIRA_OPERATION_LABELS,
} from '../constants';
import {
  useClaim,
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

const optionLabel = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: unknown,
) =>
  value == null || value === ''
    ? '-'
    : (options.find((option) => option.value === String(value))?.label ??
      String(value));

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

function ClaimantsTab({ claim }: { claim: ClaimDetail }) {
  const claimants = (claim.claimants ?? []).filter(
    (claimant) => claimant.status !== 'REMOVED',
  );

  if (claimants.length === 0)
    return <EmptyState text="No claimants recorded." />;

  return (
    <div className="space-y-4">
      {claimants.map((claimant) => (
        <SectionCard
          key={claimant.id}
          title={claimant.full_name ?? 'Claimant'}
          description={[
            optionLabel(CLAIMANT_TYPE_OPTIONS, claimant.claimant_type),
            claimant.is_primary ? 'Primary' : null,
            claimant.uses_policyholder ? 'Policyholder record' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <KeyValueGrid
            items={[
              {
                label: 'TIRA category',
                value: optionLabel(
                  CLAIMANT_CATEGORY_OPTIONS,
                  claimant.claimant_category,
                ),
              },
              {
                label: 'Type',
                value: optionLabel(PARTY_TYPE_OPTIONS, claimant.party_type),
              },
              {
                label: 'ID',
                value: `${optionLabel(ID_TYPE_OPTIONS, claimant.id_type)} ${claimant.identification_number ?? ''}`,
              },
              { label: 'Phone', value: claimant.phone ?? '-' },
              { label: 'Email', value: claimant.email ?? '-' },
              {
                label: 'Address',
                value:
                  [
                    claimant.street,
                    claimant.district,
                    claimant.region,
                    claimant.country_code,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-',
              },
              {
                label: 'Amount claimed',
                value: formatClaimMoney(
                  claimant.amount_claimed,
                  claim.currency_code,
                ),
              },
            ]}
          />
        </SectionCard>
      ))}
    </div>
  );
}

function TiraTab({ operations }: { operations: ClaimRegulatoryOperation[] }) {
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
          {operation.request_snapshot ? (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-slate-600">
                Request payload
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3">
                {JSON.stringify(operation.request_snapshot, null, 2)}
              </pre>
            </details>
          ) : null}
        </SectionCard>
      ))}
    </div>
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
  const submit = useSubmitNotification();
  const remove = useDeleteClaimDraft();
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);

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

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policy">Policy & Risk</TabsTrigger>
          <TabsTrigger value="incident">Incident</TabsTrigger>
          <TabsTrigger value="claimants">Claimants</TabsTrigger>
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
    </div>
  );
}
