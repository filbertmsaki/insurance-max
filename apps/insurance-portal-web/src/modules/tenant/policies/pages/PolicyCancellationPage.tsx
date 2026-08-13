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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getApiErrorMessage } from '@/lib/api-error';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { policiesApi } from '../api';
import {
  policyKeys,
  useCancellationContext,
  useCompleteCancellation,
  useCreateCancellation,
  useIssueCancellation,
  usePolicyCurrentVersion,
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
  const isNew = !cancellationId || cancellationId === 'new';
  const { data: policy } = usePolicyDetail(policyId);
  const { data: currentVersion } = usePolicyCurrentVersion(policyId);
  const { data: context } = useCancellationContext(
    isNew ? undefined : cancellationId,
  );
  const createCancellation = useCreateCancellation(policyId);
  const completeCancellation = useCompleteCancellation(cancellationId);
  const issueCancellation = useIssueCancellation(policyId);
  const [reasonType, setReasonType] =
    useState<CancellationReasonType>('CUSTOMER_REQUEST');
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState('');

  const submitApproval = useMutation({
    mutationFn: () => policiesApi.submitCancellationApproval(cancellationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: policyKeys.cancellationContext(cancellationId!),
      });
      toast.success('Cancellation submitted for approval');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
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
  const canIssue = tx?.stage === 'COMPLETED' && tx.submission_status === 'READY';
  const canComplete = tx?.stage === 'DRAFT';
  const finalApplied = tx?.stage === 'APPLIED';
  const handleCreate = () => {
    createCancellation.mutate(
      {
        effective_date: effectiveDate,
        reason_type: reasonType,
        reason,
        idempotency_key:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
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
          <h1 className="text-xl font-semibold text-slate-900">
            Policy Cancellation
          </h1>
          <p className="text-sm text-slate-500">{policy?.policy_no}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancellation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Policy Number" value={policy?.policy_no} />
            <Row label="Current Cover Note" value={policy?.cover_note_no} />
            <Row
              label="Customer"
              value={policy?.customer?.company_name ?? policy?.customer_id}
            />
            <Row
              label="Product"
              value={policy?.product?.product_name ?? policy?.product_id}
            />
            <Row
              label="Cover Period"
              value={
                policy ? `${policy.start_date} to ${policy.end_date}` : null
              }
            />
            <Row
              label="Current Premium"
              value={policy ? `${policy.currency} ${policy.total_premium}` : null}
            />
            <Row
              label="Current Policy Version"
              value={
                currentVersion
                  ? `${currentVersion.version_number} - ${currentVersion.version_type}`
                  : null
              }
            />

            {isNew && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Cancellation Reason Type
                </label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={reasonType}
                  onChange={(event) =>
                    setReasonType(event.target.value as CancellationReasonType)
                  }
                >
                  {REASON_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-slate-700">
                  Effective Date
                </label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />

                <label className="block text-sm font-medium text-slate-700">
                  Reason / Explanation
                </label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={5}
                />

                <Button
                  variant="destructive"
                  disabled={createCancellation.isPending || !reason.trim()}
                  onClick={handleCreate}
                >
                  Create Cancellation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {cancellation && tx && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Cancellation Calculation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Row
                  label="Policy Premium"
                  value={`${tx.currency_code} ${cancellation.gross_written_premium}`}
                />
                <Row label="Days on Risk" value={cancellation.days_on_risk} />
                <Row
                  label="Earned Premium"
                  value={`${tx.currency_code} ${cancellation.earned_premium}`}
                />
                <Row
                  label="Unearned Premium"
                  value={`${tx.currency_code} ${cancellation.unearned_premium}`}
                />
                <Row
                  label="Cancellation Charge"
                  value={`${tx.currency_code} ${cancellation.cancellation_charge}`}
                />
                <Row
                  label="Return Premium"
                  value={`${tx.currency_code} ${cancellation.refund_amount}`}
                />
                <Row
                  label="Amount Due"
                  value={`${tx.currency_code} ${cancellation.amount_due}`}
                />
              </CardContent>
            </Card>
          )}

          {cancellation?.claims_review_required && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Claims Review Required</AlertTitle>
              <AlertDescription>
                This policy has an open or unresolved claim. Claims must review
                the cancellation before it can proceed. Status:{' '}
                {cancellation.claims_review_status}
              </AlertDescription>
            </Alert>
          )}

          {tx && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  Confirmation / Issue
                  <StatusBadge status={tx.stage} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label="Approval" value={tx.approval_status} />
                <Row label="Payment" value={tx.payment_status} />
                <Row label="TIRAMIS" value={tx.submission_status} />

                {finalApplied ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Policy Cancelled</AlertTitle>
                    <AlertDescription>
                      {policy?.policy_no} is CANCELLED effective{' '}
                      {tx.effective_date}. Previous cover note:{' '}
                      {cancellation?.previous_cover_note_reference ?? '-'}.
                      Cancellation regulatory reference:{' '}
                      {cancellation?.cancellation_cover_note_reference ?? '-'}.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Confirm Policy Cancellation</AlertTitle>
                    <AlertDescription>
                      After regulatory acceptance, this policy will become
                      CANCELLED effective from the selected date. The original
                      quotation and previous policy versions will remain
                      preserved for audit.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  {canComplete && (
                    <Button
                      variant="destructive"
                      disabled={completeCancellation.isPending}
                      onClick={() => completeCancellation.mutate()}
                    >
                      Complete Cancellation
                    </Button>
                  )}
                  {tx.stage === 'COMPLETED' && tx.approval_required && (
                    <Button
                      variant="outline"
                      disabled={submitApproval.isPending}
                      onClick={() => submitApproval.mutate()}
                    >
                      Submit for Approval
                    </Button>
                  )}
                  {tx.stage === 'COMPLETED' &&
                    tx.approval_status === 'PENDING' && (
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
                    !tx.active_invoice_id && (
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
                      : 'Issue Cancellation'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
