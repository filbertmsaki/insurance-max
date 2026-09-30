import { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCcw,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  acceptedVoucher,
  activeClaimants,
  operationFor,
  payableAmount,
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
  ConfirmDisbursementDialog,
  PaymentDialog,
} from '../../components/PaymentDialogs';
import { PAYMENT_MODE_OPTIONS } from '../../constants';
import { ReasonDialog } from '../../components/ReasonDialog';
import { useClaimAction } from '../../hooks';
import { paymentDefaults } from '../../stage-schemas';
import type {
  ClaimDetail,
  ClaimDisbursement,
  ClaimPayment,
  PaymentPayload,
} from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const STATUS_TONE: Record<
  string,
  'muted' | 'warning' | 'info' | 'success' | 'danger'
> = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  APPROVED: 'info',
  PROCESSING: 'info',
  PAID: 'success',
  FAILED: 'danger',
  REVERSED: 'danger',
  CANCELLED: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved for payment',
  PROCESSING: 'Disbursement requested',
};

const TIRA_DONE = new Set(['ACCEPTED', 'QUEUED', 'PROCESSING', 'ACKNOWLEDGED']);

type Action =
  | { kind: 'approve' | 'decline'; payment: ClaimPayment }
  | { kind: 'submit'; payment: ClaimPayment }
  | { kind: 'cancel'; payment: ClaimPayment }
  | { kind: 'request'; payment: ClaimPayment }
  | {
      kind: 'confirm' | 'fail' | 'reverse';
      payment: ClaimPayment;
      disbursement: ClaimDisbursement;
    };

/** Settlement needs full payment and TIRA's acceptance of every payment. */
function SettlementPanel({ claim }: { claim: ClaimDetail }) {
  if (claim.status === 'SETTLED' || claim.status === 'CLOSED') {
    return (
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Claim settled</AlertTitle>
        <AlertDescription>
          The approved amount is fully paid and TIRA accepted every payment.
          {claim.status === 'SETTLED' ? ' The claim can now be closed.' : ''}
        </AlertDescription>
      </Alert>
    );
  }

  if (claim.status === 'PAID') {
    return (
      <Alert variant="info">
        <Clock className="h-4 w-4" />
        <AlertTitle>Fully paid, waiting for TIRA</AlertTitle>
        <AlertDescription>
          The claim settles automatically once TIRA accepts every payment.
          Resubmit any payment TIRA has not accepted.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function PaymentsTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actions = new Set(claim.allowed_actions ?? []);
  const currency = claim.currency_code;
  const payments = claim.payments ?? [];
  const claimants = activeClaimants(claim);
  const voucher = acceptedVoucher(claim);
  const payable = payableAmount(claim);
  const can = {
    create: hasPermission(ClaimsPermissions.PAYMENT_CREATE),
    approve: hasPermission(ClaimsPermissions.PAYMENT_APPROVE),
    request: hasPermission(ClaimsPermissions.PAYMENT_REQUEST_DISBURSEMENT),
    confirm: hasPermission(ClaimsPermissions.PAYMENT_CONFIRM_DISBURSEMENT),
    reverse: hasPermission(ClaimsPermissions.PAYMENT_REVERSE),
    report:
      hasPermission(ClaimsPermissions.PAYMENT_SUBMIT) ||
      hasPermission(ClaimsPermissions.TIRAMIS_RETRY),
  };

  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const done = () => setAction(null);

  const create = useClaimAction(
    claim.id,
    (payload: PaymentPayload) => claimsApi.createPayment(claim.id, payload),
    'Payment saved as draft',
  );
  const run = useClaimAction(
    claim.id,
    async ({ action: current, text }: { action: Action; text?: string }) => {
      switch (current.kind) {
        case 'submit':
          await claimsApi.submitPayment(current.payment.id);
          return 'Payment submitted for approval';
        case 'cancel':
          await claimsApi.cancelPayment(current.payment.id, text ?? '');
          return 'Payment cancelled';
        case 'request': {
          // One key per attempt: a double click reuses it, a retry after a
          // failed disbursement gets a new one.
          const attempts = (claim.disbursements ?? []).filter(
            (item) => item.claim_payment_id === current.payment.id,
          ).length;
          await claimsApi.requestDisbursement(
            current.payment.id,
            `claim-payment:${current.payment.id}:${attempts + 1}`,
          );
          return 'Disbursement requested from finance';
        }
        case 'fail':
          await claimsApi.failDisbursement(current.disbursement.id, text ?? '');
          return 'Disbursement marked as failed';
        case 'reverse':
          await claimsApi.reverseDisbursement(
            current.disbursement.id,
            text ?? '',
          );
          return 'Payment reversed';
        default:
          return '';
      }
    },
    (message) => message,
  );
  const confirm = useClaimAction(
    claim.id,
    ({
      disbursement,
      data,
    }: {
      disbursement: ClaimDisbursement;
      data: { payment_method: string; provider_reference?: string };
    }) => claimsApi.confirmDisbursement(disbursement.id, data),
    'Payment confirmed and reported to TIRAMIS',
  );
  const decide = useClaimAction(
    claim.id,
    async ({
      payment,
      choice,
      comments,
    }: {
      payment: ClaimPayment;
      choice: ApprovalDecision;
      comments: string;
    }) => {
      if (choice === 'APPROVE') {
        const result = await claimsApi.approvePayment(
          payment.id,
          comments || undefined,
        );
        toast.success(
          result.completed
            ? 'Payment approved for disbursement'
            : 'Approval recorded; the next approval level is required',
        );
        return result;
      }
      return claimsApi.declinePayment(payment.id, {
        comments,
        decision: choice === 'RETURN' ? 'RETURN' : 'REJECT',
      });
    },
  );
  const report = useClaimAction(
    claim.id,
    ({ payment, retry }: { payment: ClaimPayment; retry: boolean }) =>
      claimsApi.submitPaymentToTiramis(payment.id, retry),
    'Payment submitted to TIRAMIS',
  );

  const disbursementOf = (payment: ClaimPayment) =>
    (claim.disbursements ?? []).find(
      (item) => item.id === payment.finance_disbursement_id,
    );

  return (
    <div className="space-y-4">
      <SettlementPanel claim={claim} />
      <ClaimErrorAlert error={run.error} title="The payment action failed" />
      <ClaimErrorAlert
        error={report.error}
        title="The payment was not sent to TIRA"
      />

      <SectionCard
        title="Claim payments"
        description="Approved, then disbursed by finance. Only confirmed payments are reported to TIRA (§13)."
        action={
          actions.has('create_payment') && can.create && payable > 0 ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New payment
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
              label: 'Accepted voucher',
              value: voucher
                ? formatClaimMoney(
                    voucher.reconciled_amount ?? voucher.claim_offer_amount,
                    currency,
                  )
                : '-',
              meta: voucher?.discharge_voucher_number ?? undefined,
            },
            {
              label: 'Paid',
              value: formatClaimMoney(claim.paid_amount, currency),
            },
            {
              label: 'Still payable',
              value: formatClaimMoney(payable, currency),
              meta: 'After payments in progress',
            },
          ]}
        />
      </SectionCard>

      {payments.length === 0 ? (
        <EmptyState
          text={
            voucher
              ? 'No payment recorded yet.'
              : 'Payments can be made once the claimant accepts the discharge voucher.'
          }
        />
      ) : null}

      {payments.map((payment) => {
        const operation = operationFor(claim, 'PAYMENT', payment.id);
        const pending = pendingApproval(claim, payment.id);
        const disbursement = disbursementOf(payment);
        const history = (claim.disbursements ?? []).filter(
          (item) => item.claim_payment_id === payment.id,
        );
        const needsReport =
          payment.status === 'PAID' &&
          (!operation || !TIRA_DONE.has(operation.status));
        const bank = payment.payee_bank_details as
          | { bank_name?: string; account_number?: string }
          | null
          | undefined;

        return (
          <SectionCard
            key={payment.id}
            title={`Payment ${payment.claim_payment_number ?? ''}`}
            description={`Prepared ${formatClaimDateTime(payment.created_at)} by ${userName(claim, payment.created_by)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[payment.status] ?? 'muted'}>
                  {STATUS_LABEL[payment.status] ?? humanizeCode(payment.status)}
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
                    label: 'Amount',
                    value: formatClaimMoney(payment.paid_amount, currency),
                  },
                  {
                    label: 'Mode',
                    value:
                      PAYMENT_MODE_OPTIONS.find(
                        (option) =>
                          option.value === String(payment.payment_mode),
                      )?.label ?? '-',
                    meta: payment.payment_method ?? undefined,
                  },
                  {
                    label: 'Payee',
                    value: payment.payee_snapshot?.name ?? '-',
                    meta: payment.payee_type
                      ? humanizeCode(payment.payee_type)
                      : undefined,
                  },
                  ...(bank?.account_number
                    ? [
                        {
                          label: 'Bank account',
                          value: bank.account_number,
                          meta: bank.bank_name,
                        },
                      ]
                    : []),
                  {
                    label: 'Litigation',
                    value:
                      payment.claim_resulted_litigation === 'Y' ? 'Yes' : 'No',
                    meta: payment.litigation_reason ?? undefined,
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
                  ...(payment.paid_at
                    ? [
                        {
                          label: 'Paid',
                          value: formatClaimDateTime(payment.paid_at),
                          meta: payment.payment_reference ?? undefined,
                        },
                      ]
                    : []),
                ]}
              />
              {payment.rejection_reason ? (
                <p className="text-sm text-red-600">
                  {payment.rejection_reason}
                </p>
              ) : null}
              {operation?.final_response_message &&
              operation.status !== 'ACCEPTED' ? (
                <p className="text-sm text-red-600">
                  TIRA: {operation.final_response_code}{' '}
                  {operation.final_response_message}
                </p>
              ) : null}
              {history.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-600">
                  {history.map((item) => (
                    <li key={item.id}>
                      Disbursement {item.disbursement_no}:{' '}
                      {humanizeCode(item.status)}
                      {item.requested_at
                        ? ` · requested ${formatClaimDateTime(item.requested_at)} by ${userName(claim, item.requested_by)}`
                        : ''}
                      {item.confirmed_at
                        ? ` · confirmed ${formatClaimDateTime(item.confirmed_at)}`
                        : ''}
                      {item.failure_message ? ` · ${item.failure_message}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {payment.status === 'DRAFT' && can.create ? (
                  <>
                    <Button
                      onClick={() => setAction({ kind: 'submit', payment })}
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      Submit for approval
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAction({ kind: 'cancel', payment })}
                    >
                      Cancel payment
                    </Button>
                  </>
                ) : null}
                {payment.status === 'SUBMITTED' && can.approve ? (
                  <>
                    <Button
                      onClick={() => setAction({ kind: 'approve', payment })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAction({ kind: 'decline', payment })}
                    >
                      Decline or return
                    </Button>
                  </>
                ) : null}
                {payment.status === 'APPROVED' && can.request ? (
                  <Button
                    disabled={run.isPending}
                    onClick={() => setAction({ kind: 'request', payment })}
                  >
                    <Banknote className="mr-1.5 h-4 w-4" />
                    Request disbursement
                  </Button>
                ) : null}
                {payment.status === 'PROCESSING' &&
                disbursement?.status === 'REQUESTED' &&
                can.confirm ? (
                  <>
                    <Button
                      onClick={() =>
                        setAction({ kind: 'confirm', payment, disbursement })
                      }
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Confirm paid
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setAction({ kind: 'fail', payment, disbursement })
                      }
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Mark failed
                    </Button>
                  </>
                ) : null}
                {payment.status === 'PAID' &&
                disbursement?.status === 'PAID' &&
                can.reverse ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setAction({ kind: 'reverse', payment, disbursement })
                    }
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Reverse
                  </Button>
                ) : null}
                {needsReport && can.report ? (
                  <Button
                    variant="outline"
                    disabled={report.isPending}
                    onClick={() =>
                      report.mutate({ payment, retry: !!operation })
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

      {creating ? (
        <PaymentDialog
          initial={paymentDefaults(
            payable,
            voucher?.claimant_id ??
              claimants.find((claimant) => claimant.is_primary)?.id,
          )}
          payable={payable}
          claimants={claimants}
          currency={currency}
          pending={create.isPending}
          error={create.error}
          onClose={() => {
            create.reset();
            setCreating(false);
          }}
          onSave={(payload) =>
            create.mutate(payload, { onSuccess: () => setCreating(false) })
          }
        />
      ) : null}

      {action?.kind === 'approve' || action?.kind === 'decline' ? (
        <ApprovalDecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              decide.reset();
              done();
            }
          }}
          title={`${action.kind === 'approve' ? 'Approve' : 'Decline'} payment ${action.payment.claim_payment_number ?? ''}`}
          summary={`${formatClaimMoney(action.payment.paid_amount, currency)} to ${action.payment.payee_snapshot?.name ?? 'the payee'}.`}
          decision={action.kind === 'approve' ? 'APPROVE' : 'DECLINE'}
          allowReturn
          pending={decide.isPending}
          error={decide.error}
          onConfirm={(choice, comments) =>
            decide.mutate(
              { payment: action.payment, choice, comments },
              { onSuccess: done },
            )
          }
        />
      ) : null}

      {action?.kind === 'submit' || action?.kind === 'request' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && done()}
          title={
            action.kind === 'submit'
              ? 'Submit payment for approval'
              : 'Request disbursement'
          }
          description={
            action.kind === 'submit'
              ? `Payment ${action.payment.claim_payment_number ?? ''} of ${formatClaimMoney(action.payment.paid_amount, currency)} goes to the approvers.`
              : `Finance is asked to pay ${formatClaimMoney(action.payment.paid_amount, currency)} to ${action.payment.payee_snapshot?.name ?? 'the payee'}.`
          }
          confirmLabel={action.kind === 'submit' ? 'Submit' : 'Request'}
          variant="default"
          loading={run.isPending}
          onConfirm={() => run.mutate({ action }, { onSettled: done })}
        />
      ) : null}

      {action?.kind === 'cancel' ||
      action?.kind === 'fail' ||
      action?.kind === 'reverse' ? (
        <ReasonDialog
          title={
            action.kind === 'cancel'
              ? `Cancel payment ${action.payment.claim_payment_number ?? ''}`
              : action.kind === 'fail'
                ? 'Mark the disbursement as failed'
                : `Reverse payment ${action.payment.claim_payment_number ?? ''}`
          }
          description={
            action.kind === 'cancel'
              ? 'The draft is cancelled and its amount becomes payable again.'
              : action.kind === 'fail'
                ? 'The payment returns to approved so a new disbursement can be requested.'
                : 'Posts a reversing journal and adds the amount back to the claim. Report the correction to TIRA separately if required.'
          }
          confirmLabel={
            action.kind === 'cancel'
              ? 'Cancel payment'
              : action.kind === 'fail'
                ? 'Mark failed'
                : 'Reverse payment'
          }
          destructive
          pending={run.isPending}
          error={run.error}
          onClose={() => {
            run.reset();
            done();
          }}
          onConfirm={(text) =>
            run.mutate({ action, text }, { onSuccess: done })
          }
        />
      ) : null}

      {action?.kind === 'confirm' ? (
        <ConfirmDisbursementDialog
          title={`Confirm disbursement ${action.disbursement.disbursement_no}`}
          defaultMethod={
            PAYMENT_MODE_OPTIONS.find(
              (option) => option.value === String(action.payment.payment_mode),
            )?.label ?? 'EFT'
          }
          pending={confirm.isPending}
          error={confirm.error}
          onClose={() => {
            confirm.reset();
            done();
          }}
          onConfirm={(data) =>
            confirm.mutate(
              { disbursement: action.disbursement, data },
              { onSuccess: done },
            )
          }
        />
      ) : null}
    </div>
  );
}
