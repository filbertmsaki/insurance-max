import * as React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactElement<{ id?: string; 'aria-required'?: boolean; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}

export function FormField({ id, label, required, optional, helperText, error, children }: FormFieldProps) {
  const descriptionId = error || helperText ? `${id}-description` : undefined;
  const describedBy = [children.props['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined;
  return <div className="flex flex-col gap-1">
    <label htmlFor={id} className="mb-0.5 text-[length:var(--label-font-size)] font-semibold text-[var(--color-text)]">
      {label}{required && <span aria-hidden="true" className="text-[var(--color-danger)]"> *</span>}
      {optional && !required && <span className="ml-1 font-normal text-[var(--color-text-muted)]">Optional</span>}
    </label>
    {React.cloneElement(children, { id, 'aria-required': required || children.props['aria-required'] || undefined, 'aria-invalid': error ? true : children.props['aria-invalid'], 'aria-describedby': describedBy })}
    {descriptionId && <div id={descriptionId} role={error ? 'alert' : undefined} className={`flex items-center gap-1 text-[length:var(--helper-font-size)] ${error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
      {error && <AlertCircle aria-hidden="true" className="h-3 w-3 shrink-0" />}{error || helperText}
    </div>}
  </div>;
}
