import { useRef, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const SWIPE_CLOSE_PX = 80;

/**
 * Mobile bottom sheet: dimmed backdrop, 16px top corners, grab handle and
 * home-indicator padding. Closes on backdrop tap, Escape or a downward
 * swipe; focus is trapped while open and returns to the opener on close.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; visually hidden unless the content shows it. */
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const startY = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgb(27_31_46/0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[61] max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] pb-[calc(12px+env(safe-area-inset-bottom))] text-[var(--color-text)] shadow-[0_-8px_32px_rgb(27_31_46/0.18)] outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
            className,
          )}
          style={offset ? { transform: `translateY(${offset}px)` } : undefined}
          onTouchStart={(event) => {
            const content = event.currentTarget;
            startY.current =
              content.scrollTop <= 0 ? event.touches[0].clientY : null;
          }}
          onTouchMove={(event) => {
            if (startY.current === null) return;
            setOffset(Math.max(0, event.touches[0].clientY - startY.current));
          }}
          onTouchEnd={() => {
            if (offset > SWIPE_CLOSE_PX) onOpenChange(false);
            startY.current = null;
            setOffset(0);
          }}
        >
          <div
            aria-hidden
            className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-[var(--color-border)]"
          />
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description ?? title}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
