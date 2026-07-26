import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StepSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header slot: Add/Edit/Remove buttons. */
  action?: ReactNode;
  /**
   * 'section' (default): heading + top divider, for named groupings living directly in the
   * wizard's one master card. 'item': self-contained bordered box, no divider — for repeated
   * list rows (risk/add-on/vehicle entries) so adjacent items stay visually distinct.
   */
  variant?: 'section' | 'item';
  /** Suppresses the divider/top spacing — pass on the first section rendered by a step. */
  first?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function StepSection({
  title,
  description,
  action,
  variant = 'section',
  first = false,
  className,
  contentClassName,
  children,
}: StepSectionProps) {
  const isItem = variant === 'item';

  return (
    <div
      className={cn(
        isItem
          ? 'rounded-xl border border-slate-200 p-3.5 sm:p-4'
          : !first && 'border-t border-slate-100 pt-4',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-2.5 flex flex-row items-center justify-between gap-2">
          <div>
            {title && (
              <h3
                className={
                  isItem
                    ? 'text-sm font-semibold text-slate-900'
                    : 'text-base font-semibold text-slate-900'
                }
              >
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn('space-y-1', contentClassName)}>{children}</div>
    </div>
  );
}
