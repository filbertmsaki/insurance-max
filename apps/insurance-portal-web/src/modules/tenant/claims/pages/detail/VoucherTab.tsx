import { useState } from 'react';
import {
  Download,
  FileText,
  MessageSquareReply,
  Pencil,
  Plus,
  RefreshCcw,
  Scale,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { claimsApi } from '../../api';
import {
  activeClaimants,
  operationFor,
  pendingApproval,
  userName,
} from '../../claim-records';
import {
  ApprovalDecisionDialog,
  type ApprovalDecision,
} from '../../components/ApprovalDecisionDialog';
import { RegulatoryStatusBadge } from '../../components/ClaimBadges';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import {
  VoucherAdjustDialog,
  VoucherDialog,
  VoucherResponseDialog,
} from '../../components/VoucherDialogs';
import { useClaimAction } from '../../hooks';
import { voucherAdjustDefaults, voucherDefaults } from '../../stage-schemas';
import type {
  ClaimDetail,
  ClaimDischargeVoucher,
  VoucherAdjustPayload,
  VoucherPayload,
  VoucherResponsePayload,
} from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const STATUS_TONE: Record<
  string,
  'muted' | 'warning' | 'info' | 'success' | 'danger'
> = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  SENT_TO_CLAIMANT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  SENT_TO_CLAIMANT: 'Issued to claimant',
  ACCEPTED: 'Accepted by claimant',
  REJECTED: 'Rejected by claimant',
};

const OPEN = new Set(['DRAFT', 'SUBMITTED', 'SENT_TO_CLAIMANT', 'ACCEPTED']);
const TIRA_DONE = new Set(['ACCEPTED', 'QUEUED', 'PROCESSING', 'ACKNOWLEDGED']);

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; voucher: ClaimDischargeVoucher }
  | { kind: 'respond'; voucher: ClaimDischargeVoucher }
  | { kind: 'adjust'; voucher: ClaimDischargeVoucher }
  | { kind: 'approve' | 'decline'; voucher: ClaimDischargeVoucher };

export function VoucherTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actions = new Set(claim.allowed_actions ?? []);
  const currency = claim.currency_code;
  const vouchers = claim.discharge_vouchers ?? [];
  const claimants = activeClaimants(claim);
  const outstanding = Math.max(
    Number(claim.approved_amount ?? 0) - Number(claim.paid_amount ?? 0),
    0,
  );
  const canPrepare = hasPermission(ClaimsPermissions.DISCHARGE_CREATE);
  const canSubmit =
    hasPermission(ClaimsPermissions.DISCHARGE_SUBMIT) || canPrepare;
  const canApprove =
    hasPermission(ClaimsPermissions.DISCHARGE_APPROVE) ||
    hasPermission(ClaimsPermissions.APPROVE);
  const canReport =
    hasPermission(ClaimsPermissions.DISCHARGE_SUBMIT) ||
    hasPermission(ClaimsPermissions.TIRAMIS_RETRY);
  const hasOpen = vouchers.some((voucher) => OPEN.has(voucher.status));

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [submitting, setSubmitting] = useState<ClaimDischargeVoucher | null>(
    null,
  );
  const close = () => setDialog(null);

  const save = useClaimAction(
    claim.id,
    (payload: VoucherPayload) =>
      dialog?.kind === 'edit'
        ? claimsApi.updateVoucher(dialog.voucher.id, payload)
        : claimsApi.createVoucher(claim.id, payload),
    'Discharge voucher saved',
  );
  const submit = useClaimAction(
    claim.id,
    (voucher: ClaimDischargeVoucher) => claimsApi.submitVoucher(voucher.id),
    'Voucher submitted for approval',
  );
  const decide = useClaimAction(
    claim.id,
    async ({
      voucher,
      choice,
      comments,
    }: {
      voucher: ClaimDischargeVoucher;
      choice: ApprovalDecision;
      comments: string;
    }) => {
      if (choice === 'APPROVE') {
        const result = await claimsApi.approveVoucher(
          voucher.id,
          comments || undefined,
        );
        toast.success(
          result.completed
            ? 'Voucher approved and issued to the claimant'
            : 'Approval recorded; the next approval level is required',
        );
        return result;
      }
      return claimsApi.declineVoucher(voucher.id, {
        comments,
        decision: choice === 'RETURN' ? 'RETURN' : 'REJECT',
      });
    },
  );
  const respond = useClaimAction(
    claim.id,
    ({
      voucher,
      payload,
    }: {
      voucher: ClaimDischargeVoucher;
      payload: VoucherResponsePayload;
    }) => claimsApi.respondToVoucher(voucher.id, payload),
    'Claimant response recorded',
  );
  const adjust = useClaimAction(
    claim.id,
    ({
      voucher,
      payload,
    }: {
      voucher: ClaimDischargeVoucher;
      payload: VoucherAdjustPayload;
    }) => claimsApi.adjustVoucher(voucher.id, payload),
    'Voucher adjusted',
  );
  const report = useClaimAction(
    claim.id,
    ({ voucher, retry }: { voucher: ClaimDischargeVoucher; retry: boolean }) =>
      claimsApi.submitVoucherToTiramis(voucher.id, retry),
    'Discharge voucher submitted to TIRAMIS',
  );
  const generate = useClaimAction(
    claim.id,
    (voucher: ClaimDischargeVoucher) =>
      claimsApi.generateVoucherDocument(voucher.id),
    'Voucher document generated',
  );

  const download = (voucher: ClaimDischargeVoucher) =>
    voucher.generated_document_id
      ? void engagementApi
          .downloadDocument(
            voucher.generated_document_id,
            `${voucher.discharge_voucher_number ?? 'discharge-voucher'}.pdf`,
          )
          .catch(() =>
            toast.error('The voucher document could not be downloaded'),
          )
      : undefined;

  return (
    <div className="space-y-4">
      <ClaimErrorAlert
        error={submit.error}
        title="The voucher was not submitted"
      />
      <ClaimErrorAlert
        error={report.error}
        title="The voucher was not sent to TIRA"
      />
      <ClaimErrorAlert
        error={generate.error}
        title="The voucher document was not generated"
      />

      <SectionCard
        title="Discharge voucher"
        description="The settlement offer made to the claimant (§12). Payments can be made once the claimant accepts it."
        action={
          actions.has('create_discharge') && !hasOpen && canPrepare ? (
            <Button onClick={() => setDialog({ kind: 'create' })}>
              <Plus className="mr-1.5 h-4 w-4" />
              {vouchers.length ? 'New voucher version' : 'Prepare voucher'}
            </Button>
          ) : undefined
        }
      >
        <KeyValueGrid
          items={[
            {
              label: 'Approved amount',
              value: formatClaimMoney(claim.approved_amount, currency),
            },
            {
              label: 'Paid',
              value: formatClaimMoney(claim.paid_amount, currency),
            },
            {
              label: 'Outstanding approved',
              value: formatClaimMoney(outstanding, currency),
            },
          ]}
        />
      </SectionCard>

      {vouchers.length === 0 ? (
        <EmptyState
          text={
            actions.has('create_discharge')
              ? 'No voucher prepared yet.'
              : 'A voucher can be prepared once the assessment is approved.'
          }
        />
      ) : null}

      {vouchers.map((voucher) => {
        const operation = operationFor(claim, 'DISCHARGE_VOUCHER', voucher.id);
        const pending = pendingApproval(claim, voucher.id);
        const responded = ['ACCEPTED', 'REJECTED'].includes(voucher.status);
        const reportedToTira = !!operation && TIRA_DONE.has(operation.status);
        const canAdjust =
          ['SENT_TO_CLAIMANT', 'ACCEPTED', 'REJECTED'].includes(
            voucher.status,
          ) && operation?.status !== 'ACCEPTED';
        const addressee = voucher.claimant_id
          ? (claimants.find((item) => item.id === voucher.claimant_id)
              ?.full_name ?? 'Claimant')
          : 'All claimants';

        return (
          <SectionCard
            key={voucher.id}
            title={`Voucher ${voucher.discharge_voucher_number ?? ''} · v${voucher.version ?? 1}`}
            description={`Prepared ${formatClaimDateTime(voucher.created_at)} by ${userName(claim, voucher.created_by)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[voucher.status] ?? 'muted'}>
                  {STATUS_LABEL[voucher.status] ?? humanizeCode(voucher.status)}
                </Badge>
                {operation ? (
                  <RegulatoryStatusBadge status={operation.status} />
                ) : null}
              </div>
            }
          >
            <div className="space-y-4">
              {voucher.status === 'SENT_TO_CLAIMANT' ? (
                <Alert>
                  <MessageSquareReply className="h-4 w-4" />
                  <AlertDescription>
                    Record any adjustment or reconciliation before the
                    claimant’s response: the response reports the voucher to
                    TIRA.
                  </AlertDescription>
                </Alert>
              ) : null}
              <KeyValueGrid
                items={[
                  {
                    label: 'Offer',
                    value: formatClaimMoney(
                      voucher.claim_offer_amount,
                      currency,
                    ),
                    meta: `Assessment ${voucher.claim_assessment_number ?? '-'}`,
                  },
                  { label: 'Offered to', value: addressee },
                  {
                    label: 'Communicated',
                    value: formatClaimDateTime(
                      voucher.claim_offer_communication_date,
                    ),
                  },
                  ...(responded
                    ? [
                        {
                          label: 'Claimant response',
                          value:
                            voucher.status === 'ACCEPTED'
                              ? 'Accepted'
                              : 'Rejected',
                          meta: formatClaimDateTime(
                            voucher.claimant_response_date,
                          ),
                        },
                      ]
                    : []),
                  ...(voucher.adjustment_reason
                    ? [
                        {
                          label: 'Adjustment',
                          value: formatClaimMoney(
                            voucher.adjustment_amount,
                            currency,
                          ),
                          meta: voucher.adjustment_reason,
                        },
                      ]
                    : []),
                  ...(voucher.reconciliation_summary
                    ? [
                        {
                          label: 'Reconciled amount',
                          value: formatClaimMoney(
                            voucher.reconciled_amount,
                            currency,
                          ),
                          meta: voucher.reconciliation_summary,
                        },
                      ]
                    : []),
                  ...(pending
                    ? [
                        {
                          label: 'Approval',
                          value: `Level ${pending.level} of ${pending.required_levels} pending`,
                          meta: `Submitted by ${userName(claim, pending.submitted_by)}`,
                        },
                      ]
                    : []),
                ]}
              />
              {voucher.rejection_reason ? (
                <p className="text-sm text-red-600">
                  Not approved: {voucher.rejection_reason}
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
                {voucher.status === 'DRAFT' && canPrepare ? (
                  <Button
                    variant="outline"
                    onClick={() => setDialog({ kind: 'edit', voucher })}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {voucher.status === 'DRAFT' && canSubmit ? (
                  <Button onClick={() => setSubmitting(voucher)}>
                    <Send className="mr-1.5 h-4 w-4" />
                    Submit for approval
                  </Button>
                ) : null}
                {voucher.status === 'SUBMITTED' && canApprove ? (
                  <>
                    <Button
                      onClick={() => setDialog({ kind: 'approve', voucher })}
                    >
                      Approve and issue
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ kind: 'decline', voucher })}
                    >
                      Decline or return
                    </Button>
                  </>
                ) : null}
                {['SENT_TO_CLAIMANT', 'ACCEPTED'].includes(voucher.status) &&
                canPrepare ? (
                  voucher.generated_document_id ? (
                    <Button variant="outline" onClick={() => download(voucher)}>
                      <Download className="mr-1.5 h-4 w-4" />
                      Download voucher
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={generate.isPending}
                      onClick={() => generate.mutate(voucher)}
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      Generate voucher PDF
                    </Button>
                  )
                ) : null}
                {canAdjust && canSubmit ? (
                  <Button
                    variant="outline"
                    onClick={() => setDialog({ kind: 'adjust', voucher })}
                  >
                    <Scale className="mr-1.5 h-4 w-4" />
                    Adjust or reconcile
                  </Button>
                ) : null}
                {voucher.status === 'SENT_TO_CLAIMANT' && canSubmit ? (
                  <Button
                    onClick={() => setDialog({ kind: 'respond', voucher })}
                  >
                    <MessageSquareReply className="mr-1.5 h-4 w-4" />
                    Record claimant response
                  </Button>
                ) : null}
                {responded && !reportedToTira && canReport ? (
                  <Button
                    variant="outline"
                    disabled={report.isPending}
                    onClick={() =>
                      report.mutate({ voucher, retry: !!operation })
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

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <VoucherDialog
          title={
            dialog.kind === 'edit'
              ? `Edit voucher ${dialog.voucher.discharge_voucher_number ?? ''}`
              : 'Prepare discharge voucher'
          }
          initial={voucherDefaults(
            dialog.kind === 'edit' ? dialog.voucher : null,
            outstanding > 0 ? outstanding.toFixed(2) : undefined,
          )}
          claimants={claimants}
          outstanding={outstanding}
          currency={currency}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            close();
          }}
          onSave={(payload) => save.mutate(payload, { onSuccess: close })}
        />
      ) : null}

      {dialog?.kind === 'respond' ? (
        <VoucherResponseDialog
          offer={
            dialog.voucher.reconciled_amount ??
            dialog.voucher.claim_offer_amount
          }
          currency={currency}
          pending={respond.isPending}
          error={respond.error}
          onClose={() => {
            respond.reset();
            close();
          }}
          onSave={(payload) =>
            respond.mutate(
              { voucher: dialog.voucher, payload },
              { onSuccess: close },
            )
          }
        />
      ) : null}

      {dialog?.kind === 'adjust' ? (
        <VoucherAdjustDialog
          initial={voucherAdjustDefaults(dialog.voucher)}
          outstanding={outstanding}
          currency={currency}
          pending={adjust.isPending}
          error={adjust.error}
          onClose={() => {
            adjust.reset();
            close();
          }}
          onSave={(payload) =>
            adjust.mutate(
              { voucher: dialog.voucher, payload },
              { onSuccess: close },
            )
          }
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
          title={`${dialog.kind === 'approve' ? 'Approve' : 'Decline'} voucher ${dialog.voucher.discharge_voucher_number ?? ''}`}
          summary={`Offer of ${formatClaimMoney(dialog.voucher.claim_offer_amount, currency)}. The final approval issues it to the claimant.`}
          decision={dialog.kind === 'approve' ? 'APPROVE' : 'DECLINE'}
          allowReturn
          pending={decide.isPending}
          error={decide.error}
          onConfirm={(choice, comments) =>
            decide.mutate(
              { voucher: dialog.voucher, choice, comments },
              { onSuccess: close },
            )
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!submitting}
        onOpenChange={(open) => !open && setSubmitting(null)}
        title="Submit voucher for approval"
        description={`Voucher ${submitting?.discharge_voucher_number ?? ''} offers ${formatClaimMoney(submitting?.claim_offer_amount, currency)}. It can no longer be edited once submitted.`}
        confirmLabel="Submit"
        variant="default"
        loading={submit.isPending}
        onConfirm={() =>
          submitting &&
          submit.mutate(submitting, { onSettled: () => setSubmitting(null) })
        }
      />
    </div>
  );
}
