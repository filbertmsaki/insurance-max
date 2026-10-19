import type {
  QuotationPreviewTiramisSubmission,
  QuotationWorkflowView,
} from '../types';

export function getFriendlyWorkflowLabel(
  workflow: QuotationWorkflowView | undefined,
  fallback: string | null,
) {
  if (!workflow) return fallback ?? 'Not Issued';
  if (workflow.quotationStage === 'DRAFT') return 'Continue Quotation';
  if (workflow.quotationStage === 'CANCELLED') return 'Cancelled';
  if (workflow.approval.status === 'PENDING') return 'Awaiting Approval';
  if (
    workflow.approval.status === 'CHANGES_REQUESTED' ||
    workflow.approval.status === 'REJECTED'
  ) {
    return 'Action Required';
  }
  if (
    workflow.payment.status === 'NOT_REQUESTED' ||
    workflow.payment.status === 'REQUESTED' ||
    workflow.payment.status === 'FAILED'
  ) {
    return 'Payment Required';
  }
  if (workflow.submission.status === 'READY') return 'Ready to Issue';
  if (
    ['QUEUED', 'PROCESSING', 'ACKNOWLEDGED'].includes(
      workflow.submission.status,
    )
  ) {
    return 'Issuing';
  }
  if (workflow.submission.status === 'ACCEPTED') return 'Issued';
  if (workflow.submission.status === 'REJECTED') return 'Rejected';
  if (
    ['FAILED', 'RETRYABLE', 'RETRY_EXHAUSTED'].includes(
      workflow.submission.status,
    )
  ) {
    return 'Action Required';
  }
  return fallback ?? 'Not Issued';
}

export function getFriendlyTiramisStatus(
  tiramis: QuotationPreviewTiramisSubmission | null,
) {
  const status = tiramis?.submission_status?.trim().toUpperCase() ?? '';
  const responseCode =
    tiramis?.response_status_code?.trim().toUpperCase() ?? '';
  const callbackStatus =
    tiramis?.callback_received_status?.trim().toUpperCase() ?? '';

  if (!tiramis || !status) return 'Not Issued';
  if (
    tiramis.cover_note_reference_number ||
    (status.includes('SUCCESS') && !status.includes('ACK'))
  ) {
    return 'Issued';
  }
  if (['DRAFT', 'NOT_SUBMITTED', 'VALIDATED'].includes(status))
    return 'Not Issued';
  if (
    status.includes('REJECT') ||
    responseCode.includes('REJECT') ||
    callbackStatus.includes('REJECT')
  ) {
    return 'Rejected';
  }
  if (
    status.includes('FAIL') ||
    status.includes('ERROR') ||
    status.includes('RETRY')
  ) {
    return 'Action Required';
  }
  if (
    status.includes('SUBMIT') ||
    status.includes('PROCESS') ||
    status.includes('ACK') ||
    status.includes('QUEUE') ||
    callbackStatus.includes('PENDING')
  ) {
    return 'Issuing';
  }
  return 'Ready to Issue';
}
