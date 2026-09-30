/**
 * Field types a non-motor risk schema may use. Values are stored in
 * `quotation_non_motor_details.risk_data` keyed by `field_key`.
 */
export const RISK_FIELD_DATA_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'INTEGER',
  'DECIMAL',
  'CURRENCY',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
] as const;

export type RiskFieldDataType = (typeof RISK_FIELD_DATA_TYPES)[number];

export interface RiskFieldOption {
  value: string;
  label: string;
}

export interface RiskFieldValidationRules {
  min?: number;
  max?: number;
  max_length?: number;
  pattern?: string;
}

/** The subset of a field definition that validation needs. */
export interface RiskFieldDefinition {
  field_key: string;
  label: string;
  data_type: RiskFieldDataType;
  is_required: boolean;
  options: RiskFieldOption[] | null;
  validation_rules: RiskFieldValidationRules | null;
}

export type RiskDataValue = string | number | boolean | string[] | null;
export type RiskData = Record<string, RiskDataValue>;

export interface RiskFieldError {
  field_key: string;
  message: string;
}

const NUMERIC_TYPES: RiskFieldDataType[] = [
  'NUMBER',
  'INTEGER',
  'DECIMAL',
  'CURRENCY',
];

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Validates and normalises risk data against a schema.
 *
 * - `enforceRequired: false` is used for drafts: values must be well typed
 *   but may be missing.
 * - `enforceRequired: true` is used at finalize.
 *
 * Keys not in the schema are dropped, so a quotation only ever stores data
 * its product defines.
 */
export function validateRiskData(
  fields: RiskFieldDefinition[],
  input: Record<string, unknown> | null | undefined,
  { enforceRequired }: { enforceRequired: boolean },
): { data: RiskData; errors: RiskFieldError[] } {
  const data: RiskData = {};
  const errors: RiskFieldError[] = [];
  const source = input ?? {};

  for (const field of fields) {
    const raw = source[field.field_key];
    const fail = (message: string) =>
      errors.push({ field_key: field.field_key, message });

    if (isBlank(raw)) {
      if (enforceRequired && field.is_required) {
        fail(`${field.label} is required`);
      }
      continue;
    }

    const rules = field.validation_rules ?? {};

    if (NUMERIC_TYPES.includes(field.data_type)) {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) {
        fail(`${field.label} must be a number`);
        continue;
      }
      if (field.data_type === 'INTEGER' && !Number.isInteger(value)) {
        fail(`${field.label} must be a whole number`);
        continue;
      }
      if (rules.min !== undefined && value < rules.min) {
        fail(`${field.label} must be at least ${rules.min}`);
        continue;
      }
      if (rules.max !== undefined && value > rules.max) {
        fail(`${field.label} must be at most ${rules.max}`);
        continue;
      }
      data[field.field_key] = value;
      continue;
    }

    switch (field.data_type) {
      case 'BOOLEAN': {
        if (typeof raw === 'boolean') {
          data[field.field_key] = raw;
        } else if (raw === 'true' || raw === 'false') {
          data[field.field_key] = raw === 'true';
        } else {
          fail(`${field.label} must be yes or no`);
        }
        break;
      }
      case 'DATE': {
        const text = String(raw).trim();
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
          Number.isNaN(Date.parse(text))
        ) {
          fail(`${field.label} must be a date (YYYY-MM-DD)`);
        } else {
          data[field.field_key] = text;
        }
        break;
      }
      case 'SELECT': {
        const text = String(raw);
        const allowed = (field.options ?? []).map((option) => option.value);
        if (!allowed.includes(text)) {
          fail(`${field.label} has an invalid option`);
        } else {
          data[field.field_key] = text;
        }
        break;
      }
      case 'MULTI_SELECT': {
        const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const allowed = (field.options ?? []).map((option) => option.value);
        const invalid = values.filter((value) => !allowed.includes(value));
        if (invalid.length) {
          fail(`${field.label} has invalid options`);
        } else {
          data[field.field_key] = [...new Set(values)];
        }
        break;
      }
      default: {
        const text = String(raw).trim();
        if (rules.max_length !== undefined && text.length > rules.max_length) {
          fail(`${field.label} must be at most ${rules.max_length} characters`);
          break;
        }
        if (rules.pattern) {
          let pattern: RegExp | null = null;
          try {
            pattern = new RegExp(rules.pattern);
          } catch {
            pattern = null; // A broken admin pattern must not block capture.
          }
          if (pattern && !pattern.test(text)) {
            fail(`${field.label} has an invalid format`);
            break;
          }
        }
        data[field.field_key] = text;
      }
    }
  }

  return { data, errors };
}
