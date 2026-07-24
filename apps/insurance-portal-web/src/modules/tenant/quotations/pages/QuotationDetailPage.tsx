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
import { Skeleton } from '@/components/ui/skeleton';
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
  useDeleteQuotation,
  useQuotationPreview,
  useSubmitQuotation,
  useTransitionQuotationStatus,
} from '../hooks';
import type { QuotationStatusTransitionAction } from '../types';

const TERMINAL_STATUSES = new Set([
  'CONVERTED',
  'CANCELLED',
  'EXPIRED',
  'SUBMITTED_TO_TIRA',
  'COMPLETED',
  'FAILED',
]);
const EDITABLE_STATUSES = new Set(['DRAFT', 'RATED', 'REFERRED', 'REJECTED']);
const APPROVABLE_STATUSES = new Set([
  'PENDING_APPROVAL',
  'SUBMITTED_TO_TIRA',
  'REFERRED',
]);
const REJECTABLE_STATUSES = new Set([
  'PENDING_APPROVAL',
  'SUBMITTED_TO_TIRA',
  'REFERRED',
]);
const CANCELLABLE_STATUSES = new Set([
  'DRAFT',
  'PENDING_APPROVAL',
  'SUBMITTED_TO_TIRA',
  'APPROVED',
]);
const DIRECT_PAYMENT_MODE = 1;

type StatusActionDialogState = {
  action: QuotationStatusTransitionAction;
  open: boolean;
};

function actionLabel(action: QuotationStatusTransitionAction) {
  switch (action) {
    case 'APPROVE':
      return 'Approve';
    case 'REJECT':
      return 'Reject';
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
  if (action === 'REJECT' || action === 'CANCEL') {
    return true;
  }

  return action === 'APPROVE' && quotationStatus === 'REFERRED';
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: preview, isLoading } = useQuotationPreview(id);
  const deleteMutation = useDeleteQuotation();
  const submitMutation = useSubmitQuotation(id);
  const transitionStatusMutation = useTransitionQuotationStatus(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusActionDialog, setStatusActionDialog] =
    useState<StatusActionDialogState | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  const quotationStatus = preview?.overview.quotation_status ?? null;
  const paymentStatus = preview?.payment?.payment_status ?? null;
  const paymentMode = preview?.payment?.payment_mode ?? null;
  const submittedAt = preview?.overview.submitted_at ?? null;
  const canEdit = quotationStatus
    ? EDITABLE_STATUSES.has(quotationStatus)
    : false;
  const canEndorse = quotationStatus === 'COMPLETED';
  const canSubmit =
    quotationStatus && submittedAt === null
      ? !TERMINAL_STATUSES.has(quotationStatus)
      : false;
  const isDirectPay = paymentMode === DIRECT_PAYMENT_MODE;
  const canApprove = quotationStatus
    ? APPROVABLE_STATUSES.has(quotationStatus) && !isDirectPay
    : false;
  const canReject = quotationStatus
    ? REJECTABLE_STATUSES.has(quotationStatus) && !isDirectPay
    : false;
  const canCancel = quotationStatus ? CANCELLABLE_STATUSES.has(quotationStatus) : false;
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
      {canApprove ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('APPROVE')}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          Approve
        </Button>
      ) : null}
      {canReject ? (
        <Button
          variant="outline"
          size="sm"
          disabled={transitionStatusMutation.isPending}
          onClick={() => openStatusActionDialog('REJECT')}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Reject
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
          disabled={submitMutation.isPending}
          onClick={() =>
            submitMutation.mutate(undefined, {
              onSuccess: () => {
                navigate(underwritingPaths.quotationDetail(preview.overview.quotation_id));
              },
            })
          }
        >
          Submit
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
              <QuotationStatusBadge status={quotationStatus} />
              <PaymentStatusBadge status={paymentStatus} />
            </div>
            <p className="text-sm text-slate-500">
              {preview.cover_note.cover_note_number ?? 'Preview'}
            </p>
          </div>
        </div>
        {actionButtons}
      </div>

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
            <RiskPreview risks={preview.risks} />
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
                <FleetVehicleList vehicles={preview.fleet.vehicles} />
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
              {statusActionDialog?.action === 'APPROVE'
                ? 'Approve this quotation and keep a short note when needed.'
                : statusActionDialog?.action === 'REJECT'
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
                statusActionDialog?.action === 'APPROVE'
                  ? 'Approval note or referral resolution comment'
                  : statusActionDialog?.action === 'REJECT'
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
                statusActionDialog?.action === 'REJECT' ||
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
    </div>
  );
}
