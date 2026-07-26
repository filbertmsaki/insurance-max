import type { ComponentProps } from 'react';
import { FormItem } from '@/components/ui/form';
import { cn } from '@/lib/utils';

/**
 * FormItem is shared app-wide (space-y-2 default); this wraps it with the wizard's
 * tighter label-to-field spacing without touching that shared component's default.
 */
export function WizardFormItem({ className, ...props }: ComponentProps<typeof FormItem>) {
  return <FormItem className={cn('space-y-1', className)} {...props} />;
}
