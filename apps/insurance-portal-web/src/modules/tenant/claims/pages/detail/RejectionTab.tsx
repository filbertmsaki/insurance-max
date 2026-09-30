import { useState } from 'react';
import { Ban, Download, FileText, Info, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { claimsApi } from '../../api';
import { operationFor, pendingApproval, userName } from '../../claim-records';
import {
  ApprovalDecisionDialog,
  type ApprovalDecision,
} from '../../components/ApprovalDecisionDialog';
import { RegulatoryStatusBadge } from '../../components/ClaimBadges';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import { RejectionDialog } from '../../components/RejectionDialog';
import { useClaimAction } from '../../hooks';
import { rejectionDefaults } from '../../stage-schemas';
import type {
  ClaimDetail,
  ClaimRejection,
  RejectionPayload,
} from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const STATUS_TONE: Record<string, 'muted' | 'warning' | 'danger'> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'danger',
  CANCELLED: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Claim rejected',
  CANCELLED: 'Not approved',
};

const TIRA_DONE = new Set(['ACCEPTED', 'QUEUED', 'PROCESSING', 'ACKNOWLEDGED']);

type Dialog =
  | { kind: 'create' }
  | { kind: 'approve' | 'decline'; rejection: ClaimRejection };

/** Claim rejection (TIRAMIS §14): recommend, approve, report, letter. */
export function RejectionTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actions = new Set(claim.allowed_actions ?? []);
  const currency = claim.currency_code;
  const rejections = claim.rejections ?? [];
  const intimated = (claim.intimations ?? []).some(
    (intimation) => intimation.status === 'ACCEPTED',
  );
  const canApprove =
    hasPermission(ClaimsPermissions.REJECTION_APPROVE) ||
    hasPermission(ClaimsPermissions.APPROVE);
  const canReport =
    hasPermission(ClaimsPermissions.REJECTION_SUBMIT) ||
    hasPermission(ClaimsPermissions.TIRAMIS_SUBMIT) ||
    hasPermission(ClaimsPermissions.TIRAMIS_RETRY);
  const canLetter =
    hasPermission(ClaimsPermissions.REJECTION_CREATE) ||
    hasPermission(ClaimsPermissions.REJECTION_APPROVE);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);

  const create = useClaimAction(
    claim.id,
    (payload: RejectionPayload) => claimsApi.createRejection(claim.id, payload),
    'Rejection submitted for approval',
  );
  const decide = useClaimAction(
    claim.id,
    async ({
      rejection,
      choice,
      comments,
    }: {
      rejection: ClaimRejection;
      choice: ApprovalDecision;
      comments: string;
    }) => {
      if (choice === 'APPROVE') {
        const result = await claimsApi.approveRejection(
          rejection.id,
          comments || undefined,
        );
        toast.success(
          result.completed
            ? 'Claim rejected'
            : 'Approval recorded; the next approval level is required',
        );
        return result;
      }
      return claimsApi.declineRejection(rejection.id, comments);
    },
  );
  const report = useClaimAction(
    claim.id,
    ({ rejection, retry }: { rejection: ClaimRejection; retry: boolean }) =>
      claimsApi.submitRejectionToTiramis(rejection.id, retry),
    'Rejection submitted to TIRAMIS',
  );
  const letter = useClaimAction(
    claim.id,
    (rejection: ClaimRejection) =>
      claimsApi.generateRejectionLetter(rejection.id),
    'Rejection letter generated',
  );

  const download = (rejection: ClaimRejection) =>
    rejection.letter_document_id
      ? void engagementApi
          .downloadDocument(
            rejection.letter_document_id,
            `${rejection.claim_rejection_number ?? 'claim-rejection'}.pdf`,
          )
          .catch(() => toast.error('The letter could not be downloaded'))
      : undefined;

  return (
    <div className="space-y-4">
      <ClaimErrorAlert
        error={report.error}
        title="The rejection was not sent to TIRA"
      />
      <ClaimErrorAlert
        error={letter.error}
        title="The rejection letter was not generated"
      />

      <SectionCard
        title="Rejection"
        description="A rejected claim is never deleted: it keeps its history, is reported to TIRA and can then be closed (§14)."
        action={
          actions.has('reject') ? (
            <Button
              variant="destructive"
              onClick={() => setDialog({ kind: 'create' })}
            >
              <Ban className="mr-1.5 h-4 w-4" />
              Recommend rejection
            </Button>
          ) : undefined
        }
      >
        {!intimated && actions.has('reject') ? (
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Not reportable to TIRA</AlertTitle>
            <AlertDescription>
              This claim has no accepted intimation. TIRA needs the intimation
              number to receive a rejection, so it will be rejected internally
              only and can then be closed.
            </AlertDescription>
          </Alert>
        ) : null}
        {rejections.length === 0 ? (
          <EmptyState
            text={
              actions.has('reject')
                ? 'The claim has not been recommended for rejection.'
                : 'A claim cannot be rejected once payments have started or a voucher has been accepted.'
            }
          />
        ) : null}
      </SectionCard>

      {rejections.map((rejection) => {
        const operation = operationFor(claim, 'REJECTION', rejection.id);
        const pending = pendingApproval(claim, rejection.id);
        const approved = rejection.status === 'APPROVED';
        const reportable = !!rejection.claim_intimation_number;
        const reported = !!operation && TIRA_DONE.has(operation.status);

        return (
          <SectionCard
            key={rejection.id}
            title={`Rejection ${rejection.claim_rejection_number ?? ''}`}
            description={`Recommended ${formatClaimDateTime(rejection.created_at)} by ${userName(claim, rejection.created_by)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[rejection.status] ?? 'muted'}>
                  {STATUS_LABEL[rejection.status] ??
                    humanizeCode(rejection.status)}
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
                    label: 'Reason reported to TIRA',
                    value: rejection.tira_rejection_reason ?? '-',
                  },
                  {
                    label: 'Claimed amount',
                    value: formatClaimMoney(
                      rejection.claim_amount,
                      rejection.currency_code ?? currency,
                    ),
                  },
                  {
                    label: 'Policy clause',
                    value: rejection.policy_clause_reference ?? '-',
                  },
                  {
                    label: 'Litigation',
                    value:
                      rejection.claim_resulted_litigation === 'Y'
                        ? 'Yes'
                        : 'No',
                  },
                  {
                    label: 'Intimation',
                    value: rejection.claim_intimation_number ?? 'Not intimated',
                  },
                  ...(approved
                    ? [
                        {
                          label: 'Approved',
                          value: formatClaimDateTime(rejection.approved_at),
                          meta: `by ${userName(claim, rejection.approved_by)}`,
                        },
                      ]
                    : []),
                  ...(pending
                    ? [
                        {
                          label: 'Approval',
                          value: `Level ${pending.level} of ${pending.required_levels} pending`,
                        },
                      ]
                    : []),
                ]}
              />
              {rejection.rejection_reason ? (
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {rejection.rejection_reason}
                </p>
              ) : null}
              {rejection.recommendation ? (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Recommendation: </span>
                  {rejection.recommendation}
                </p>
              ) : null}
              {operation?.final_response_message &&
              operation.status !== 'ACCEPTED' ? (
                <p className="text-sm text-red-600">
                  TIRA: {operation.final_response_code}{' '}
                  {operation.final_response_message}
                </p>
              ) : null}
              {approved && !reportable ? (
                <p className="text-sm text-slate-600">
                  Not reported to TIRA: the claim was rejected before
                  intimation. Close the claim to finish it.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {rejection.status === 'PENDING_APPROVAL' && canApprove ? (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setDialog({ kind: 'approve', rejection })}
                    >
                      Approve rejection
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ kind: 'decline', rejection })}
                    >
                      Do not reject
                    </Button>
                  </>
                ) : null}
                {approved && reportable && !reported && canReport ? (
                  <Button
                    variant="outline"
                    disabled={report.isPending}
                    onClick={() =>
                      report.mutate({ rejection, retry: !!operation })
                    }
                  >
                    <RefreshCcw className="mr-1.5 h-4 w-4" />
                    {operation ? 'Resubmit to TIRA' : 'Send to TIRA'}
                  </Button>
                ) : null}
                {approved && canLetter ? (
                  rejection.letter_document_id ? (
                    <Button
                      variant="outline"
                      onClick={() => download(rejection)}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Download letter
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={letter.isPending}
                      onClick={() => letter.mutate(rejection)}
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      Generate rejection letter
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          </SectionCard>
        );
      })}

      {dialog?.kind === 'create' ? (
        <RejectionDialog
          initial={rejectionDefaults(claim.estimated_amount)}
          intimated={intimated}
          currency={currency}
          pending={create.isPending}
          error={create.error}
          onClose={() => {
            create.reset();
            close();
          }}
          onSave={(payload) => create.mutate(payload, { onSuccess: close })}
        />
      ) : null}

      {dialog?.kind === 'approve' || dialog?.kind === 'decline' ? (
        <ApprovalDecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              decide.reset();
              close();
            }
          }}
          title={`${dialog.kind === 'approve' ? 'Approve' : 'Decline'} rejection ${dialog.rejection.claim_rejection_number ?? ''}`}
          summary={
            dialog.kind === 'approve'
              ? 'The final approval rejects the claim and reports the rejection to TIRA.'
              : 'The claim returns to the status it had before the recommendation.'
          }
          decision={dialog.kind === 'approve' ? 'APPROVE' : 'DECLINE'}
          declineLabel="Do not reject"
          pending={decide.isPending}
          error={decide.error}
          onConfirm={(choice, comments) =>
            decide.mutate(
              { rejection: dialog.rejection, choice, comments },
              { onSuccess: close },
            )
          }
        />
      ) : null}
    </div>
  );
}
