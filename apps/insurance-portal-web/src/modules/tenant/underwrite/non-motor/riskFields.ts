import type {
  RiskDataValue,
  RiskFieldDataType,
  RiskFieldDefinition,
} from '../types';

/**
 * Client-side mirror of the backend `validateRiskData` (risk-field.types.ts).
 * The backend remains authoritative; this gives immediate feedback in the
 * wizard. Keep the two in step.
 */

export const RISK_FIELD_TYPE_LABELS: Record<RiskFieldDataType, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Long text',
  NUMBER: 'Number',
  INTEGER: 'Whole number',
  DECIMAL: 'Decimal',
  CURRENCY: 'Amount',
  DATE: 'Date',
  BOOLEAN: 'Yes / No',
  SELECT: 'Single choice',
  MULTI_SELECT: 'Multiple choice',
};

const NUMERIC: RiskFieldDataType[] = [
  'NUMBER',
  'INTEGER',
  'DECIMAL',
  'CURRENCY',
];

export function isBlankRiskValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function riskFieldError(
  field: RiskFieldDefinition,
  value: RiskDataValue | undefined,
  enforceRequired: boolean,
): string | null {
  if (isBlankRiskValue(value)) {
    return enforceRequired && field.is_required
      ? `${field.label} is required`
      : null;
  }
  const rules = field.validation_rules ?? {};

  if (NUMERIC.includes(field.data_type)) {
    const number = typeof value === 'number' ? value : Number(String(value));
    if (!Number.isFinite(number)) return `${field.label} must be a number`;
    if (field.data_type === 'INTEGER' && !Number.isInteger(number)) {
      return `${field.label} must be a whole number`;
    }
    if (rules.min !== undefined && number < rules.min) {
      return `${field.label} must be at least ${rules.min}`;
    }
    if (rules.max !== undefined && number > rules.max) {
      return `${field.label} must be at most ${rules.max}`;
    }
    return null;
  }

  if (field.data_type === 'SELECT') {
    return (field.options ?? []).some((option) => option.value === value)
      ? null
      : `${field.label} has an invalid option`;
  }
  if (field.data_type === 'MULTI_SELECT') {
    const values = Array.isArray(value) ? value : [String(value)];
    const allowed = new Set(
      (field.options ?? []).map((option) => option.value),
    );
    return values.every((item) => allowed.has(item))
      ? null
      : `${field.label} has invalid options`;
  }
  if (field.data_type === 'DATE') {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? null
      : `${field.label} must be a date`;
  }
  if (field.data_type === 'BOOLEAN') return null;

  const text = String(value).trim();
  if (rules.max_length !== undefined && text.length > rules.max_length) {
    return `${field.label} must be at most ${rules.max_length} characters`;
  }
  if (rules.pattern) {
    try {
      if (!new RegExp(rules.pattern).test(text)) {
        return `${field.label} has an invalid format`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function riskDataErrors(
  fields: RiskFieldDefinition[],
  data: Record<string, RiskDataValue>,
  enforceRequired: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = riskFieldError(field, data[field.field_key], enforceRequired);
    if (error) errors[field.field_key] = error;
  }
  return errors;
}

/** Groups fields by section, keeping configured order. */
export function groupRiskFields<T extends RiskFieldDefinition>(
  fields: T[],
): Array<{ section: string; fields: T[] }> {
  const groups = new Map<string, T[]>();
  for (const field of fields) {
    const section = field.section?.trim() || 'Risk details';
    groups.set(section, [...(groups.get(section) ?? []), field]);
  }
  return [...groups.entries()].map(([section, items]) => ({
    section,
    fields: items,
  }));
}

export function formatRiskValue(
  field: RiskFieldDefinition,
  value: RiskDataValue | undefined,
): string {
  if (isBlankRiskValue(value)) return '—';
  const label = (raw: string) =>
    field.options?.find((option) => option.value === raw)?.label ?? raw;
  if (field.data_type === 'BOOLEAN') return value ? 'Yes' : 'No';
  if (field.data_type === 'SELECT') return label(String(value));
  if (field.data_type === 'MULTI_SELECT') {
    return (Array.isArray(value) ? value : [String(value)])
      .map(label)
      .join(', ');
  }
  if (field.data_type === 'CURRENCY' || field.data_type === 'DECIMAL') {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}
