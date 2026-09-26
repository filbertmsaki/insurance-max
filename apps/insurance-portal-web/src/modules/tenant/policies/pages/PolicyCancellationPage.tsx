import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Play } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createBrowserSafeId } from '@/lib/ids';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getApiErrorMessage } from '@/lib/api-error';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { getCustomerFullName } from '@/modules/tenant/customers/types';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { policiesApi } from '../api';
import {
  policyKeys,
  useCancellationContext,
  useCompleteCancellation,
  useCreateCancellation,
  useIssueCancellation,
  usePolicyDetail,
} from '../hooks';
import type { CancellationReasonType } from '../types';

const REASON_TYPES: Array<{ value: CancellationReasonType; label: string }> = [
  { value: 'CUSTOMER_REQUEST', label: 'Customer Request' },
  { value: 'NON_PAYMENT', label: 'Non Payment' },
  { value: 'DUPLICATE_POLICY', label: 'Duplicate Policy' },
  { value: 'RISK_NO_LONGER_EXISTS', label: 'Risk No Longer Exists' },
  { value: 'MATERIAL_MISREPRESENTATION', label: 'Material Misrepresentation' },
  { value: 'FRAUD', label: 'Fraud' },
  { value: 'POLICY_REPLACEMENT', label: 'Policy Replacement' },
  { value: 'OTHER', label: 'Other' },
];

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-slate-900">
        {value ?? ' - '}
      </span>
    </div>
  );
}

export function PolicyCancellationPage() {
  const { policyId, cancellationId } = useParams<{
    policyId: string;
    cancellationId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const isNew = !cancellationId || cancellationId === 'new';
  const {
    data: policy,
    isLoading: policyLoading,
    error: policyError,
  } = usePolicyDetail(policyId);
  const {
    data: context,
    isLoading: contextLoading,
    error: contextError,
  } = useCancellationContext(isNew ? undefined : cancellationId);
  const createCancellation = useCreateCancellation(policyId);
  const completeCancellation = useCompleteCancellation(cancellationId);
  const issueCancellation = useIssueCancellation(policyId);
  const [reasonType, setReasonType] =
    useState<CancellationReasonType>('CUSTOMER_REQUEST');
  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState('');

  const approve = useMutation({
    mutationFn: () => policiesApi.approveCancellation(cancellationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: policyKeys.cancellationContext(cancellationId!),
      });
      toast.success('Cancellation approved');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const requestPayment = useMutation({
    mutationFn: () => policiesApi.requestCancellationPayment(cancellationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: policyKeys.cancellationContext(cancellationId!),
      });
      toast.success('Payment requested');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const tx = context?.transaction;
  const cancellation = context?.cancellation;
  const canCompleteCancellation = hasPermission('cancellations:complete');
  const canApproveCancellation = hasPermission('cancellations:approve');
  const canRequestCancellationPayment = hasPermission(
    'cancellations:request-payment',
  );
  const canSubmitCancellationToTiramis = hasPermission(
    'cancellations:submit-tiramis',
  );
  const canIssue =
    canSubmitCancellationToTiramis &&
    tx?.stage === 'COMPLETED' &&
    ['READY', 'FAILED', 'RETRYABLE'].includes(tx.submission_status);
  const canComplete = canCompleteCancellation && tx?.stage === 'DRAFT';
  const finalApplied = tx?.stage === 'APPLIED';
  const money = (
    value: string | number | null | undefined,
    currency = policy?.currency ?? '',
  ) => (value == null ? '—' : formatMoney(value, currency));
  const handleCreate = () => {
    createCancellation.mutate(
      {
        effective_date: effectiveDate,
        reason_type: reasonType,
        reason,
        idempotency_key: createBrowserSafeId(),
      },
      {
        onSuccess: (created) =>
          navigate(
            underwritingPaths.policyCancellationDetail(policyId!, created.id),
          ),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to policy"
          onClick={() => {
            if (policyId) {
              navigate(underwritingPaths.policyDetail(policyId));
              return;
            }

            navigate(-1);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Policy Cancellation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {policy?.policy_no} ·{' '}
            {isNew
              ? 'Create a cancellation request'
              : 'Review and manage cancellation'}
          </p>
        </div>
        {tx && (
          <div className="ml-auto">
            <StatusBadge status={tx.stage} />
          </div>
        )}
      </div>

      {policyError || contextError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load cancellation</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(policyError || contextError)}
          </AlertDescription>
        </Alert>
      ) : policyLoading || (!isNew && contextLoading) ? (
        <div
          role="status"
          className="rounded-xl border bg-white p-8 text-sm text-slate-500"
        >
          Loading policy details…
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="lg:col-start-2 lg:row-start-1 border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Policy summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Current Cover Note" value={policy?.cover_note_no} />
              <Row
                label="Customer"
                value={getCustomerFullName(policy?.customer) || '—'}
              />
              <Row
                label="Product"
                value={policy?.product?.product_name ?? '—'}
              />
              <Row
                label="Cover Period"
                value={
                  policy ? `${policy.start_date} to ${policy.end_date}` : null
                }
              />
              <Row
                label="Current Premium"
                value={money(policy?.total_premium)}
              />
            </CardContent>
          </Card>

          <div className="space-y-5 lg:col-start-1 lg:row-start-1">
            {isNew && (
              <Card className="border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">
                    Cancellation details
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Choose when the cancellation takes effect and tell us why.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="cancellation-reason-type"
                          className="block text-sm font-medium text-slate-700"
                        >
                          Reason
                        </label>
                        <select
                          id="cancellation-reason-type"
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                          value={reasonType}
                          onChange={(event) =>
                            setReasonType(
                              event.target.value as CancellationReasonType,
                            )
                          }
                        >
                          {REASON_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="cancellation-date"
                          className="block text-sm font-medium text-slate-700"
                        >
                          Effective Date
                        </label>
                        <Input
                          id="cancellation-date"
                          type="date"
                          value={effectiveDate}
                          onChange={(event) =>
                            setEffectiveDate(event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="cancellation-explanation"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Explanation
                      </label>
                      <Textarea
                        id="cancellation-explanation"
                        placeholder="Briefly explain the reason for cancellation…"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex justify-end border-t border-slate-100 pt-5">
                      <Button
                        variant="destructive"
                        disabled={
                          createCancellation.isPending ||
                          !reason.trim() ||
                          !effectiveDate ||
                          !policy
                        }
                        onClick={handleCreate}
                      >
                        {createCancellation.isPending
                          ? 'Creating request…'
                          : 'Create cancellation'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {cancellation && tx && (
              <Card className="border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">
                    Premium adjustment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="mb-4 rounded-xl bg-slate-900 p-5 text-white">
                    <p className="text-sm text-slate-300">Return premium</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {money(cancellation.refund_amount, tx.currency_code)}
                    </p>
                  </div>
                  <Row
                    label="Policy Premium"
                    value={money(
                      cancellation.gross_written_premium,
                      tx.currency_code,
                    )}
                  />
                  <Row label="Days on Risk" value={cancellation.days_on_risk} />
                  <Row
                    label="Earned Premium"
                    value={money(cancellation.earned_premium, tx.currency_code)}
                  />
                  <Row
                    label="Unearned Premium"
                    value={money(
                      cancellation.unearned_premium,
                      tx.currency_code,
                    )}
                  />
                  <Row
                    label="Cancellation Charge"
                    value={money(
                      cancellation.cancellation_charge,
                      tx.currency_code,
                    )}
                  />
                  <Row
                    label="Amount Due"
                    value={money(cancellation.amount_due, tx.currency_code)}
                  />
                </CardContent>
              </Card>
            )}

            {cancellation?.claims_review_required && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Claims Review Required</AlertTitle>
                <AlertDescription>
                  This policy has an open or unresolved claim. Claims must
                  review the cancellation before it can proceed. Status:{' '}
                  {cancellation.claims_review_status}
                </AlertDescription>
              </Alert>
            )}

            {tx && (
              <Card className="border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    Cancellation status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Row label="Approval" value={tx.approval_status} />
                  <Row label="Payment" value={tx.payment_status} />
                  <Row
                    label="Regulatory submission"
                    value={tx.submission_status}
                  />
                  <Row label="Effective date" value={tx.effective_date} />
                  <Row
                    label="Reason"
                    value={
                      REASON_TYPES.find(
                        (item) => item.value === cancellation?.reason_type,
                      )?.label
                    }
                  />
                  {tx.reason && (
                    <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {tx.reason}
                    </p>
                  )}

                  {finalApplied ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Policy Cancelled</AlertTitle>
                      <AlertDescription>
                        Cover ended on {tx.effective_date}.
                        {cancellation?.cancellation_cover_note_reference &&
                          ` Reference: ${cancellation.cancellation_cover_note_reference}.`}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Confirm Policy Cancellation</AlertTitle>
                      <AlertDescription>
                        Cover will end on {tx.effective_date} once the
                        cancellation is accepted.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!finalApplied && (
                    <div className="flex flex-wrap gap-2">
                      {canComplete && (
                        <Button
                          variant="destructive"
                          disabled={completeCancellation.isPending}
                          onClick={() => completeCancellation.mutate()}
                        >
                          Submit Cancellation
                        </Button>
                      )}
                      {tx.stage === 'COMPLETED' &&
                        tx.approval_status === 'PENDING' &&
                        canApproveCancellation && (
                          <Button
                            variant="outline"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate()}
                          >
                            Approve
                          </Button>
                        )}
                      {tx.stage === 'COMPLETED' &&
                        tx.payment_required &&
                        !tx.active_invoice_id &&
                        canRequestCancellationPayment && (
                          <Button
                            variant="outline"
                            disabled={requestPayment.isPending}
                            onClick={() => requestPayment.mutate()}
                          >
                            Request Payment
                          </Button>
                        )}
                      <Button
                        disabled={!canIssue || issueCancellation.isPending}
                        onClick={() =>
                          cancellationId &&
                          issueCancellation.mutate(cancellationId)
                        }
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        {tx.submission_status === 'PROCESSING'
                          ? 'Issuing Cancellation...'
                          : ['FAILED', 'RETRYABLE'].includes(
                                tx.submission_status,
                              )
                            ? 'Retry Submission'
                            : 'Issue Cancellation'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
