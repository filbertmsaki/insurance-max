import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { ReactNode } from 'react';
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
import { ClaimErrorAlert } from './ClaimErrorAlert';

/** A dialog wrapping one react-hook-form form with Cancel and submit buttons. */
export function FormDialog<TValues extends FieldValues>({
  id,
  title,
  description,
  form,
  submitLabel,
  pending,
  error,
  onSubmit,
  onClose,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  form: UseFormReturn<TValues>;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: TValues) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id={id}
            className="space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {children}
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={id} disabled={pending}>
            {pending ? 'Saving...' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
