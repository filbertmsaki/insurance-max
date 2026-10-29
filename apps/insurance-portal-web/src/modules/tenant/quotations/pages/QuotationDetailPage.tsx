import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/components/shared/detailFormat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/ActionMenu';
import { QuotationDetailHeader } from '../components/QuotationDetailLayout';
import { QuotationDetailsContent } from '../components/QuotationDetailsContent';
import { QuotationPaymentTab } from '../components/QuotationPaymentTab';
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
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { CoverNotesSection } from '@/modules/tenant/cover-notes/components/CoverNotesSection';
import {
  QuotationHistoryPreview,
  TiramisSubmissionPreview,
} from '../components/QuotationPreviewSections';
import {
  useApproveQuotationPremiumOverride,
  useCancelQuotation,
  useQuotationPreview,
  useQuotationRealtime,
  useQuotationWorkflow,
  useRequestQuotationPayment,
  useRequestQuotationPremiumOverride,
  useRetryQuotationTira,
  useSyncQuotationTira,
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

const QUOTATION_DETAIL_TABS = [
  { id: 'details', label: 'Quotation Details' },
  { id: 'payment', label: 'Payment Details & History' },
  { id: 'tiramis', label: 'TIRAMIS Information' },
  { id: 'history', label: 'Quotation History' },
] as const;

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

export function QuotationDetailPage({
  tiramisPanel,
}: {
  /** Extra issuance content for the TIRAMIS tab, e.g. a fleet's per-vehicle cover notes. */
  tiramisPanel?: ReactNode;
} = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  useQuotationRealtime(id);
  const {
    data: preview,
    isLoading,
    isError,
    refetch,
  } = useQuotationPreview(id);
  const { data: workflow } = useQuotationWorkflow(id);
  const submitMutation = useSubmitQuotation(id);
  const submitForApprovalMutation = useSubmitQuotationForApproval(id);
  const requestPaymentMutation = useRequestQuotationPayment(id);
  const retryTiraMutation = useRetryQuotationTira(id);
  const syncTiraMutation = useSyncQuotationTira(id);
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
  const [activeTab, setActiveTab] = useState('details');
  const [visitedTabs, setVisitedTabs] = useState(['details']);

  const quotationStatus = preview?.overview.quotation_status ?? null;
  const pricingIntegration = preview?.pricing_integration ?? null;
  const submittedAt = preview?.overview.submitted_at ?? null;
  const hasStalePricing = pricingIntegration?.is_stale ?? false;
  const canSubmit = workflow?.availableCommands.SUBMIT_TIRAMIS ?? false;
  const canSubmitForApproval =
    workflow?.availableCommands.SUBMIT_APPROVAL ?? false;
  const canRequestPayment =
    workflow?.availableCommands.REQUEST_PAYMENT ?? false;
  const canRetrySubmission =
    (workflow?.availableCommands.RETRY_TIRAMIS ?? false) &&
    preview?.overview.tira_status !== 'SUCCESS';
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

  if (isError) {
    return (
      <div role="alert" className="space-y-3 py-16 text-center">
        <p>Unable to load this quotation.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="py-24 text-center text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button
          variant="link"
          onClick={() => navigate(sharedUnderwritePaths.quotations)}
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
          sharedUnderwritePaths.quotationDetail(preview.overview.quotation_id),
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
    <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11 sm:[&_button]:min-h-8">
      {preview?.overview.tira_status === 'SUCCESS' &&
      hasPermission('tiramis.sync') ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={syncTiraMutation.isPending}
          onClick={() => syncTiraMutation.mutate()}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Sync
        </Button>
      ) : null}
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
        className="h-11 w-11 sm:h-8 sm:w-8"
        items={secondaryWorkflowActions}
        contentClassName="w-52"
        disabled={secondaryWorkflowActions.every((item) => item.disabled)}
      />
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <QuotationDetailHeader
        preview={preview}
        workflowLabel={friendlyWorkflowLabel}
        onBack={() => navigate(sharedUnderwritePaths.quotations)}
        actions={actionButtons}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setVisitedTabs((tabs) =>
            tabs.includes(value) ? tabs : [...tabs, value],
          );
        }}
        className="min-w-0 space-y-0 rounded-md border border-slate-200 bg-white"
      >
        <div className="max-w-full overflow-x-auto px-2 sm:px-4">
          <TabsList
            aria-label="Quotation information"
            className="w-max min-w-full flex-nowrap gap-0"
          >
            {QUOTATION_DETAIL_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="min-h-11 px-3 sm:px-4"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="details" className="mt-0 min-w-0">
          <QuotationDetailsContent
            preview={preview}
            renderRiskActions={renderRiskActions}
          />
        </TabsContent>
        <TabsContent
          value="payment"
          forceMount
          hidden={activeTab !== 'payment'}
          className="mt-0 min-w-0"
        >
          {visitedTabs.includes('payment') && (
            <QuotationPaymentTab preview={preview} />
          )}
        </TabsContent>

        <TabsContent
          value="tiramis"
          forceMount
          hidden={activeTab !== 'tiramis'}
          className="mt-0 min-w-0"
        >
          {visitedTabs.includes('tiramis') && (
            <>
              <TiramisSubmissionPreview tiramis={preview.tiramis} />
              {tiramisPanel}
              <div className="min-w-0 p-4 sm:p-6">
                <CoverNotesSection
                  quotationId={preview.overview.quotation_id}
                  tiraAccepted={preview.overview.tira_status === 'SUCCESS'}
                />
              </div>
              <QuotationHistoryPreview
                title="Submission and Synchronization History"
                history={preview.history.filter((item) =>
                  /tiramIS|tira |acknowledgement|callback|retry|sync/i.test(
                    item.action,
                  ),
                )}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0 min-w-0">
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
              {formatMoney(
                premiumOverrideRequestDialog?.risk.premium_before_discount,
                preview?.cover_note.currency,
              )}
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
                {formatMoney(
                  premiumOverrideDecisionDialog?.override
                    .original_calculated_premium,
                  preview?.cover_note.currency,
                )}
              </div>
              <div>
                Proposed premium:{' '}
                {formatMoney(
                  premiumOverrideDecisionDialog?.override.proposed_premium,
                  preview?.cover_note.currency,
                )}
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
