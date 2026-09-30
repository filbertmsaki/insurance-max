import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClaimErrorAlert } from './ClaimErrorAlert';

export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'RETURN';

/**
 * Approve, decline or return a claim item awaiting approval (§10). A
 * comment is required to decline or return, and optional to approve.
 */
export function ApprovalDecisionDialog({
  open,
  onOpenChange,
  title,
  summary,
  decision,
  allowReturn,
  declineLabel,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  decision: 'APPROVE' | 'DECLINE';
  /** Offer "return for rework" next to decline. */
  allowReturn?: boolean;
  /** Label of the reason-required action; "Decline" by default. */
  declineLabel?: string;
  pending: boolean;
  error: unknown;
  onConfirm: (decision: ApprovalDecision, comments: string) => void;
}) {
  const [comments, setComments] = useState('');
  const [touched, setTouched] = useState(false);
  const needsComment = decision === 'DECLINE';
  const missing = needsComment && !comments.trim();

  function confirm(chosen: ApprovalDecision) {
    setTouched(true);
    if (chosen !== 'APPROVE' && !comments.trim()) return;
    onConfirm(chosen, comments.trim());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setComments('');
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="approval-comments" required={needsComment}>
            {needsComment ? 'Reason' : 'Comments'}
          </Label>
          <Textarea
            id="approval-comments"
            rows={3}
            maxLength={2000}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
          {touched && missing ? (
            <p className="text-sm font-medium text-red-600">
              Give a reason for the decision.
            </p>
          ) : null}
        </div>
        <ClaimErrorAlert error={error} />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {decision === 'APPROVE' ? (
            <Button onClick={() => confirm('APPROVE')} disabled={pending}>
              {pending ? 'Approving...' : 'Approve'}
            </Button>
          ) : (
            <>
              {allowReturn ? (
                <Button
                  variant="outline"
                  onClick={() => confirm('RETURN')}
                  disabled={pending}
                >
                  Return for rework
                </Button>
              ) : null}
              <Button
                variant="destructive"
                onClick={() => confirm('REJECT')}
                disabled={pending}
              >
                {pending ? 'Saving...' : (declineLabel ?? 'Decline')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
