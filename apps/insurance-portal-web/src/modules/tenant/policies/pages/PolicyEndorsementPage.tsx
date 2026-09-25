import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import {
  useCancellationEligibility,
  useCreateEndorsement,
  useEndorsementContext,
  useEndorsementEligibility,
  useEndorsementReconciliation,
  useEndorsementTypes,
  useIssueEndorsement,
  usePolicyCurrentVersion,
  usePolicyDetail,
  useReconcileEndorsement,
  useRecordEndorsementChange,
} from '../hooks';
import { policiesApi } from '../api';
import type {
  EndorsementPricingSnapshot,
  RecordEndorsementChangePayload,
} from '../types';

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function premiumEffectLabel(effect: string | null | undefined): string {
  switch (effect) {
    case 'DEBIT':
      return 'Type 1 · Increasing Premium Charged';
    case 'CREDIT':
      return 'Type 2 · Decreasing Premium Charged';
    default:
      return 'Type 3 · Cover Details Change';
  }
}

function premiumEffectBadgeVariant(
  effect: string | null | undefined,
): 'warning' | 'success' | 'muted' {
  switch (effect) {
    case 'DEBIT':
      return 'warning';
    case 'CREDIT':
      return 'success';
    default:
      return 'muted';
  }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function FieldEditor({
  label,
  value,
  onSave,
}: {
  label: string;
  value: unknown;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(displayValue(value) === '-' ? '' : String(value));

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <Input value={draft} onChange={(event) => setDraft(event.target.value)} />
      <Button type="button" variant="outline" size="sm" onClick={() => onSave(draft)}>
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Save
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function PolicyEndorsementPage() {
  const { policyId, endorsementId } = useParams<{
    policyId: string;
    endorsementId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [step, setStep] = useState(endorsementId ? 2 : 1);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endorsementTypeCode, setEndorsementTypeCode] = useState('');
  const [reason, setReason] = useState('');

  const { data: policy, isLoading: policyLoading } = usePolicyDetail(policyId);
  const { data: currentVersion } = usePolicyCurrentVersion(policyId);
  const { data: eligibility } = useEndorsementEligibility(
    policyId,
    effectiveDate || undefined,
  );
  const { data: endorsementTypes = [] } = useEndorsementTypes();
  const canCreateCancellation = hasPermission('cancellations:create');
  const { data: cancellationEligibility } = useCancellationEligibility(
    policyId,
    undefined,
    canCreateCancellation,
  );
  const canStartCancellation =
    canCreateCancellation && cancellationEligibility?.eligible;
  const { data: context, refetch: refetchContext } =
    useEndorsementContext(endorsementId);
  const canCompleteEndorsement = hasPermission('endorsements:complete');
  const canSubmitEndorsementApproval = hasPermission(
    'endorsements:submit-approval',
  );
  const canRequestEndorsementPayment = hasPermission(
    'endorsements:request-payment',
  );
  const canSubmitEndorsementToTiramis = hasPermission(
    'endorsements:submit-tiramis',
  );
  const canUseReconciliation = hasPermission('endorsements:reconcile');
  const { data: reconciliation } = useEndorsementReconciliation(
    endorsementId,
    canUseReconciliation,
  );
  const reconcileMutation = useReconcileEndorsement(endorsementId);
  const issueEndorsement = useIssueEndorsement();
  const createMutation = useCreateEndorsement(policyId);
  const changeMutation = useRecordEndorsementChange(endorsementId);

  const sourceSnapshot =
    context?.source_policy_snapshot ?? currentVersion?.policy_snapshot;
  const proposedSnapshot = context?.proposed_policy_snapshot ?? sourceSnapshot;
  const entries = asArray(proposedSnapshot?.entries);
  const policyHolders = asArray(proposedSnapshot?.policyHolders);
  const cover = asObject(proposedSnapshot?.cover);

  const selectedType = useMemo(
    () => endorsementTypes.find((item) => item.code === endorsementTypeCode),
    [endorsementTypeCode, endorsementTypes],
  );

  const activeEndorsementId = endorsementId;
  const pricing =
    (context?.transaction?.pricing_snapshot as
      | EndorsementPricingSnapshot
      | null
      | undefined) ?? null;
  const tx = context?.transaction;
  const currencyCode = pricing?.currencyCode ?? tx?.currency_code ?? 'TZS';
  const formatMoney = (value: string | number | null | undefined) => {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  };
  const canComplete =
    canCompleteEndorsement &&
    tx?.stage === 'DRAFT' &&
    (context?.changes ?? []).length > 0;
  const canSubmitApproval =
    canSubmitEndorsementApproval &&
    tx?.stage === 'COMPLETED' &&
    tx.approval_required &&
    tx.approval_status === 'NOT_EVALUATED';
  const canRequestPayment =
    canRequestEndorsementPayment &&
    tx?.stage === 'COMPLETED' &&
    tx.payment_required &&
    ['NOT_REQUESTED', 'NOT_EVALUATED'].includes(tx.payment_status);
  const paymentInProgress =
    tx?.payment_required &&
    ['REQUESTED', 'PROCESSING', 'PARTIALLY_PAID', 'PARTIAL'].includes(
      tx.payment_status,
    );
  const canIssue =
    canSubmitEndorsementToTiramis &&
    tx?.stage === 'COMPLETED' &&
    ['READY', 'FAILED', 'RETRYABLE'].includes(tx.submission_status);
  const refunds = Array.isArray(reconciliation?.refunds)
    ? (reconciliation.refunds as Array<{
        id: string;
        refund_no: string;
        amount: string;
        currency_code: string;
        status: string;
      }>)
    : [];

  useEffect(() => {
    if (context?.transaction?.stage !== 'APPLIED' || !policyId) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['policies', 'detail', policyId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['policies', 'detail', policyId, 'current-version'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['policies', 'detail', policyId, 'endorsements'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['policies', 'detail', policyId, 'versions'],
      }),
    ]);
  }, [context?.transaction?.stage, policyId, queryClient]);

  const saveChange = (payload: RecordEndorsementChangePayload) => {
    if (!activeEndorsementId) {
      return;
    }
    changeMutation.mutate(payload);
  };

  const createDraft = () => {
    if (!policyId) {
      return;
    }
    createMutation.mutate(
      {
        effective_date: effectiveDate,
        endorsement_type_code: endorsementTypeCode,
        reason,
        idempotency_key:
          globalThis.crypto?.randomUUID?.() ??
          `${policyId}-${Date.now()}-${Math.random()}`,
      },
      {
        onSuccess: (endorsement) => {
          navigate(
            underwritingPaths.policyEndorsementEdit(policyId, endorsement.id),
            { replace: true },
          );
          setStep(2);
        },
      },
    );
  };

  const handleReview = async () => {
    if (!endorsementId) {
      return;
    }

    await policiesApi.recalculateEndorsement(endorsementId);
    await refetchContext();
    setStep(3);
  };

  const completeEndorsement = async () => {
    if (!endorsementId) {
      return;
    }

    await policiesApi.completeEndorsement(endorsementId);
    await refetchContext();
  };

  const submitApproval = async () => {
    if (!endorsementId) {
      return;
    }

    await policiesApi.submitEndorsementApproval(endorsementId);
    await refetchContext();
  };

  const requestPayment = async () => {
    if (!endorsementId) {
      return;
    }

    const invoice = await policiesApi.requestEndorsementPayment(endorsementId);
    await refetchContext();
    navigate(`/finance/invoices/${invoice.id}`);
  };

  if (policyLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!policy) {
    return <p className="py-12 text-center text-sm text-slate-500">Policy not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(underwritingPaths.policyDetail(policy.id))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Policy Endorsement"
          description={`${policy.policy_no} · current policy version ${currentVersion?.version_number ?? '-'}`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {['Endorsement Details', 'Policy Changes', 'Review'].map((label, index) => (
          <Button
            key={label}
            type="button"
            variant={step === index + 1 ? 'default' : 'outline'}
            onClick={() => setStep(index + 1)}
            disabled={index > 0 && !activeEndorsementId}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
            <CardTitle className="text-base">Endorsement Details</CardTitle>
            {canStartCancellation && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-red-600"
                onClick={() =>
                  navigate(underwritingPaths.policyCancellationCreate(policy.id))
                }
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Need to cancel this policy instead? Cancel Policy →
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {eligibility && !eligibility.eligible && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  Endorsement unavailable
                </p>
                {eligibility.blockers.map((blocker) => (
                  <p key={blocker.code} className="mt-1 text-sm text-amber-800">
                    {blocker.message}
                  </p>
                ))}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-slate-500">Effective Date</label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-500">Endorsement Type</label>
                <Select
                  value={endorsementTypeCode}
                  onValueChange={setEndorsementTypeCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {endorsementTypes.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-500">Reason</label>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !effectiveDate ||
                !endorsementTypeCode ||
                !reason.trim() ||
                eligibility?.eligible === false
              }
              onClick={createDraft}
            >
              Create Draft
            </Button>
            {selectedType && (
              <p className="text-sm text-slate-500">
                {selectedType.requires_new_cover_note
                  ? 'This endorsement type requires a replacement cover note.'
                  : 'This endorsement type updates the existing contract record.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cover Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FieldEditor
                label="Start Date"
                value={cover?.startDate}
                onSave={(value) =>
                  saveChange({
                    category: 'COVER_PERIOD',
                    operation: 'MODIFY',
                    field_path: 'cover.startDate',
                    new_value: value,
                  })
                }
              />
              <FieldEditor
                label="End Date"
                value={cover?.endDate}
                onSave={(value) =>
                  saveChange({
                    category: 'COVER_PERIOD',
                    operation: 'MODIFY',
                    field_path: 'cover.endDate',
                    new_value: value,
                  })
                }
              />
            </CardContent>
          </Card>

          {policyHolders.map((holder, holderIndex) => (
            <Card key={String(holder.id ?? holderIndex)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {String(holder.name ?? `Policyholder ${holderIndex + 1}`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['name', 'phone', 'email', 'region', 'district', 'street'] as const).map(
                  (field) => (
                    <FieldEditor
                      key={field}
                      label={field}
                      value={holder[field]}
                      onSave={(value) =>
                        saveChange({
                          category: 'POLICYHOLDER',
                          operation: 'MODIFY',
                          field_path: `policyHolders.${holderIndex}.${field}`,
                          new_value: value,
                        })
                      }
                    />
                  ),
                )}
              </CardContent>
            </Card>
          ))}

          {entries.map((entry, entryIndex) => {
            const motor = asObject(entry.motor);
            const risks = asArray(entry.risks);
            const subjectMatters = asArray(entry.subjectMatters);

            return (
              <Card key={String(entry.entryId ?? entryIndex)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Entry {String(entry.entryNumber ?? entryIndex + 1)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FieldEditor
                    label="Description"
                    value={entry.coverNoteDescription}
                    onSave={(value) =>
                      saveChange({
                        category: 'COVER',
                        operation: 'MODIFY',
                        field_path: `entries.${entryIndex}.coverNoteDescription`,
                        new_value: value,
                      })
                    }
                  />
                  {motor &&
                    ([
                      'registrationNumber',
                      'chassisNumber',
                      'engineNumber',
                      'make',
                      'model',
                      'yearOfManufacture',
                      'ownerName',
                    ] as const).map((field) => (
                      <FieldEditor
                        key={field}
                        label={field}
                        value={motor[field]}
                        onSave={(value) =>
                          saveChange({
                            category: 'ASSET',
                            operation: 'MODIFY',
                            field_path: `entries.${entryIndex}.motor.${field}`,
                            new_value: value,
                          })
                        }
                      />
                    ))}
                  {subjectMatters.map((subject, subjectIndex) =>
                    (['reference', 'description'] as const).map((field) => (
                      <FieldEditor
                        key={`${subjectIndex}-${field}`}
                        label={`Subject ${subjectIndex + 1} ${field}`}
                        value={subject[field]}
                        onSave={(value) =>
                          saveChange({
                            category: 'ASSET',
                            operation: 'MODIFY',
                            field_path: `entries.${entryIndex}.subjectMatters.${subjectIndex}.${field}`,
                            new_value: value,
                          })
                        }
                      />
                    )),
                  )}
                  {risks.map((risk, riskIndex) => (
                    <FieldEditor
                      key={String(risk.quotationRiskId ?? riskIndex)}
                      label={`Risk ${String(risk.riskCode ?? riskIndex + 1)} sum insured`}
                      value={risk.sumInsured}
                      onSave={(value) =>
                        saveChange({
                          category: 'SUM_INSURED',
                          operation: 'MODIFY',
                          field_path: `entries.${entryIndex}.risks.${riskIndex}.sumInsured`,
                          new_value: value,
                        })
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleReview}
              disabled={!activeEndorsementId}
            >
              Review Endorsement
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {tx?.stage === 'APPLIED' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Endorsement Issued</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Endorsement" value={tx.transaction_no} />
                <Row
                  label="Previous Cover Note"
                  value={context?.endorsement?.previous_cover_note_reference}
                />
                <Row
                  label="Replacement Cover Note"
                  value={context?.endorsement?.replacement_cover_note_reference}
                />
                <Row
                  label="Policy Version"
                  value={
                    tx.target_policy_version_id ? 'New version created' : '-'
                  }
                />
                <Button
                  type="button"
                  onClick={() =>
                    policyId && navigate(underwritingPaths.policyDetail(policyId))
                  }
                >
                  View Policy
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Endorsement Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Policy" value={policy.policy_no} />
              <Row
                label="Current Version"
                value={context?.transaction.source_policy_version_no ?? '-'}
              />
              <Row
                label="Endorsement"
                value={context?.endorsement?.endorsement_type_name ?? '-'}
              />
              <Row label="Effective" value={context?.transaction.effective_date ?? '-'} />
            </CardContent>
          </Card>

          {pricing && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Premium Comparison</CardTitle>
                <Badge variant={premiumEffectBadgeVariant(pricing.premiumEffect)}>
                  {premiumEffectLabel(pricing.premiumEffect)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row
                  label="Current Premium"
                  value={formatMoney(pricing.sourcePolicyPremium)}
                />
                <Row
                  label="Revised Premium"
                  value={formatMoney(pricing.revisedFullTermPremium)}
                />
                <Row
                  label="Remaining Old Premium"
                  value={formatMoney(pricing.remainingOldPremium)}
                />
                <Row
                  label="Remaining New Premium"
                  value={formatMoney(pricing.remainingNewPremium)}
                />
                <Row
                  label="Premium Difference"
                  value={formatMoney(pricing.premiumDifference)}
                />
                <Row
                  label="Tax Difference"
                  value={formatMoney(pricing.taxDifference)}
                />
                <Row
                  label="Commission Difference"
                  value={formatMoney(pricing.commissionDifference)}
                />
                <Row
                  label="Customer Payable"
                  value={formatMoney(pricing.customerPayableDifference)}
                />
              </CardContent>
            </Card>
          )}

          {pricing && (
            <Alert>
              <AlertTitle>
                {pricing.premiumEffect === 'DEBIT'
                  ? 'Additional premium required'
                  : pricing.premiumEffect === 'CREDIT'
                    ? 'Return premium due'
                    : 'No premium movement'}
              </AlertTitle>
              <AlertDescription>
                {pricing.premiumEffect === 'DEBIT'
                  ? `${formatMoney(pricing.customerPayableDifference)} must be invoiced before the endorsement can be issued.`
                  : pricing.premiumEffect === 'CREDIT'
                    ? `${formatMoney(tx?.return_premium)} will be tracked as a return premium.`
                    : 'The endorsement can proceed without a payment step once approval requirements are satisfied.'}
              </AlertDescription>
            </Alert>
          )}

          {tx?.premium_effect === 'CREDIT' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Return Premium</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row
                  label="Amount"
                  value={`${tx.currency_code} ${tx.return_premium}`}
                />
                {refunds.map((refund) => (
                  <div key={refund.id} className="rounded-md border p-3">
                    <Row label="Refund Number" value={refund.refund_no} />
                    <Row
                      label="Amount"
                      value={`${refund.currency_code} ${refund.amount}`}
                    />
                    <Row label="Status" value={refund.status} />
                  </div>
                ))}
                {!refunds.length && (
                  <p className="text-sm text-slate-500">
                    No return-premium refund request has been recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {canUseReconciliation &&
            reconciliation &&
            reconciliation.healthy === false && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Issuance Attention Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(reconciliation.issues ?? []).map(
                    (issue: {
                      code: string;
                      message: string;
                      repairable: boolean;
                    }) => (
                      <Alert key={issue.code}>
                        <AlertTitle>{issue.code}</AlertTitle>
                        <AlertDescription>{issue.message}</AlertDescription>
                      </Alert>
                    ),
                  )}
                  {(reconciliation.issues ?? []).some(
                    (issue: { repairable: boolean }) => issue.repairable,
                  ) && (
                    <Button
                      type="button"
                      onClick={() => reconcileMutation.mutate()}
                      disabled={reconcileMutation.isPending}
                    >
                      Reconcile
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

          {(context?.changes ?? []).map((change) => (
            <Card key={change.id}>
              <CardContent className="space-y-3 pt-6">
                <Row label="Field" value={change.field_path} />
                <Row label="Category" value={change.category} />
                <Row label="Old" value={displayValue(change.old_value)} />
                <Row label="New" value={displayValue(change.new_value)} />
              </CardContent>
            </Card>
          ))}
          {(context?.changes ?? []).length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-slate-500">
                No endorsement changes have been recorded.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Next Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Stage" value={tx?.stage ?? '-'} />
              <Row label="Approval" value={tx?.approval_status ?? '-'} />
              <Row label="Payment" value={tx?.payment_status ?? '-'} />
              <Row label="Submission" value={tx?.submission_status ?? '-'} />

              {tx?.submission_status === 'READY' && (
                <Alert>
                  <AlertTitle>Ready to issue</AlertTitle>
                  <AlertDescription>
                    Approval and payment requirements are satisfied.
                  </AlertDescription>
                </Alert>
              )}
              {tx?.approval_status === 'PENDING' && (
                <Alert>
                  <AlertTitle>Awaiting approval</AlertTitle>
                  <AlertDescription>
                    The endorsement is queued for an underwriting approval decision.
                  </AlertDescription>
                </Alert>
              )}
              {paymentInProgress && (
                <Alert>
                  <AlertTitle>Payment required</AlertTitle>
                  <AlertDescription>
                    The endorsement invoice must be paid before issuance.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                {canComplete && (
                  <Button type="button" onClick={completeEndorsement}>
                    Complete Endorsement
                  </Button>
                )}
                {canSubmitApproval && (
                  <Button type="button" onClick={submitApproval}>
                    Submit for Approval
                  </Button>
                )}
                {canRequestPayment && (
                  <Button type="button" onClick={requestPayment}>
                    Request Payment
                  </Button>
                )}
                {canIssue && endorsementId && (
                  <Button
                    type="button"
                    onClick={() => issueEndorsement.mutate(endorsementId)}
                    disabled={
                      issueEndorsement.isPending ||
                      tx?.submission_status !== 'READY'
                    }
                  >
                    {issueEndorsement.isPending
                      ? 'Issuing...'
                      : 'Issue Endorsement'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
