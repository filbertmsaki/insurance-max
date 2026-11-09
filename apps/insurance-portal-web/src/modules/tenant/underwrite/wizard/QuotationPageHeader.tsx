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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-full px-0 sm:h-10 sm:w-10"
          aria-label={backLabel}
          title={backLabel}
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
            {badge}
          </div>
          <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 [overflow-wrap:anywhere] sm:text-2xl">
            {title}
          </h1>
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
