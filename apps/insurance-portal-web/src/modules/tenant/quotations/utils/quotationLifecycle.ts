import type { QuotationPreviewRecord, QuotationWorkflowView } from '../types';

export type LifecycleStepState = 'done' | 'current' | 'failed' | 'upcoming';

export interface LifecycleStep {
  key:
    | 'draft'
    | 'requirements'
    | 'approval'
    | 'payment'
    | 'submitted'
    | 'cover_note'
    | 'policy';
  label: string;
  state: LifecycleStepState;
  /** Shown under a failed step. */
  error?: string | null;
}

export type OverallTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

export interface QuotationLifecycle {
  steps: LifecycleStep[];
  overall: { label: string; tone: OverallTone };
  /** Quotation was cancelled or expired; the tracker is frozen. */
  closed: boolean;
}

const TIRA_SUBMITTED = ['SUBMITTED', 'PROCESSING', 'SUCCESS', 'ENDORSED'];
const TIRA_ISSUED = ['SUCCESS', 'ENDORSED'];

/** What each step is waiting for while it is the current one. */
const WAITING_LABEL: Record<LifecycleStep['key'], string> = {
  draft: 'Draft',
  requirements: 'Pending requirements',
  approval: 'Awaiting approval',
  payment: 'Awaiting payment',
  submitted: 'Ready for TIRA',
  cover_note: 'Processing at TIRA',
  policy: 'Issuing policy',
};

const FAILED_LABEL: Record<LifecycleStep['key'], string> = {
  draft: 'Action required',
  requirements: 'Action required',
  approval: 'Approval action required',
  payment: 'Payment failed',
  submitted: 'TIRA submission failed',
  cover_note: 'Rejected by TIRA',
  policy: 'Policy issue failed',
};

/**
 * Derives the quotation's lifecycle from statuses the preview API already
 * returns. Steps that do not apply (approval or payment not required) are
 * left out rather than shown as skipped.
 */
export function buildQuotationLifecycle(
  preview: QuotationPreviewRecord,
  options: {
    workflow?: QuotationWorkflowView;
    /** Whether a policy record exists for this quotation (undefined: unknown). */
    hasPolicy?: boolean;
  } = {},
): QuotationLifecycle {
  const { overview, tiramis } = preview;
  const { workflow, hasPolicy } = options;
  const status = overview.quotation_status;
  const tira = overview.tira_status;
  const payment = overview.payment_status;
  const approval = overview.approval_status;
  const tiraError =
    tiramis?.last_submission_error ||
    workflow?.submission.failureReason ||
    null;

  type Draft = {
    key: LifecycleStep['key'];
    label: string;
    done: boolean;
    failed?: boolean;
    error?: string | null;
  };
  const raw: Draft[] = [
    { key: 'draft', label: 'Draft', done: status !== 'DRAFT' },
    {
      key: 'requirements',
      label: 'Requirements',
      done: !['DRAFT', 'PENDING_REQUIREMENTS'].includes(status),
    },
  ];
  if (
    overview.requires_approval ||
    !['NOT_REQUIRED', 'NOT_SUBMITTED'].includes(approval)
  ) {
    raw.push({
      key: 'approval',
      label: 'Approved',
      done: approval === 'APPROVED' || approval === 'NOT_REQUIRED',
      failed: approval === 'REJECTED' || approval === 'CHANGES_REQUESTED',
      error:
        approval === 'CHANGES_REQUESTED'
          ? workflow?.approval.reason ||
            workflow?.approval.comments ||
            'Changes requested'
          : approval === 'REJECTED'
            ? workflow?.approval.reason || 'Approval rejected'
            : null,
    });
  }
  if (overview.requires_payment || payment !== 'NOT_REQUIRED') {
    raw.push({
      key: 'payment',
      label: 'Paid',
      done: payment === 'PAID' || payment === 'NOT_REQUIRED',
      failed: payment === 'FAILED' || payment === 'EXPIRED',
      error:
        payment === 'FAILED' || payment === 'EXPIRED'
          ? workflow?.payment.failureReason ||
            (payment === 'EXPIRED'
              ? 'Payment request expired'
              : 'Payment failed')
          : null,
    });
  }
  raw.push(
    {
      key: 'submitted',
      label: 'Submitted to TIRA',
      done: TIRA_SUBMITTED.includes(tira) || tira === 'REJECTED',
      failed: tira === 'FAILED',
      error: tira === 'FAILED' ? (tiraError ?? 'Submission failed') : null,
    },
    {
      key: 'cover_note',
      label: 'Cover note issued',
      done: TIRA_ISSUED.includes(tira),
      failed: tira === 'REJECTED',
      error:
        tira === 'REJECTED'
          ? tiramis?.response_status_description ||
            tiraError ||
            'Rejected by TIRA'
          : null,
    },
  );
  // Without policy read access the last step is unknown, so it is left out.
  if (hasPolicy !== undefined) {
    raw.push({ key: 'policy', label: 'Policy issued', done: hasPolicy });
  }

  // Everything before the first unfinished step counts as done, even when a
  // later status was recorded first (e.g. paid before approval was logged).
  let reachedCurrent = false;
  const steps: LifecycleStep[] = raw.map((step) => {
    if (reachedCurrent)
      return { key: step.key, label: step.label, state: 'upcoming' };
    if (step.done) return { key: step.key, label: step.label, state: 'done' };
    reachedCurrent = true;
    return step.failed
      ? { key: step.key, label: step.label, state: 'failed', error: step.error }
      : { key: step.key, label: step.label, state: 'current' };
  });

  const closed = status === 'CANCELLED' || status === 'EXPIRED';
  const current = steps.find(
    (s) => s.state === 'current' || s.state === 'failed',
  );

  let overall: QuotationLifecycle['overall'];
  if (status === 'CANCELLED') overall = { label: 'Cancelled', tone: 'muted' };
  else if (status === 'EXPIRED') overall = { label: 'Expired', tone: 'muted' };
  else if (!current)
    overall = {
      label: hasPolicy ? 'Policy issued' : 'Cover note issued',
      tone: 'success',
    };
  else if (current.state === 'failed')
    overall = { label: FAILED_LABEL[current.key], tone: 'danger' };
  else
    overall = {
      label: WAITING_LABEL[current.key],
      tone:
        current.key === 'draft' || current.key === 'requirements'
          ? 'muted'
          : current.key === 'payment' || current.key === 'approval'
            ? 'warning'
            : 'info',
    };

  return { steps, overall, closed };
}
