import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionStepSectionProps {
  id: string;
  title: ReactNode;
  /** Shown next to the title when the section is collapsed. */
  summary?: ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
  /** Shows a check mark instead of a chevron rotation cue when true. */
  isComplete?: boolean;
  hasError?: boolean;
  children: ReactNode;
}

/**
 * A single collapsible panel used to break a long wizard step into
 * focused, one-at-a-time sections instead of one continuous scroll.
 * Content is hidden with `hidden`, never unmounted, so state and effects
 * inside collapsed sections (e.g. premium calculation hooks) keep running.
 */
export function AccordionStepSection({
  id,
  title,
  summary,
  isOpen,
  onToggle,
  isComplete = false,
  hasError = false,
  children,
}: AccordionStepSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
              hasError
                ? 'border-red-300 bg-red-50 text-red-600'
                : isComplete
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400',
            )}
          >
            {isComplete && !hasError ? <Check className="h-3 w-3" /> : ''}
          </span>
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </span>
        <span className="flex items-center gap-3">
          {!isOpen && summary && (
            <span className="hidden max-w-[16rem] truncate text-xs text-slate-500 sm:inline">
              {summary}
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </button>
      <div
        hidden={!isOpen}
        className="space-y-6 border-t border-slate-100 px-4 pb-4 pt-4"
      >
        {children}
      </div>
    </div>
  );
}
