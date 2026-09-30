import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type {
  ProductRiskField,
  RiskFieldDataType,
  RiskFieldInput,
  RiskFieldOption,
} from '../types';
import { RISK_FIELD_TYPE_LABELS } from './riskFields';

export interface RiskFieldFormValues extends RiskFieldInput {
  field_key: string;
}

const OPTION_TYPES: RiskFieldDataType[] = ['SELECT', 'MULTI_SELECT'];
const NUMERIC_TYPES: RiskFieldDataType[] = [
  'NUMBER',
  'INTEGER',
  'DECIMAL',
  'CURRENCY',
];
const TEXT_TYPES: RiskFieldDataType[] = ['TEXT', 'TEXTAREA'];

function toKey(label: string) {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'f_$1');
  return key.slice(0, 80);
}

/** One option per line: `value | label` (label defaults to value). */
function parseOptions(text: string): RiskFieldOption[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split('|');
      const label = rest.join('|').trim();
      return { value: value.trim(), label: label || value.trim() };
    });
}

function formatOptions(options: RiskFieldOption[] | null): string {
  return (options ?? [])
    .map((option) =>
      option.label === option.value
        ? option.value
        : `${option.value} | ${option.label}`,
    )
    .join('\n');
}

const numberOrUndefined = (value: string) =>
  value.trim() === '' ? undefined : Number(value);

export function RiskFieldDialog({
  open,
  field,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  /** Null creates a new field. */
  field: ProductRiskField | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RiskFieldFormValues) => void;
}) {
  const [label, setLabel] = useState(field?.label ?? '');
  const [fieldKey, setFieldKey] = useState(field?.field_key ?? '');
  const [keyTouched, setKeyTouched] = useState(Boolean(field));
  const [dataType, setDataType] = useState<RiskFieldDataType>(
    field?.data_type ?? 'TEXT',
  );
  const [section, setSection] = useState(field?.section ?? '');
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [isActive, setIsActive] = useState(field?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(field?.sort_order ?? 0));
  const [helpText, setHelpText] = useState(field?.help_text ?? '');
  const [optionsText, setOptionsText] = useState(
    formatOptions(field?.options ?? null),
  );
  const rules = field?.validation_rules ?? {};
  const [min, setMin] = useState(rules.min?.toString() ?? '');
  const [max, setMax] = useState(rules.max?.toString() ?? '');
  const [maxLength, setMaxLength] = useState(
    rules.max_length?.toString() ?? '',
  );
  const [pattern, setPattern] = useState(rules.pattern ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const key = fieldKey.trim();
    if (!label.trim()) return setError('Label is required');
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return setError('Key must be lower_snake_case and start with a letter');
    }
    const options = OPTION_TYPES.includes(dataType)
      ? parseOptions(optionsText)
      : null;
    if (options && options.length === 0) {
      return setError('Add at least one option');
    }
    if (
      options &&
      new Set(options.map((o) => o.value)).size !== options.length
    ) {
      return setError('Option values must be unique');
    }
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        return setError('Pattern is not a valid regular expression');
      }
    }

    const validation_rules = {
      ...(NUMERIC_TYPES.includes(dataType)
        ? { min: numberOrUndefined(min), max: numberOrUndefined(max) }
        : {}),
      ...(TEXT_TYPES.includes(dataType)
        ? {
            max_length: numberOrUndefined(maxLength),
            pattern: pattern.trim() || undefined,
          }
        : {}),
    };
    const hasRules = Object.values(validation_rules).some(
      (value) => value !== undefined,
    );

    setError(null);
    onSubmit({
      field_key: key,
      label: label.trim(),
      data_type: dataType,
      section: section.trim() || null,
      is_required: isRequired,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
      help_text: helpText.trim() || null,
      options,
      validation_rules: hasRules ? validation_rules : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {field ? 'Edit risk field' : 'Add risk field'}
          </DialogTitle>
          <DialogDescription>
            Shown on the Risk Details step of the Non-Motor wizard for this
            product.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="risk-field-label" required>
              Label
            </Label>
            <Input
              id="risk-field-label"
              value={label}
              maxLength={150}
              onChange={(event) => {
                setLabel(event.target.value);
                if (!keyTouched) setFieldKey(toKey(event.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-field-key" required>
              Key
            </Label>
            <Input
              id="risk-field-key"
              value={fieldKey}
              disabled={Boolean(field)}
              maxLength={80}
              onChange={(event) => {
                setKeyTouched(true);
                setFieldKey(event.target.value);
              }}
            />
            <p className="text-xs text-slate-500">
              {field
                ? 'Keys cannot change once created.'
                : 'Used to store the value; lower_snake_case.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-field-type" required>
              Type
            </Label>
            <Select
              value={dataType}
              onValueChange={(value) => setDataType(value as RiskFieldDataType)}
            >
              <SelectTrigger id="risk-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(RISK_FIELD_TYPE_LABELS) as RiskFieldDataType[]
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {RISK_FIELD_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-field-section">Section</Label>
            <Input
              id="risk-field-section"
              value={section}
              placeholder="Risk details"
              maxLength={80}
              onChange={(event) => setSection(event.target.value)}
            />
          </div>

          {OPTION_TYPES.includes(dataType) && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="risk-field-options" required>
                Options
              </Label>
              <Textarea
                id="risk-field-options"
                rows={5}
                value={optionsText}
                placeholder={'CONCRETE | Concrete\nTIMBER | Timber'}
                onChange={(event) => setOptionsText(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                One per line, as <code>value | label</code>.
              </p>
            </div>
          )}

          {NUMERIC_TYPES.includes(dataType) && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="risk-field-min">Minimum</Label>
                <Input
                  id="risk-field-min"
                  type="number"
                  value={min}
                  onChange={(event) => setMin(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-field-max">Maximum</Label>
                <Input
                  id="risk-field-max"
                  type="number"
                  value={max}
                  onChange={(event) => setMax(event.target.value)}
                />
              </div>
            </>
          )}

          {TEXT_TYPES.includes(dataType) && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="risk-field-max-length">Maximum length</Label>
                <Input
                  id="risk-field-max-length"
                  type="number"
                  min={1}
                  value={maxLength}
                  onChange={(event) => setMaxLength(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-field-pattern">Format (regex)</Label>
                <Input
                  id="risk-field-pattern"
                  value={pattern}
                  maxLength={200}
                  onChange={(event) => setPattern(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="risk-field-help">Help text</Label>
            <Input
              id="risk-field-help"
              value={helpText}
              maxLength={255}
              onChange={(event) => setHelpText(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-field-order">Display order</Label>
            <Input
              id="risk-field-order"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              Active
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : field ? 'Save field' : 'Add field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
