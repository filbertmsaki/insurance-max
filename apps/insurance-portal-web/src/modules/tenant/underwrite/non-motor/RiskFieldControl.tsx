import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { RiskDataValue, RiskFieldDefinition } from '../types';

interface RiskFieldControlProps {
  field: RiskFieldDefinition;
  value: RiskDataValue | undefined;
  error?: string | null;
  disabled?: boolean;
  onChange: (value: RiskDataValue) => void;
}

/** One configured risk field, rendered by its data type. */
export function RiskFieldControl({
  field,
  value,
  error,
  disabled,
  onChange,
}: RiskFieldControlProps) {
  const id = `risk-field-${field.field_key}`;
  const describedBy = error
    ? `${id}-error`
    : field.help_text
      ? `${id}-help`
      : undefined;
  const wide =
    field.data_type === 'TEXTAREA' || field.data_type === 'MULTI_SELECT';

  const control = (() => {
    switch (field.data_type) {
      case 'TEXTAREA':
        return (
          <Textarea
            id={id}
            value={value == null ? '' : String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      case 'NUMBER':
      case 'INTEGER':
      case 'DECIMAL':
      case 'CURRENCY':
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step={field.data_type === 'INTEGER' ? 1 : 'any'}
            min={field.validation_rules?.min}
            max={field.validation_rules?.max}
            value={value == null ? '' : String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : event.target.value)
            }
          />
        );
      case 'DATE':
        return (
          <Input
            id={id}
            type="date"
            value={value == null ? '' : String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value || null)}
          />
        );
      case 'BOOLEAN':
        return (
          <div className="flex h-9 items-center gap-2">
            <Switch
              id={id}
              checked={value === true}
              disabled={disabled}
              aria-describedby={describedBy}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <span className="text-sm text-slate-600">
              {value === true ? 'Yes' : value === false ? 'No' : 'Not answered'}
            </span>
          </div>
        );
      case 'SELECT':
        return (
          <Select
            value={value == null ? '' : String(value)}
            disabled={disabled}
            onValueChange={(next) => onChange(next)}
          >
            <SelectTrigger
              id={id}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
            >
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'MULTI_SELECT': {
        const selected = new Set(Array.isArray(value) ? value : []);
        return (
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {(field.options ?? []).map((option) => {
              const optionId = `${id}-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={optionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={optionId}
                    checked={selected.has(option.value)}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(option.value);
                      else next.delete(option.value);
                      onChange([...next]);
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        );
      }
      default:
        return (
          <Input
            id={id}
            value={value == null ? '' : String(value)}
            maxLength={field.validation_rules?.max_length}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          />
        );
    }
  })();

  return (
    <div className={cn('space-y-1.5', wide && 'sm:col-span-2 lg:col-span-3')}>
      <Label
        id={`${id}-label`}
        htmlFor={field.data_type === 'MULTI_SELECT' ? undefined : id}
        required={field.is_required}
      >
        {field.label}
      </Label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : field.help_text ? (
        <p id={`${id}-help`} className="text-xs text-slate-500">
          {field.help_text}
        </p>
      ) : null}
    </div>
  );
}
