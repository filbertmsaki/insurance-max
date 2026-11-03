import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/** A checkbox row used by the branch, department, role and permission lists. */
export function SelectableCard({
  checked,
  onCheckedChange,
  title,
  description,
  badges,
  disabled,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2.5 transition-colors',
        checked
          ? 'border-blue-300 bg-blue-50/60'
          : 'border-slate-200 bg-white hover:border-slate-300',
        disabled && 'opacity-60',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">{title}</span>
            {badges}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-slate-500">
              {description}
            </span>
          )}
        </span>
      </label>
      {children && <div className="mt-2 pl-7">{children}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );
}
