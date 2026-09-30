import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Options = ReadonlyArray<{ value: string; label: string }>;

/** A labelled text, textarea, date or select field bound to react-hook-form. */
export function ClaimField<TValues extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  options,
  multiline,
  rows = 3,
  required,
  disabled,
  placeholder,
  description,
  uppercase,
  maxLength,
}: {
  form: UseFormReturn<TValues>;
  name: FieldPath<TValues>;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'datetime-local';
  options?: Options;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
  uppercase?: boolean;
  maxLength?: number;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel required={required}>{label}</FormLabel>
          {options ? (
            <Select
              value={String(field.value ?? '')}
              onValueChange={(value) => {
                if (value) field.onChange(value);
              }}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                  <SelectValue
                    placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <FormControl>
              {multiline ? (
                <Textarea
                  {...field}
                  value={String(field.value ?? '')}
                  rows={rows}
                  disabled={disabled}
                  placeholder={placeholder}
                  maxLength={maxLength}
                />
              ) : (
                <Input
                  {...field}
                  value={String(field.value ?? '')}
                  type={type}
                  step={type === 'number' ? 'any' : undefined}
                  disabled={disabled}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  onChange={(event) =>
                    field.onChange(
                      uppercase
                        ? event.target.value.toUpperCase()
                        : event.target.value,
                    )
                  }
                />
              )}
            </FormControl>
          )}
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
