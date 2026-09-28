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
import { Textarea } from '@/components/ui/textarea';

export interface TransactionReasonAction {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}

/**
 * Collects the mandatory reason for policy-transaction decisions
 * (reject, request changes, withdraw/cancel draft).
 */
export function TransactionReasonDialog({
  action,
  onClose,
}: {
  action: TransactionReasonAction | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setReason('');
    onClose();
  };

  const confirm = async () => {
    if (!action || !reason.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await action.onConfirm(reason.trim());
      close();
    } catch {
      // The caller surfaces the error; keep the dialog open to retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action?.title}</DialogTitle>
          <DialogDescription>{action?.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Reason (required)"
        />
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Close
          </Button>
          <Button
            onClick={confirm}
            disabled={submitting || !reason.trim()}
            className={
              action?.destructive ? 'bg-red-600 hover:bg-red-700' : undefined
            }
          >
            {submitting ? 'Processing...' : action?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
