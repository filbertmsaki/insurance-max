import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  FilePlus2,
  Pencil,
  Printer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import {
  AddonPreview,
  FleetHeaderPreview,
  FleetVehicleList,
  MotorDetailsPreview,
  PaymentPreview,
  PolicyholderPreview,
  QuotationHistoryPreview,
  QuotationOverviewPreview,
  RiskPreview,
  SubjectMatterPreview,
  TiramisSubmissionPreview,
} from '../components/QuotationPreviewSections';
import {
  useApproveQuotationPremiumOverride,
  useDeleteQuotation,
  useRejectQuotationPremiumOverride,
  useQuotationPreview,
  useRequestQuotationPremiumOverride,
  useSubmitQuotation,
  useTransitionQuotationStatus,
} from '../hooks';
import type {
  QuotationPreviewPremiumOverride,
  QuotationPreviewRisk,
  QuotationStatusTransitionAction,
} from '../types';

const TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'EXPIRED',
  'COMPLETED',
  'REJECTED',
]);
const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'FAILED',
  'REJECTED',
]);
const DIRECT_PAYMENT_MODE = 1;

type StatusActionDialogState = {
  action: QuotationStatusTransitionAction;
  open: boolean;
};

type PremiumOverrideRequestDialogState = {
  risk: QuotationPreviewRisk;
  open: boolean;
};

type PremiumOverrideDecisionDialogState = {
  risk: QuotationPreviewRisk;
  override: QuotationPreviewPremiumOverride;
  action: 'approve' | 'reject';
  open: boolean;
};

function actionLabel(action: QuotationStatusTransitionAction) {
  switch (action) {
    case 'EVALUATE_REQUIREMENTS':
      return 'Re-evaluate Requirements';
    case 'SUBMIT_FOR_APPROVAL':
      return 'Submit for Approval';
    case 'APPROVE':
      return 'Approve';
    case 'REQUEST_CHANGES':
      return 'Request Changes';
    case 'REJECT_APPROVAL':
      return 'Reject Approval';
    case 'CANCEL':
      return 'Cancel';
    default:
      return action;
  }
}

function requiresReason(
  action: QuotationStatusTransitionAction,
  quotationStatus: string | null,
) {
  if (
    action === 'REQUEST_CHANGES' ||
    action === 'REJECT_APPROVAL' ||
    action === 'CANCEL'
  ) {
    return true;
  }

  return false;
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { data: preview, isLoading } = useQuotationPreview(id);
  const deleteMutation = useDeleteQuotation();
  const submitMutation = useSubmitQuotation(id);
  const transitionStatusMutation = useTransitionQuotationStatus(id);
  const requestPremiumOverrideMutation = useRequestQuotationPremiumOverride(id);
  const approvePremiumOverrideMutation = useApproveQuotationPremiumOverride(id);
  const rejectPremiumOverrideMutation = useRejectQuotationPremiumOverride(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusActionDialog, setStatusActionDialog] =
    useState<StatusActionDialogState | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [premiumOverrideRequestDialog, setPremiumOverrideRequestDialog] =
    useState<PremiumOverrideRequestDialogState | null>(null);
  const [premiumOverrideDecisionDialog, setPremiumOverrideDecisionDialog] =
    useState<PremiumOverrideDecisionDialogState | null>(null);
  const [overrideProposedPremium, setOverrideProposedPremium] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideDecisionReason, setOverrideDecisionReason] = useState('');

  const quotationStatus = preview?.overview.quotation_status ?? null;
  const approvalStatus = preview?.overview.approval_status ?? null;
  const paymentStatus = preview?.overview.payment_status ?? null;
  const tiraStatus = preview?.overview.tira_status ?? null;
  const displayStatus = preview?.overview.display_status ?? null;
  const paymentMode = preview?.cover_note.payment_mode ?? null;
  const pricingIntegration = preview?.pricing_integration ?? null;
  const hasStalePricing = pricingIntegration?.is_stale ?? false;
  const requiresApproval = preview?.overview.requires_approval ?? false;
  const requiresPayment = preview?.overview.requires_payment ?? false;
  const submittedAt = preview?.overview.submitted_at ?? null;
  const allPreviewRisks = [
    ...(preview?.risks ?? []),
    ...(
      preview?.fleet?.vehicles.flatMap((vehicle) => vehicle.risks) ?? []
    ),
  ];
  const hasPremiumOverrideHistory = allPreviewRisks.some(
    (risk) => risk.premium_overrides.length > 0,
  );
  const canEdit = quotationStatus
    ? EDITABLE_STATUSES.has(quotationStatus) && !hasPremiumOverrideHistory
    : false;
  const canEndorse = quotationStatus === 'COMPLETED';
  const canSubmit = quotationStatus === 'READY_FOR_SUBMISSION';
  const isDirectPay = paymentMode === DIRECT_PAYMENT_MODE;
  const canEvaluateRequirements = quotationStatus === 'DRAFT';
  const canSubmitForApproval =
    requiresApproval &&
    (approvalStatus === 'NOT_SUBMITTED' || approvalStatus === 'CHANGES_REQUESTED');
  const canApprove = approvalStatus === 'PENDING';
  const canRequestChanges = approvalStatus === 'PENDING';
  const canReject = approvalStatus === 'PENDING';
  const canCancel =
    !!quotationStatus &&
    !TERMINAL_STATUSES.has(quotationStatus) &&
    tiraStatus === 'NOT_SUBMITTED';
  const canManagePremiumOverrides =
    !submittedAt &&
    !!quotationStatus &&
    !TERMINAL_STATUSES.has(quotationStatus) &&
    tiraStatus === 'NOT_SUBMITTED';
  const canRequestPremiumOverride = hasPermission('pricing.request_override');
  const canApprovePremiumOverride = hasPermission('pricing.approve_override');
  const canRejectPremiumOverride = hasPermission('pricing.approve_override');
  const showFleetTabs = preview?.overview.quotation_flow === 'MOTOR_FLEET';
  const showMotorTab = preview?.overview.quotation_flow === 'MOTOR_SINGLE';
  const tabs = ['overview', 'policyholders'];
  if (showFleetTabs) {
    tabs.push('fleet');
  } else {
    tabs.push('risks', 'subject-matters', 'addons');
    if (showMotorTab) {
      tabs.push('motor');
    }
  }
  tabs.push('payment', 'tiramis', 'history');

  const handleDownload = () => {
    if (!preview) {
      return;
    }

    const blob = new Blob([JSON.stringify(preview, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quotation-preview-${preview.overview.quotation_no}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openStatusActionDialog = (action: QuotationStatusTransitionAction) => {
    setTransitionReason('');
    setStatusActionDialog({
      action,
      open: true,
    });
  };

  const closeStatusActionDialog = () => {
    if (transitionStatusMutation.isPending) {
      return;
    }

    setStatusActionDialog(null);
    setTransitionReason('');
  };

  const openPremiumOverrideRequestDialog = (risk: QuotationPreviewRisk) => {
    setOverrideProposedPremium('');
    setOverrideReason('');
    setOverrideNotes('');
    setPremiumOverrideRequestDialog({
      risk,
      open: true,
    });
  };

  const closePremiumOverrideRequestDialog = () => {
    if (requestPremiumOverrideMutation.isPending) {
      return;
    }

    setPremiumOverrideRequestDialog(null);
    setOverrideProposedPremium('');
    setOverrideReason('');
    setOverrideNotes('');
  };

  const openPremiumOverrideDecisionDialog = (
    risk: QuotationPreviewRisk,
    override: QuotationPreviewPremiumOverride,
    action: 'approve' | 'reject',
  ) => {
    setOverrideDecisionReason('');
    setPremiumOverrideDecisionDialog({
      risk,
      override,
      action,
      open: true,
    });
  };

  const closePremiumOverrideDecisionDialog = () => {
    if (
      approvePremiumOverrideMutation.isPending ||
      rejectPremiumOverrideMutation.isPending
    ) {
      return;
    }

    setPremiumOverrideDecisionDialog(null);
    setOverrideDecisionReason('');
  };

  const handleStatusAction = () => {
    if (!statusActionDialog) {
      return;
    }

    const reasonRequired = requiresReason(
      statusActionDialog.action,
      quotationStatus,
    );
    const reason = transitionReason.trim();

    if (reasonRequired && !reason) {
      return;
    }

    transitionStatusMutation.mutate(
      {
        action: statusActionDialog.action,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          closeStatusActionDialog();
        },
      },
    );
  };

  const handlePremiumOverrideRequest = () => {
    if (!premiumOverrideRequestDialog) {
      return;
    }

    const proposedPremium = Number(overrideProposedPremium);
    if (!Number.isFinite(proposedPremium) || proposedPremium < 0) {
      return;
    }

    const trimmedReason = overrideReason.trim();
    if (!trimmedReason) {
      return;
    }

    requestPremiumOverrideMutation.mutate(
      {
        riskId: premiumOverrideRequestDialog.risk.risk_id,
        payload: {
          proposed_premium: proposedPremium,
          override_reason: trimmedReason,
          supporting_notes: overrideNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => closePremiumOverrideRequestDialog(),
      },
    );
  };

  const handlePremiumOverrideDecision = () => {
    if (!premiumOverrideDecisionDialog) {
      return;
    }

    if (premiumOverrideDecisionDialog.action === 'approve') {
      approvePremiumOverrideMutation.mutate(
        {
          riskId: premiumOverrideDecisionDialog.risk.risk_id,
          overrideId: premiumOverrideDecisionDialog.override.id,
        },
        {
          onSuccess: () => closePremiumOverrideDecisionDialog(),
        },
      );
      return;
    }

    const rejectionReason = overrideDecisionReason.trim();
    if (!rejectionReason) {
      return;
    }

    rejectPremiumOverrideMutation.mutate(
      {
        riskId: premiumOverrideDecisionDialog.risk.risk_id,
        overrideId: premiumOverrideDecisionDialog.override.id,
        payload: {
          rejection_reason: rejectionReason,
        },
      },
      {
        onSuccess: () => closePremiumOverrideDecisionDialog(),
      },
    );
  };

  const renderRiskActions = (risk: QuotationPreviewRisk) => {
    if (!canManagePremiumOverrides) {
      return null;
    }

    const pendingOverride =
      risk.premium_overrides.find((override) => override.approval_status === 'PENDING') ??
      null;
    const canApprovePendingOverride =
      !!pendingOverride &&
      canApprovePremiumOverride &&
      pendingOverride.requested_by.id !== currentUserId;
    const canRejectPendingOverride =
      !!pendingOverride && canRejectPremiumOverride;

    return (
      <>
        {canRequestPremiumOverride && !pendingOverride ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPremiumOverrideRequestDialog(risk)}
          >
            Request Override
          </Button>
        ) : null}
        {canApprovePendingOverride && pendingOverride ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              openPremiumOverrideDecisionDialog(risk, pendingOverride, 'approve')
            }
          >
            Approve Override
          </Button>
        ) : null}
        {canRejectPendingOverride && pendingOverride ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              openPremiumOverrideDecisionDialog(risk, pendingOverride, 'reject')
            }
          >
            Reject Override
          </Button>
        ) : null}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="py-24 text-center text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button variant="link" onClick={() => navigate(underwritingPaths.quotations)}>
          Back to Quotations
        </Button>
      </div>
    );
  }

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate(underwritingPaths.quotations)}>
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to List
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={hasStalePricing}
        onClick={() => navigate(underwritingPaths.quotationPayment(preview.overview.quotation_id))}
      >
        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
        Payment
      </Button>
      {canEdit ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(underwritingPaths.quotationWizardEdit(preview.overview.quotation_id))}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      ) : null}
      {canEndorse ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigate(underwritingPaths.quotationEndorsement(preview.overview.quotation_id))
          }
        >
          <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
          Add Endorsement
        </Button>
      ) : null}
      {canEvaluateRequirements ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('EVALUATE_REQUIREMENTS')}
        >
          Re-evaluate Requirements
        </Button>
      ) : null}
      {canSubmitForApproval ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending || hasStalePricing}
          onClick={() => openStatusActionDialog('SUBMIT_FOR_APPROVAL')}
        >
          Submit for Approval
        </Button>
      ) : null}
      {canApprove ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending || hasStalePricing}
          onClick={() => openStatusActionDialog('APPROVE')}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          Approve
        </Button>
      ) : null}
      {canRequestChanges ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('REQUEST_CHANGES')}
        >
          Request Changes
        </Button>
      ) : null}
      {canReject ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('REJECT_APPROVAL')}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Reject Approval
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('CANCEL')}
        >
          Cancel Quotation
        </Button>
      ) : null}
      {canSubmit ? (
        <Button
          variant="outline"
          size="sm"
          disabled={submitMutation.isPending || hasStalePricing}
          onClick={() =>
            submitMutation.mutate(undefined, {
              onSuccess: () => {
                navigate(underwritingPaths.quotationDetail(preview.overview.quotation_id));
              },
            })
          }
        >
          Submit to TIRAMIS
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-1.5 h-3.5 w-3.5" />
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Download
      </Button>
      {canEdit ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(underwritingPaths.quotations)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {preview.overview.quotation_no}
              </h1>
              <QuotationStatusBadge status={displayStatus} />
              <PaymentStatusBadge status={paymentStatus} />
            </div>
            <p className="text-sm text-slate-500">
              {preview.cover_note.cover_note_number ?? 'Preview'}
            </p>
          </div>
        </div>
        {actionButtons}
      </div>

      {pricingIntegration ? (
        <Alert variant={pricingIntegration.is_stale ? 'destructive' : 'success'}>
          <AlertTitle>
            Pricing {pricingIntegration.pricing_status.toLowerCase()}
          </AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Base premium {pricingIntegration.base_premium.toFixed(2)}. Discounts{' '}
              {pricingIntegration.total_discounts.toFixed(2)}. Taxes{' '}
              {pricingIntegration.total_taxes.toFixed(2)}. Payable premium{' '}
              {pricingIntegration.final_payable_premium.toFixed(2)}.
            </p>
            {pricingIntegration.current_pricing_quote_id ? (
              <p>
                Pricing quote {pricingIntegration.current_pricing_quote_id}
                {pricingIntegration.rate_book_version
                  ? ` / Rate book ${pricingIntegration.rate_book_version}`
                  : ''}
                {pricingIntegration.pricing_expires_at
                  ? ` / Expires ${new Date(pricingIntegration.pricing_expires_at).toLocaleString()}`
                  : ''}
              </p>
            ) : null}
            {pricingIntegration.stale_reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={tabs[0]} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policyholders">Policyholders</TabsTrigger>
          {!showFleetTabs ? <TabsTrigger value="risks">Risks & Premium</TabsTrigger> : null}
          {!showFleetTabs ? <TabsTrigger value="subject-matters">Subject Matters</TabsTrigger> : null}
          {!showFleetTabs ? <TabsTrigger value="addons">Add-ons</TabsTrigger> : null}
          {showMotorTab ? <TabsTrigger value="motor">Motor Details</TabsTrigger> : null}
          {showFleetTabs ? <TabsTrigger value="fleet">Fleet Vehicles</TabsTrigger> : null}
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="tiramis">TIRAMIS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <QuotationOverviewPreview preview={preview} />
        </TabsContent>

        <TabsContent value="policyholders" className="space-y-4">
          <PolicyholderPreview policyholders={preview.policyholders} />
        </TabsContent>

        {!showFleetTabs ? (
          <TabsContent value="risks" className="space-y-4">
            <RiskPreview
              risks={preview.risks}
              renderRiskActions={renderRiskActions}
            />
          </TabsContent>
        ) : null}

        {!showFleetTabs ? (
          <TabsContent value="subject-matters" className="space-y-4">
            <SubjectMatterPreview subjectMatters={preview.subject_matters} />
          </TabsContent>
        ) : null}

        {!showFleetTabs ? (
          <TabsContent value="addons" className="space-y-4">
            <AddonPreview addons={preview.addons} />
          </TabsContent>
        ) : null}

        {showMotorTab ? (
          <TabsContent value="motor" className="space-y-4">
            <MotorDetailsPreview motor={preview.motor_details} />
          </TabsContent>
        ) : null}

        {showFleetTabs ? (
          <TabsContent value="fleet" className="space-y-4">
            {preview.fleet ? (
              <>
                <FleetHeaderPreview
                  header={preview.fleet.header}
                  summary={preview.fleet.summary}
                />
                <FleetVehicleList
                  vehicles={preview.fleet.vehicles}
                  renderRiskActions={renderRiskActions}
                />
              </>
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="payment" className="space-y-4">
          <PaymentPreview payment={preview.payment} />
        </TabsContent>

        <TabsContent value="tiramis" className="space-y-4">
          <TiramisSubmissionPreview tiramis={preview.tiramis} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <QuotationHistoryPreview history={preview.history} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Quotation"
        description="This deletes the quotation draft from the current company workspace."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(preview.overview.quotation_id, {
            onSuccess: () => navigate(underwritingPaths.quotations),
          })
        }
      />

      <Dialog
        open={statusActionDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) {
            closeStatusActionDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionLabel(statusActionDialog?.action ?? 'APPROVE')} Quotation
            </DialogTitle>
            <DialogDescription>
              {statusActionDialog?.action === 'EVALUATE_REQUIREMENTS'
                ? 'Recalculate whether this quotation is ready for approval, payment, or TIRAMIS submission.'
                : statusActionDialog?.action === 'SUBMIT_FOR_APPROVAL'
                  ? 'Send this quotation into the approval workflow.'
                : statusActionDialog?.action === 'APPROVE'
                ? 'Approve this quotation and keep a short note when needed.'
                : statusActionDialog?.action === 'REQUEST_CHANGES'
                  ? 'Provide change instructions so the quotation can be updated and resubmitted.'
                : statusActionDialog?.action === 'REJECT_APPROVAL'
                  ? 'Provide a rejection reason so the audit trail stays complete.'
                  : 'Provide a cancellation reason before closing this quotation.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="quotation-status-reason"
              className="text-sm font-medium text-slate-700"
            >
              Reason
              {requiresReason(
                statusActionDialog?.action ?? 'APPROVE',
                quotationStatus,
              )
                ? ' *'
                : ' (Optional)'}
            </label>
            <Textarea
              id="quotation-status-reason"
              rows={4}
              value={transitionReason}
              onChange={(event) => setTransitionReason(event.target.value)}
              placeholder={
                statusActionDialog?.action === 'EVALUATE_REQUIREMENTS'
                  ? 'Optional note about this requirement evaluation'
                  : statusActionDialog?.action === 'SUBMIT_FOR_APPROVAL'
                    ? 'Optional note for approvers'
                  : statusActionDialog?.action === 'APPROVE'
                  ? 'Approval note or referral resolution comment'
                  : statusActionDialog?.action === 'REQUEST_CHANGES'
                    ? 'What needs to change before this can be approved'
                  : statusActionDialog?.action === 'REJECT_APPROVAL'
                    ? 'Why this quotation is being rejected'
                    : 'Why this quotation is being cancelled'
              }
            />
            {requiresReason(
              statusActionDialog?.action ?? 'APPROVE',
              quotationStatus,
            ) && !transitionReason.trim() ? (
              <p className="text-xs text-slate-500">
                A reason is required for this action.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeStatusActionDialog}
              disabled={transitionStatusMutation.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              variant={
                statusActionDialog?.action === 'REQUEST_CHANGES' ||
                statusActionDialog?.action === 'REJECT_APPROVAL' ||
                statusActionDialog?.action === 'CANCEL'
                  ? 'destructive'
                  : 'default'
              }
              onClick={handleStatusAction}
              disabled={
                transitionStatusMutation.isPending ||
                (requiresReason(
                  statusActionDialog?.action ?? 'APPROVE',
                  quotationStatus,
                ) &&
                  !transitionReason.trim())
              }
            >
              {transitionStatusMutation.isPending
                ? 'Processing...'
                : actionLabel(statusActionDialog?.action ?? 'APPROVE')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={premiumOverrideRequestDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) {
            closePremiumOverrideRequestDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Premium Override</DialogTitle>
            <DialogDescription>
              Submit a controlled premium override request for{' '}
              {premiumOverrideRequestDialog?.risk.risk_name ??
                premiumOverrideRequestDialog?.risk.risk_code ??
                'this risk'}
              . The calculated premium remains protected until an approver
              decides the request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Current calculated premium:{' '}
              {premiumOverrideRequestDialog?.risk.premium_before_discount?.toLocaleString(
                'en-US',
                {
                  style: 'currency',
                  currency: preview?.cover_note.currency ?? 'TZS',
                },
              ) ?? 'N/A'}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="override-proposed-premium"
                className="text-sm font-medium text-slate-700"
              >
                Proposed Premium *
              </label>
              <Input
                id="override-proposed-premium"
                type="number"
                min="0"
                step="0.01"
                value={overrideProposedPremium}
                onChange={(event) => setOverrideProposedPremium(event.target.value)}
                placeholder="Enter the requested premium amount"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="override-reason"
                className="text-sm font-medium text-slate-700"
              >
                Override Reason *
              </label>
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Why should this premium be overridden?"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="override-notes"
                className="text-sm font-medium text-slate-700"
              >
                Supporting Notes
              </label>
              <Textarea
                id="override-notes"
                rows={4}
                value={overrideNotes}
                onChange={(event) => setOverrideNotes(event.target.value)}
                placeholder="Competitive context, referral notes, or supporting justification"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closePremiumOverrideRequestDialog}
              disabled={requestPremiumOverrideMutation.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handlePremiumOverrideRequest}
              disabled={
                requestPremiumOverrideMutation.isPending ||
                !overrideReason.trim() ||
                !overrideProposedPremium.trim() ||
                Number(overrideProposedPremium) < 0
              }
            >
              {requestPremiumOverrideMutation.isPending
                ? 'Submitting...'
                : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={premiumOverrideDecisionDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) {
            closePremiumOverrideDecisionDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {premiumOverrideDecisionDialog?.action === 'approve'
                ? 'Approve Premium Override'
                : 'Reject Premium Override'}
            </DialogTitle>
            <DialogDescription>
              Review the requested premium change before deciding this override.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div>
                Risk:{' '}
                {premiumOverrideDecisionDialog?.risk.risk_name ??
                  premiumOverrideDecisionDialog?.risk.risk_code ??
                  'N/A'}
              </div>
              <div>
                Original calculated premium:{' '}
                {premiumOverrideDecisionDialog?.override.original_calculated_premium?.toLocaleString(
                  'en-US',
                  {
                    style: 'currency',
                    currency: preview?.cover_note.currency ?? 'TZS',
                  },
                ) ?? 'N/A'}
              </div>
              <div>
                Proposed premium:{' '}
                {premiumOverrideDecisionDialog?.override.proposed_premium?.toLocaleString(
                  'en-US',
                  {
                    style: 'currency',
                    currency: preview?.cover_note.currency ?? 'TZS',
                  },
                ) ?? 'N/A'}
              </div>
              <div>
                Requested by:{' '}
                {premiumOverrideDecisionDialog?.override.requested_by.name ??
                  premiumOverrideDecisionDialog?.override.requested_by.code ??
                  'N/A'}
              </div>
            </div>
            {premiumOverrideDecisionDialog?.action === 'reject' ? (
              <div className="space-y-2">
                <label
                  htmlFor="override-decision-reason"
                  className="text-sm font-medium text-slate-700"
                >
                  Rejection Reason *
                </label>
                <Textarea
                  id="override-decision-reason"
                  rows={4}
                  value={overrideDecisionReason}
                  onChange={(event) =>
                    setOverrideDecisionReason(event.target.value)
                  }
                  placeholder="Why is this premium override being rejected?"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closePremiumOverrideDecisionDialog}
              disabled={
                approvePremiumOverrideMutation.isPending ||
                rejectPremiumOverrideMutation.isPending
              }
            >
              Close
            </Button>
            <Button
              type="button"
              variant={
                premiumOverrideDecisionDialog?.action === 'reject'
                  ? 'destructive'
                  : 'default'
              }
              onClick={handlePremiumOverrideDecision}
              disabled={
                approvePremiumOverrideMutation.isPending ||
                rejectPremiumOverrideMutation.isPending ||
                (premiumOverrideDecisionDialog?.action === 'reject' &&
                  !overrideDecisionReason.trim())
              }
            >
              {approvePremiumOverrideMutation.isPending ||
              rejectPremiumOverrideMutation.isPending
                ? 'Processing...'
                : premiumOverrideDecisionDialog?.action === 'approve'
                  ? 'Approve Override'
                  : 'Reject Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
