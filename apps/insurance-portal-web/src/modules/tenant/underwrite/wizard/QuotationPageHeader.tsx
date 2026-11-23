import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Page header shared by the quotation create, edit and view screens: a round
 * back button, an eyebrow with an optional badge, the title and optional
 * actions (stacked full-width on mobile).
 */
export function QuotationPageHeader({
  eyebrow,
  title,
  badge,
  backLabel,
  onBack,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  badge?: ReactNode;
  backLabel: string;
  onBack: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-9 shrink-0 rounded-full px-0 sm:h-8 sm:w-8"
          aria-label={backLabel}
          title={backLabel}
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="text-base font-semibold leading-tight text-slate-900 [overflow-wrap:anywhere]">
            {title}
          </h1>
          <span className="text-xs text-slate-500">· {eyebrow}</span>
          {badge}
        </div>
      </div>
      {actions ? (
        <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex [&_button]:min-h-11 sm:[&_button]:min-h-10">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
