import { memo, useState, type Ref } from 'react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Combobox } from '@/components/ui/combobox';
import {
  FormControl,
  FormField,
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
import type { QuotationFormSchemaValues } from '../../schemas';
import { WizardFormItem } from './WizardFormItem';

type SelectOptions = ReadonlyArray<{ value: string; label: string }>;

/**
 * Radix Select mounts every item even while closed, and the wizard re-renders
 * on each keystroke and keeps every fleet vehicle mounted — so long lists such
 * as the manufacture years are only rendered while open (the trigger shows the
 * selected label itself), and the component is memoized.
 */
const WizardSelect = memo(function WizardSelect({
  value,
  options,
  placeholder,
  disabled,
  required,
  triggerRef,
  onBlur,
  onValueChange,
}: {
  value: string;
  options: SelectOptions;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  triggerRef: Ref<HTMLButtonElement>;
  onBlur: () => void;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Select
      value={value}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      onValueChange={(next) => {
        // Radix's hidden form <select> reports '' when the value changes to
        // one without a rendered option (e.g. set before its list loads). No
        // real option is empty, so ignore it instead of clearing the field.
        if (next) onValueChange(next);
      }}
    >
      <FormControl>
        <SelectTrigger
          ref={triggerRef}
          onBlur={onBlur}
          aria-required={required}
        >
          <SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {open &&
          options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
});

export function WizardInput({
  form,
  name,
  label,
  options,
  type = 'text',
  multiline,
  disabled,
  readOnly,
  required,
  searchable,
  uppercase,
  onChange,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  name: FieldPath<QuotationFormSchemaValues>;
  label: string;
  options?: SelectOptions;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
  /** Shows the red asterisk and marks the control aria-required. */
  required?: boolean;
  readOnly?: boolean;
  /** With `options`, renders the type-to-search Combobox instead of a plain select. */
  searchable?: boolean;
  /** Stores typed text in upper case (ignored for selects). */
  uppercase?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        if (options) {
          const value = String(field.value ?? '');
          const placeholder = `Select ${label.toLowerCase()}`;
          const handleValueChange = onChange
            ? (next: string) => {
                field.onChange(next);
                onChange(next);
              }
            : field.onChange;
          return (
            <WizardFormItem>
              <FormLabel required={required}>{label}</FormLabel>
              {searchable ? (
                <FormControl>
                  <Combobox
                    ref={field.ref}
                    value={value}
                    options={options}
                    placeholder={placeholder}
                    searchPlaceholder={`Search ${label.toLowerCase()}`}
                    disabled={disabled || readOnly}
                    aria-required={required}
                    onValueChange={handleValueChange}
                  />
                </FormControl>
              ) : (
                <WizardSelect
                  value={value}
                  options={options}
                  placeholder={placeholder}
                  disabled={disabled || readOnly}
                  required={required}
                  triggerRef={field.ref}
                  onBlur={field.onBlur}
                  onValueChange={handleValueChange}
                />
              )}
              <FormMessage />
            </WizardFormItem>
          );
        }
        const props = {
          name: field.name,
          ref: field.ref,
          onBlur: field.onBlur,
          disabled,
          readOnly,
          'aria-required': required,
          value:
            type === 'date'
              ? String(field.value ?? '').slice(0, 10)
              : String(field.value ?? ''),
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => {
            const target = event.target;
            if (uppercase) {
              // Rewrite the DOM value in place so React doesn't reset the
              // caret to the end when the controlled value changes case.
              const { selectionStart, selectionEnd } = target;
              target.value = target.value.toUpperCase();
              if (type === 'text' || multiline)
                target.setSelectionRange(selectionStart, selectionEnd);
            }
            field.onChange(target.value);
            onChange?.(target.value);
          },
        };
        return (
          <WizardFormItem>
            <FormLabel required={required}>{label}</FormLabel>
            <FormControl>
              {multiline ? (
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
