import type { FieldPath, UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { QuotationFormSchemaValues } from '../../schemas';
import { WizardFormItem } from './WizardFormItem';

export function WizardInput({
  form,
  name,
  label,
  options,
  type = 'text',
  multiline,
  disabled,
  readOnly,
  onChange,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  name: FieldPath<QuotationFormSchemaValues>;
  label: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const props = {
          name: field.name,
          ref: field.ref,
          onBlur: field.onBlur,
          disabled,
          readOnly,
          value:
            type === 'date'
              ? String(field.value ?? '').slice(0, 10)
              : String(field.value ?? ''),
          onChange: (
            event: React.ChangeEvent<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >,
          ) => {
            field.onChange(event.target.value);
            onChange?.(event.target.value);
          },
        };
        return (
          <WizardFormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              {options ? (
                <select
                  {...props}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select {label.toLowerCase()}</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : multiline ? (
                <Textarea {...props} rows={2} />
              ) : (
                <Input
                  {...props}
                  type={type}
                  step={type === 'number' ? 'any' : undefined}
                />
              )}
            </FormControl>
            <FormMessage />
          </WizardFormItem>
        );
      }}
    />
  );
}
