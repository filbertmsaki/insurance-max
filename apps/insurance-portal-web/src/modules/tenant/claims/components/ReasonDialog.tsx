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

/** Confirms an action that must be justified (cancel, fail, reverse, close). */
export function ReasonDialog({
  title,
  description,
  label = 'Reason',
  confirmLabel,
  destructive,
  maxLength = 1000,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  label?: string;
  confirmLabel: string;
  destructive?: boolean;
  maxLength?: number;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason-dialog-text" required>
            {label}
          </Label>
          <Textarea
            id="reason-dialog-text"
            rows={3}
            maxLength={maxLength}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {touched && missing ? (
            <p className="text-sm font-medium text-red-600">
              {label} is required.
            </p>
          ) : null}
        </div>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(reason.trim());
            }}
          >
            {pending ? 'Saving...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
