import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyState,
  KeyValueGrid,
  SectionCard,
} from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { cn } from '@/lib/utils';
import { claimsApi } from '../../api';
import { pendingApproval, userName } from '../../claim-records';
import {
  ApprovalDecisionDialog,
  type ApprovalDecision,
} from '../../components/ApprovalDecisionDialog';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import { ClaimField } from '../../components/ClaimField';
import { useClaimAction } from '../../hooks';
import {
  reserveSchema,
  toReservePayload,
  type ReserveFormValues,
} from '../../stage-schemas';
import type { ClaimDetail, ClaimReserve, ReservePayload } from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const STATUS_TONE: Record<string, 'muted' | 'warning' | 'success' | 'danger'> =
  {
    SUBMITTED: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    RELEASED: 'muted',
  };

const LOCKED = new Set(['DRAFT', 'CLOSED', 'CANCELLED']);

function ReserveRequestDialog({
  hasReserve,
  currency,
  pending,
  error,
  onSave,
  onClose,
}: {
  hasReserve: boolean;
  currency?: string | null;
  pending: boolean;
  error: unknown;
  onSave: (payload: ReservePayload) => void;
  onClose: () => void;
}) {
  const form = useForm<ReserveFormValues>({
    resolver: zodResolver(reserveSchema),
    defaultValues: {
      reserve_type: hasReserve ? 'INCREASE' : 'INITIAL',
      amount: '',
      reason: '',
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a reserve change</DialogTitle>
          <DialogDescription>
            The case reserve moves only after the change is approved.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="reserve-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              onSave(toReservePayload(values)),
            )}
          >
            <ClaimField
              form={form}
              name="reserve_type"
              label="Change"
              required
              options={
                hasReserve
                  ? [
                      { value: 'INCREASE', label: 'Increase' },
                      { value: 'DECREASE', label: 'Decrease' },
                    ]
                  : [{ value: 'INITIAL', label: 'Initial reserve' }]
              }
            />
            <ClaimField
              form={form}
              name="amount"
              label={`Amount${currency ? ` (${currency})` : ''}`}
              type="number"
              required
            />
            <ClaimField
              form={form}
              name="reason"
              label="Reason"
              multiline
              rows={3}
              required
              maxLength={2000}
            />
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="reserve-form" disabled={pending}>
            {pending ? 'Submitting...' : 'Submit for approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Decision = {
  reserve: ClaimReserve;
  kind: 'APPROVE' | 'DECLINE' | 'RELEASE';
};

export function ReserveTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRequest = hasPermission(ClaimsPermissions.RESERVE_CREATE);
  const canApprove = hasPermission(ClaimsPermissions.RESERVE_APPROVE);
  const canRelease = hasPermission(ClaimsPermissions.RESERVE_RELEASE);
  const currency = claim.currency_code;
  const reserves = claim.reserves ?? [];
  const hasReserve = reserves.some((reserve) => reserve.status === 'APPROVED');
  const [requesting, setRequesting] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  const request = useClaimAction(
    claim.id,
    (payload: ReservePayload) => claimsApi.createReserve(claim.id, payload),
    'Reserve change submitted for approval',
  );
  const decide = useClaimAction(
    claim.id,
    ({
      reserve,
      kind,
      choice,
      comments,
    }: Decision & {
      choice: ApprovalDecision;
      comments: string;
    }) =>
      kind === 'RELEASE'
        ? claimsApi.releaseReserve(reserve.id, comments)
        : choice === 'APPROVE'
          ? claimsApi.approveReserve(reserve.id, comments || undefined)
          : claimsApi.declineReserve(reserve.id, comments),
    'Reserve updated',
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title="Case reserve"
        description="Derived from approved reserve movements; never edited directly."
        action={
          canRequest && !LOCKED.has(claim.status) ? (
            <Button onClick={() => setRequesting(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Request change
            </Button>
          ) : undefined
        }
      >
        <KeyValueGrid
          items={[
            {
              label: 'Gross case reserve',
              value: formatClaimMoney(claim.gross_case_reserve, currency),
            },
            {
              label: 'Outstanding reserve',
              value: formatClaimMoney(claim.outstanding_reserve, currency),
            },
            {
              label: 'Paid',
              value: formatClaimMoney(claim.paid_amount, currency),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="Reserve ledger">
        {reserves.length === 0 ? (
          <EmptyState text="No reserve has been booked yet. The intimation books the initial reserve." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reserve</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reserves.map((reserve) => {
                const amount = Number(reserve.amount ?? 0);
                const pending = pendingApproval(claim, reserve.id);
                return (
                  <TableRow key={reserve.id}>
                    <TableCell>
                      <div className="font-medium">{reserve.reserve_no}</div>
                      <div className="text-xs text-slate-500">
                        {formatClaimDateTime(reserve.created_at)} ·{' '}
                        {userName(claim, reserve.created_by)}
                      </div>
                    </TableCell>
                    <TableCell>{humanizeCode(reserve.reserve_type)}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        amount < 0 ? 'text-red-600' : 'text-slate-900',
                      )}
                    >
                      {amount > 0 ? '+' : ''}
                      {formatClaimMoney(
                        reserve.amount,
                        reserve.currency ?? currency,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[reserve.status] ?? 'muted'}>
                        {humanizeCode(reserve.status)}
                      </Badge>
                      {pending ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Level {pending.level} of {pending.required_levels}
                        </div>
                      ) : null}
                      {reserve.approved_by ? (
                        <div className="mt-1 text-xs text-slate-500">
                          by {userName(claim, reserve.approved_by)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-72 text-sm text-slate-600">
                      {reserve.reason}
                      {reserve.rejection_reason ? (
                        <div className="text-red-600">
                          Declined: {reserve.rejection_reason}
                        </div>
                      ) : null}
                      {reserve.release_reason ? (
                        <div>Released: {reserve.release_reason}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {reserve.status === 'SUBMITTED' && canApprove ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDecision({ reserve, kind: 'APPROVE' })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDecision({ reserve, kind: 'DECLINE' })
                              }
                            >
                              Decline
                            </Button>
                          </>
                        ) : null}
                        {reserve.status === 'APPROVED' &&
                        amount > 0 &&
                        canRelease ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDecision({ reserve, kind: 'RELEASE' })
                            }
                          >
                            Release
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {requesting ? (
        <ReserveRequestDialog
          hasReserve={hasReserve}
          currency={currency}
          pending={request.isPending}
          error={request.error}
          onClose={() => {
            request.reset();
            setRequesting(false);
          }}
          onSave={(payload) =>
            request.mutate(payload, { onSuccess: () => setRequesting(false) })
          }
        />
      ) : null}

      {decision ? (
        <ApprovalDecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              decide.reset();
              setDecision(null);
            }
          }}
          title={
            decision.kind === 'RELEASE'
              ? `Release reserve ${decision.reserve.reserve_no}`
              : `${decision.kind === 'APPROVE' ? 'Approve' : 'Decline'} reserve ${decision.reserve.reserve_no}`
          }
          summary={`${humanizeCode(decision.reserve.reserve_type)} of ${formatClaimMoney(
            decision.reserve.amount,
            currency,
          )}${decision.kind === 'RELEASE' ? '. Releasing reverses this amount in the ledger.' : ''}`}
          decision={decision.kind === 'APPROVE' ? 'APPROVE' : 'DECLINE'}
          declineLabel={decision.kind === 'RELEASE' ? 'Release' : undefined}
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
