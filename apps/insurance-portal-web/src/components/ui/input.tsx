import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  controlSize?: 'sm' | 'md' | 'lg';
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, controlSize = 'md', ...props }, ref) => {
    return (
      <input
        type={type}
        data-control-size={controlSize}
        className={cn('ui-control flex', className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
