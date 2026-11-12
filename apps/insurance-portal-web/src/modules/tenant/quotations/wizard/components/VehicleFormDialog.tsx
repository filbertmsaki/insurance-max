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

/**
 * The one vehicle modal used by every quotation wizard (Single, Fleet,
 * Short-Term; desktop and mobile). Full screen on phones, a centred dialog
 * on larger screens, with the body scrolling between a fixed header and
 * footer.
 */
export function VehicleFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  errors = [],
  onErrorClick,
  primaryLabel,
  onPrimary,
  onCancel,
  bodyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Problems that stop the vehicle being saved, listed above the buttons. */
  errors?: string[];
  onErrorClick?: (error: string) => void;
  primaryLabel: string;
  onPrimary: () => void;
  /** Shows a Cancel button when set. */
  onCancel?: () => void;
  bodyId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(description ? {} : { 'aria-describedby': undefined })}
        className="flex h-[100dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] max-sm:inset-0 max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <DialogTitle className="pr-6 break-words">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div
          id={bodyId}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 [&_input]:min-h-11 [&_input]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_textarea]:text-sm"
        >
          {children}
        </div>
        <div className="space-y-3 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {errors.length > 0 && (
            <div
              role="alert"
              className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <p className="font-medium">This vehicle can't be saved yet:</p>
              <ul className="mt-1 list-disc pl-5">
                {errors.map((error) => (
                  <li key={error}>
                    {onErrorClick ? (
                      <button
                        type="button"
                        className="py-1 text-left underline underline-offset-2"
                        onClick={() => onErrorClick(error)}
                      >
                        {error}
                      </button>
                    ) : (
                      error
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="button" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
