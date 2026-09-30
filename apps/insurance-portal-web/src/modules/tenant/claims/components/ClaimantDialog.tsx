import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import type { ClaimantPayload } from '../types';
import {
  claimantSchema,
  emptyClaimant,
  toClaimantPayload,
  type ClaimantFormValues,
} from '../wizard/schema';
import { ClaimantFields } from './ClaimantFields';
import { ClaimErrorAlert } from './ClaimErrorAlert';

/**
 * Add or edit one claimant of an existing claim. Mounted per open, so the
 * form always starts from `initial`.
 */
export function ClaimantDialog({
  title,
  initial,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial?: ClaimantFormValues;
  pending: boolean;
  error: unknown;
  onSave: (payload: ClaimantPayload) => void;
  onClose: () => void;
}) {
  const form = useForm<ClaimantFormValues>({
    resolver: zodResolver(claimantSchema),
    defaultValues: initial ?? emptyClaimant(),
  });
  const claimant = useWatch({ control: form.control }) as ClaimantFormValues;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            TIRA needs the category, type, ID, country, district and phone
            number of every claimant before the intimation is submitted.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="claimant-dialog-form"
            onSubmit={form.handleSubmit((values) =>
              onSave(toClaimantPayload(values)),
            )}
          >
            <ClaimantFields form={form} prefix="" claimant={claimant} />
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="claimant-dialog-form" disabled={pending}>
            {pending ? 'Saving...' : 'Save claimant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
