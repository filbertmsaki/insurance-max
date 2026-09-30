import { useState } from 'react';
import { Pencil, Plus, RefreshCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { claimsApi } from '../../api';
import { operationFor, pendingApproval, userName } from '../../claim-records';
import {
  ApprovalDecisionDialog,
  type ApprovalDecision,
} from '../../components/ApprovalDecisionDialog';
import { AssessmentDialog } from '../../components/AssessmentDialog';
import { RegulatoryStatusBadge } from '../../components/ClaimBadges';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import { useClaimAction } from '../../hooks';
import { ASSESSMENT_DEDUCTIONS, assessmentDefaults } from '../../stage-schemas';
import type {
  AssessmentPayload,
  ClaimAssessment,
  ClaimDetail,
} from '../../types';
import {
  formatClaimDate,
  formatClaimDateTime,
  formatClaimMoney,
} from '../../utils';

const STATUS_TONE: Record<string, 'muted' | 'warning' | 'success' | 'danger'> =
  {
    DRAFT: 'muted',
    SUBMITTED: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    SUPERSEDED: 'muted',
  };

/** TIRA statuses after which an approved assessment is not resent. */
const TIRA_DONE = new Set(['ACCEPTED', 'QUEUED', 'PROCESSING', 'ACKNOWLEDGED']);

type Decision = { assessment: ClaimAssessment; kind: 'APPROVE' | 'DECLINE' };

export function AssessmentTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actions = new Set(claim.allowed_actions ?? []);
  const currency = claim.currency_code;
  const assessments = claim.assessments ?? [];
  const canEdit =
    hasPermission(ClaimsPermissions.ASSESSMENT_UPDATE) ||
    hasPermission(ClaimsPermissions.ASSESSMENT_CREATE);
  const canSubmit =
    hasPermission(ClaimsPermissions.ASSESSMENT_SUBMIT) ||
    hasPermission(ClaimsPermissions.ASSESSMENT_CREATE);
  const canApprove =
    hasPermission(ClaimsPermissions.APPROVE) ||
    hasPermission(ClaimsPermissions.ASSESSMENT_APPROVE);
  const canReport =
    hasPermission(ClaimsPermissions.ASSESSMENT_SUBMIT) ||
    hasPermission(ClaimsPermissions.TIRAMIS_RETRY);
  const hasOpen = assessments.some((item) =>
    ['DRAFT', 'SUBMITTED'].includes(item.status),
  );
  const isReassessment = assessments.some((item) => item.status === 'APPROVED');

  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; assessment: ClaimAssessment } | null
  >(null);
  const [submitting, setSubmitting] = useState<ClaimAssessment | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  const save = useClaimAction(
    claim.id,
    (payload: AssessmentPayload) =>
      dialog?.mode === 'edit'
        ? claimsApi.updateAssessment(dialog.assessment.id, payload)
        : claimsApi.createAssessment(claim.id, payload),
    'Assessment saved',
  );
  const submit = useClaimAction(
    claim.id,
    (assessment: ClaimAssessment) => claimsApi.submitAssessment(assessment.id),
    'Assessment submitted for approval',
  );
  const decide = useClaimAction(
    claim.id,
    async ({
      assessment,
      choice,
      comments,
    }: Decision & { choice: ApprovalDecision; comments: string }) => {
      if (choice === 'APPROVE') {
        const result = await claimsApi.approveAssessment(
          assessment.id,
          comments || undefined,
        );
        toast.success(
          result.completed
            ? 'Assessment approved and reported to TIRAMIS'
            : 'Approval recorded; the next approval level is required',
        );
        return result;
      }
      const result = await claimsApi.declineAssessment(assessment.id, {
        comments,
        decision: choice === 'RETURN' ? 'RETURN' : 'REJECT',
      });
      toast.success(
        choice === 'RETURN'
          ? 'Assessment returned for rework'
          : 'Assessment declined',
      );
      return result;
    },
  );
  const report = useClaimAction(
    claim.id,
    ({ assessment, retry }: { assessment: ClaimAssessment; retry: boolean }) =>
      claimsApi.submitAssessmentToTiramis(assessment.id, retry),
    'Assessment submitted to TIRAMIS',
  );

  return (
    <div className="space-y-4">
      <ClaimErrorAlert
        error={submit.error}
        title="The assessment was not submitted"
      />
      <ClaimErrorAlert
        error={report.error}
        title="The assessment was not sent to TIRA"
      />

      {actions.has('create_assessment') && !hasOpen ? (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus className="mr-1.5 h-4 w-4" />
            {isReassessment ? 'Start reassessment' : 'Record assessment'}
          </Button>
        </div>
      ) : null}

      {assessments.length === 0 ? (
        <EmptyState
          text={
            actions.has('create_assessment')
              ? 'No assessment recorded yet.'
              : 'The claim can be assessed once TIRA has accepted the intimation.'
          }
        />
      ) : null}

      {assessments.map((assessment) => {
        const operation = operationFor(claim, 'ASSESSMENT', assessment.id);
        const pending = pendingApproval(claim, assessment.id);
        const approved = ['APPROVED', 'SUPERSEDED'].includes(assessment.status);
        const needsReport =
          approved && (!operation || !TIRA_DONE.has(operation.status));
        const breakdown = ASSESSMENT_DEDUCTIONS.filter(
          (item) => Number(assessment[item.key] ?? 0) > 0,
        ).map((item) => ({
          label: item.label,
          value: formatClaimMoney(assessment[item.key], currency),
        }));

        return (
          <SectionCard
            key={assessment.id}
            title={`Assessment ${assessment.claim_assessment_number ?? ''}`}
            description={`Recorded ${formatClaimDateTime(assessment.created_at)} by ${userName(claim, assessment.created_by)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {assessment.is_re_assessment === 'Y' ? (
                  <Badge variant="info">Reassessment</Badge>
                ) : null}
                <Badge variant={STATUS_TONE[assessment.status] ?? 'muted'}>
                  {humanizeCode(assessment.status)}
                </Badge>
                {operation ? (
                  <RegulatoryStatusBadge status={operation.status} />
                ) : null}
              </div>
            }
          >
            <div className="space-y-4">
              <KeyValueGrid
                items={[
                  {
                    label: 'Assessed loss',
                    value: formatClaimMoney(
                      assessment.assessment_amount,
                      currency,
                    ),
                  },
                  {
                    label: 'Recommended claim amount',
                    value: formatClaimMoney(
                      assessment.approved_claim_amount,
                      currency,
                    ),
                  },
                  ...breakdown,
                  {
                    label: 'Report received',
                    value: formatClaimDateTime(
                      assessment.assessment_received_date,
                    ),
                  },
                  {
                    label: 'Assessor',
                    value:
                      [assessment.assessor_name, assessment.assessor_company]
                        .filter(Boolean)
                        .join(' · ') || '-',
                    meta: assessment.inspection_date
                      ? `Inspected ${formatClaimDate(assessment.inspection_date)}`
                      : undefined,
                  },
                  ...(pending
                    ? [
                        {
                          label: 'Approval',
                          value: `Level ${pending.level} of ${pending.required_levels} pending`,
                          meta: `Submitted by ${userName(claim, pending.submitted_by)}`,
                        },
                      ]
                    : []),
                  ...(assessment.approved_at
                    ? [
                        {
                          label: 'Approved',
                          value: formatClaimDateTime(assessment.approved_at),
                          meta:
                            assessment.claim_approval_authority ?? undefined,
                        },
                      ]
                    : []),
                ]}
              />
              <p className="whitespace-pre-line text-sm text-slate-700">
                {assessment.assessment_report_summary}
              </p>
              {assessment.rejection_reason ? (
                <p className="text-sm text-red-600">
                  Declined: {assessment.rejection_reason}
                </p>
              ) : null}
              {operation?.final_response_message &&
              operation.status !== 'ACCEPTED' ? (
                <p className="text-sm text-red-600">
                  TIRA: {operation.final_response_code}{' '}
                  {operation.final_response_message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {assessment.status === 'DRAFT' && canEdit ? (
                  <Button
                    variant="outline"
                    onClick={() => setDialog({ mode: 'edit', assessment })}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {assessment.status === 'DRAFT' && canSubmit ? (
                  <Button onClick={() => setSubmitting(assessment)}>
                    <Send className="mr-1.5 h-4 w-4" />
                    Submit for approval
                  </Button>
                ) : null}
                {assessment.status === 'SUBMITTED' && canApprove ? (
                  <>
                    <Button
                      onClick={() =>
                        setDecision({ assessment, kind: 'APPROVE' })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDecision({ assessment, kind: 'DECLINE' })
                      }
                    >
                      Decline or return
                    </Button>
                  </>
                ) : null}
                {needsReport && canReport ? (
                  <Button
                    variant="outline"
                    disabled={report.isPending}
                    onClick={() =>
                      report.mutate({ assessment, retry: !!operation })
                    }
                  >
                    <RefreshCcw className="mr-1.5 h-4 w-4" />
                    {operation ? 'Resubmit to TIRA' : 'Send to TIRA'}
                  </Button>
                ) : null}
              </div>
            </div>
          </SectionCard>
        );
      })}

      {dialog ? (
        <AssessmentDialog
          title={
            dialog.mode === 'edit'
              ? `Edit assessment ${dialog.assessment.claim_assessment_number ?? ''}`
              : isReassessment
                ? 'Start reassessment'
                : 'Record assessment'
          }
          initial={assessmentDefaults(
            dialog.mode === 'edit' ? dialog.assessment : null,
          )}
          currency={currency}
          isReassessment={
            dialog.mode === 'edit'
              ? dialog.assessment.is_re_assessment === 'Y'
              : isReassessment
          }
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setDialog(null);
          }}
          onSave={(payload) =>
            save.mutate(payload, { onSuccess: () => setDialog(null) })
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!submitting}
        onOpenChange={(open) => !open && setSubmitting(null)}
        title="Submit assessment for approval"
        description={`Assessment ${submitting?.claim_assessment_number ?? ''} recommends ${formatClaimMoney(
          submitting?.approved_claim_amount,
          currency,
        )}. It can no longer be edited once submitted.`}
        confirmLabel="Submit"
        variant="default"
        loading={submit.isPending}
        onConfirm={() =>
          submitting &&
          submit.mutate(submitting, { onSettled: () => setSubmitting(null) })
        }
      />

      {decision ? (
        <ApprovalDecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              decide.reset();
              setDecision(null);
            }
          }}
          title={`${decision.kind === 'APPROVE' ? 'Approve' : 'Decline'} assessment ${decision.assessment.claim_assessment_number ?? ''}`}
          summary={`Recommended claim amount ${formatClaimMoney(
            decision.assessment.approved_claim_amount,
            currency,
          )}. The final approval sets the claim's approved amount, aligns the reserve and reports the assessment to TIRA.`}
          decision={decision.kind}
          allowReturn
          pending={decide.isPending}
          error={decide.error}
          onConfirm={(choice, comments) =>
            decide.mutate(
              { ...decision, choice, comments },
              { onSuccess: () => setDecision(null) },
            )
          }
        />
      ) : null}
    </div>
  );
}
