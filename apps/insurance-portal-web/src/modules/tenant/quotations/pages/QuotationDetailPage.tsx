import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/ActionMenu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  useCancelQuotation,
  useQuotationPreview,
  useQuotationWorkflow,
  useRequestQuotationPayment,
  useRequestQuotationPremiumOverride,
  useRetryQuotationTira,
  useSubmitQuotationForApproval,
  useSubmitQuotation,
  useRejectQuotationPremiumOverride,
  useTransitionQuotationStatus,
} from '../hooks';
import type {
  QuotationPreviewPremiumOverride,
  QuotationPreviewRisk,
  QuotationStatusTransitionAction,
} from '../types';
import { getFriendlyWorkflowLabel } from '../utils/quotationWorkflowLabels';
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

type WorkflowAction = {
  label: string;
  pendingLabel: string;
  isPending: boolean;
  disabled: boolean;
  onClick: () => void;
};

type ApprovalDialogState = {
  action: Extract<
    QuotationStatusTransitionAction,
    'APPROVE' | 'REQUEST_CHANGES' | 'REJECT_APPROVAL'
  >;
  title: string;
  description: string;
  reasonRequired: boolean;
  open: boolean;
};


export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { data: preview, isLoading } = useQuotationPreview(id);
  const { data: workflow, isLoading: workflowLoading } =
    useQuotationWorkflow(id);
  const submitMutation = useSubmitQuotation(id);
  const submitForApprovalMutation = useSubmitQuotationForApproval(id);
  const requestPaymentMutation = useRequestQuotationPayment(id);
  const retryTiraMutation = useRetryQuotationTira(id);
  const cancelQuotationMutation = useCancelQuotation(id);
  const transitionStatusMutation = useTransitionQuotationStatus(id);
  const requestPremiumOverrideMutation = useRequestQuotationPremiumOverride(id);
  const approvePremiumOverrideMutation = useApproveQuotationPremiumOverride(id);
  const rejectPremiumOverrideMutation = useRejectQuotationPremiumOverride(id);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [approvalDialog, setApprovalDialog] =
    useState<ApprovalDialogState | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [premiumOverrideRequestDialog, setPremiumOverrideRequestDialog] =
    useState<PremiumOverrideRequestDialogState | null>(null);
  const [premiumOverrideDecisionDialog, setPremiumOverrideDecisionDialog] =
    useState<PremiumOverrideDecisionDialogState | null>(null);
  const [overrideProposedPremium, setOverrideProposedPremium] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideDecisionReason, setOverrideDecisionReason] = useState('');

  const quotationStatus = preview?.overview.quotation_status ?? null;
  const paymentStatus = preview?.overview.payment_status ?? null;
  const displayStatus = preview?.overview.display_status ?? null;
  const pricingIntegration = preview?.pricing_integration ?? null;
  const submittedAt = preview?.overview.submitted_at ?? null;
  const hasStalePricing = pricingIntegration?.is_stale ?? false;
  const canSubmit = workflow?.availableCommands.SUBMIT_TIRAMIS ?? false;
  const canSubmitForApproval =
    workflow?.availableCommands.SUBMIT_APPROVAL ?? false;
  const canRequestPayment =
    workflow?.availableCommands.REQUEST_PAYMENT ?? false;
  const canRetrySubmission = workflow?.availableCommands.RETRY_TIRAMIS ?? false;
  const canCancel = workflow?.availableCommands.CANCEL ?? false;
  const canApproveQuotation = workflow?.availableCommands.APPROVE ?? false;
  const canRequestQuotationChanges =
    workflow?.availableCommands.REQUEST_CHANGES ?? false;
  const canRejectQuotation = workflow?.availableCommands.REJECT ?? false;
  const canManagePremiumOverrides =
    !submittedAt &&
    !!quotationStatus &&
    workflow?.submission.status === 'NOT_READY';
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

  const openApprovalDialog = (
    action: ApprovalDialogState['action'],
    options: Pick<
      ApprovalDialogState,
      'title' | 'description' | 'reasonRequired'
    >,
  ) => {
    setApprovalReason('');
    setApprovalDialog({
      action,
      open: true,
      ...options,
    });
  };

  const closeApprovalDialog = () => {
    if (transitionStatusMutation.isPending) {
      return;
    }

    setApprovalDialog(null);
    setApprovalReason('');
  };

  const handleApprovalDecision = () => {
    if (!approvalDialog) return;
    const trimmedReason = approvalReason.trim();
    if (approvalDialog.reasonRequired && !trimmedReason) return;

    transitionStatusMutation.mutate(
      {
        action: approvalDialog.action,
        reason: trimmedReason || undefined,
      },
      {
        onSuccess: () => closeApprovalDialog(),
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
      risk.premium_overrides.find(
        (override) => override.approval_status === 'PENDING',
      ) ?? null;
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
              openPremiumOverrideDecisionDialog(
                risk,
                pendingOverride,
                'approve',
              )
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
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          Back to Quotations
        </Button>
      </div>
    );
  }

  const friendlyWorkflowLabel = getFriendlyWorkflowLabel(
    workflow,
    preview.overview.display_label,
  );

  const submitToTiramis = () => {
    submitMutation.mutate(undefined, {
      onSuccess: () => {
        navigate(
          underwritingPaths.quotationDetail(preview.overview.quotation_id),
        );
      },
    });
  };

  const primaryWorkflowAction: WorkflowAction | null = canApproveQuotation
    ? {
        label: 'Approve',
        pendingLabel: 'Approving...',
        isPending: transitionStatusMutation.isPending,
        disabled: hasStalePricing,
        onClick: () =>
          openApprovalDialog('APPROVE', {
            title: 'Approve Quotation',
            description:
              'Approve this quotation so it can continue to payment or issuance.',
            reasonRequired: false,
          }),
      }
    : canSubmitForApproval
    ? {
        label: 'Complete Quotation',
        pendingLabel: 'Submitting...',
        isPending: submitForApprovalMutation.isPending,
        disabled: hasStalePricing,
        onClick: () => submitForApprovalMutation.mutate(),
      }
    : canRequestPayment
      ? {
          label: 'Request Payment',
          pendingLabel: 'Requesting...',
          isPending: requestPaymentMutation.isPending,
          disabled: hasStalePricing,
          onClick: () => requestPaymentMutation.mutate(),
        }
      : canSubmit
        ? {
            label: 'Issue Cover',
            pendingLabel: 'Submitting...',
            isPending: submitMutation.isPending,
            disabled: hasStalePricing,
            onClick: submitToTiramis,
          }
        : canRetrySubmission
          ? {
              label: 'Retry Issue Cover',
              pendingLabel: 'Retrying...',
              isPending: retryTiraMutation.isPending,
              disabled: hasStalePricing,
              onClick: () => retryTiraMutation.mutate(),
            }
          : null;

  const secondaryWorkflowActions: ActionMenuItem[] = [
    ...(canRequestQuotationChanges
      ? [
          {
            label: 'Request Changes',
            onClick: () =>
              openApprovalDialog('REQUEST_CHANGES', {
                title: 'Request Changes',
                description:
                  'Send this quotation back for correction before it can continue.',
                reasonRequired: true,
              }),
            disabled: transitionStatusMutation.isPending,
          },
        ]
      : []),
    ...(canRejectQuotation
      ? [
          {
            label: 'Reject',
            onClick: () =>
              openApprovalDialog('REJECT_APPROVAL', {
                title: 'Reject Quotation',
                description:
                  'Reject this quotation and record the reason for audit history.',
                reasonRequired: true,
              }),
            disabled: transitionStatusMutation.isPending,
            destructive: true,
          },
        ]
      : []),
    ...(canRequestPayment && primaryWorkflowAction?.label !== 'Request Payment'
      ? [
          {
            label: 'Request Payment',
            onClick: () => requestPaymentMutation.mutate(),
            disabled: requestPaymentMutation.isPending || hasStalePricing,
          },
        ]
      : []),
    ...(canSubmit && primaryWorkflowAction?.label !== 'Issue Cover'
      ? [
          {
            label: 'Issue Cover',
            onClick: submitToTiramis,
            disabled: submitMutation.isPending || hasStalePricing,
          },
        ]
      : []),
    ...(canRetrySubmission &&
    primaryWorkflowAction?.label !== 'Retry Issue Cover'
      ? [
          {
            label: 'Technical Retry',
            onClick: () => retryTiraMutation.mutate(),
            disabled: retryTiraMutation.isPending || hasStalePricing,
            separatorBefore: true,
          },
        ]
      : []),
    ...(canCancel
      ? [
          {
            label: 'Cancel Quotation',
            onClick: () => setCancelDialogOpen(true),
            disabled: cancelQuotationMutation.isPending,
            destructive: true,
            separatorBefore: true,
          },
        ]
      : []),
  ];

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(underwritingPaths.quotations)}
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to List
      </Button>
      {primaryWorkflowAction ? (
        <Button
          type="button"
          size="sm"
          disabled={
            primaryWorkflowAction.isPending || primaryWorkflowAction.disabled
          }
          onClick={primaryWorkflowAction.onClick}
        >
          {primaryWorkflowAction.isPending
            ? primaryWorkflowAction.pendingLabel
            : primaryWorkflowAction.label}
        </Button>
      ) : null}
      <ActionMenu
        items={secondaryWorkflowActions}
        contentClassName="w-52"
        disabled={secondaryWorkflowActions.every((item) => item.disabled)}
      />
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
              {friendlyWorkflowLabel}
              {preview.cover_note.cover_note_number
                ? ` - ${preview.cover_note.cover_note_number}`
                : ''}
            </p>
          </div>
        </div>
        {actionButtons}
      </div>

      <Tabs defaultValue={tabs[0]} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="policyholders">Policyholders</TabsTrigger>
          {!showFleetTabs ? (
            <TabsTrigger value="risks">Risks & Premium</TabsTrigger>
          ) : null}
          {!showFleetTabs ? (
            <TabsTrigger value="subject-matters">Subject Matters</TabsTrigger>
          ) : null}
          {!showFleetTabs ? (
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
          ) : null}
          {showMotorTab ? (
            <TabsTrigger value="motor">Motor Details</TabsTrigger>
          ) : null}
          {showFleetTabs ? (
            <TabsTrigger value="fleet">Fleet Vehicles</TabsTrigger>
          ) : null}
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

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel Quotation</DialogTitle>
            <DialogDescription>
              Provide a cancellation reason before closing this quotation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="quotation-cancellation-reason"
              className="text-sm font-medium text-slate-700"
            >
              Reason *
            </label>
            <Textarea
              id="quotation-cancellation-reason"
              rows={4}
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Why is this quotation being cancelled?"
            />
            {!cancellationReason.trim() ? (
              <p className="text-xs text-slate-500">
                A reason is required for this action.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelQuotationMutation.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                cancelQuotationMutation.mutate(cancellationReason.trim(), {
                  onSuccess: () => {
                    setCancelDialogOpen(false);
                    setCancellationReason('');
                  },
                })
              }
              disabled={
                cancelQuotationMutation.isPending || !cancellationReason.trim()
              }
            >
              {cancelQuotationMutation.isPending
                ? 'Cancelling...'
                : 'Cancel Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approvalDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) {
            closeApprovalDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{approvalDialog?.title}</DialogTitle>
            <DialogDescription>{approvalDialog?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="quotation-approval-reason"
              className="text-sm font-medium text-slate-700"
            >
              Reason {approvalDialog?.reasonRequired ? '*' : ''}
            </label>
            <Textarea
              id="quotation-approval-reason"
              rows={4}
              value={approvalReason}
              onChange={(event) => setApprovalReason(event.target.value)}
              placeholder="Add a note for the quotation history"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeApprovalDialog}
              disabled={transitionStatusMutation.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              variant={
                approvalDialog?.action === 'REJECT_APPROVAL'
                  ? 'destructive'
                  : 'default'
              }
              onClick={handleApprovalDecision}
              disabled={
                transitionStatusMutation.isPending ||
                (approvalDialog?.reasonRequired && !approvalReason.trim())
              }
            >
              {transitionStatusMutation.isPending
                ? 'Processing...'
                : approvalDialog?.action === 'APPROVE'
                  ? 'Approve'
                  : approvalDialog?.action === 'REQUEST_CHANGES'
                    ? 'Request Changes'
                    : 'Reject'}
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
                onChange={(event) =>
                  setOverrideProposedPremium(event.target.value)
                }
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
