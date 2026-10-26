import { z } from 'zod';
import {
  getCustomerFullName,
  getPolicyHolderType,
  POLICY_HOLDER_FIELD_MAX_LENGTH as MAX,
  type CustomerFormValues,
  type CustomerIdType,
  type CustomerPayload,
  type CustomerRecord,
} from './types';

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((value) => value ?? '');

/**
 * The policyholder field shape without the type-conditional refinement.
 * Exported separately so other forms (e.g. the quotation wizard's inline
 * "create new policyholder" step) can nest it as a sub-object and decide for
 * themselves when the full `customerFormSchema` validation should apply.
 */
export const customerFormObjectSchema = z.object({
  policy_holder_name: z.string().trim(),
  policy_holder_birth_date: z.string(),
  policy_holder_type: z.union([z.literal(1), z.literal(2)]),
  policy_holder_id_number: z.string().trim(),
  policy_holder_id_type: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(''),
  ]),
  gender: z.enum(['M', 'F']).or(z.literal('')),
  country_code: z.string().trim(),
  region: z.string().trim(),
  district: z.string().trim(),
  street: z.string().trim(),
  policy_holder_phone_number: z.string().trim(),
  policy_holder_fax: optionalText(MAX.policy_holder_fax, 'Fax'),
  postal_address: optionalText(MAX.postal_address, 'Postal address'),
  email_address: z
    .string()
    .trim()
    .max(
      MAX.email_address,
      `Email must be at most ${MAX.email_address} characters`,
    )
    .email('Invalid email')
    .or(z.literal(''))
    .optional()
    .transform((value) => value ?? ''),
});

const requiredFields = z.object({
  policy_holder_name: requiredText(MAX.policy_holder_name, 'Name'),
  policy_holder_id_number: requiredText(
    MAX.policy_holder_id_number,
    'ID number',
  ),
  region: requiredText(MAX.region, 'Region'),
  district: requiredText(MAX.district, 'District'),
  street: requiredText(MAX.street, 'Street'),
  policy_holder_phone_number: requiredText(
    MAX.policy_holder_phone_number,
    'Phone number',
  ),
});

export const customerFormSchema = customerFormObjectSchema.superRefine(
  (values, ctx) => {
    const required = requiredFields.safeParse(values);
    if (!required.success) {
      for (const issue of required.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
      }
    }

    const isIndividual = values.policy_holder_type === 1;
    const dateLabel = isIndividual ? 'Date of birth' : 'Incorporation date';
    const today = new Date().toISOString().slice(0, 10);
    const birthDate = values.policy_holder_birth_date;

    if (!birthDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['policy_holder_birth_date'],
        message: `${dateLabel} is required`,
      });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['policy_holder_birth_date'],
        message: 'Use the YYYY-MM-DD format',
      });
    } else if (birthDate > today) {
      ctx.addIssue({
        code: 'custom',
        path: ['policy_holder_birth_date'],
        message: `${dateLabel} cannot be in the future`,
      });
    }

    if (!values.policy_holder_id_type) {
      ctx.addIssue({
        code: 'custom',
        path: ['policy_holder_id_type'],
        message: 'ID type is required',
      });
    }

    if (isIndividual && !values.gender) {
      ctx.addIssue({
        code: 'custom',
        path: ['gender'],
        message: 'Gender is required',
      });
    }

    if (!/^[A-Za-z]{3}$/.test(values.country_code)) {
      ctx.addIssue({
        code: 'custom',
        path: ['country_code'],
        message: 'Country code must be a 3-letter ISO code',
      });
    }
  },
);

export function getCustomerDefaultValues(
  customer?: Partial<CustomerRecord> | null,
): CustomerFormValues {
  return {
    policy_holder_name: customer
      ? getCustomerFullName(customer) || (customer.display_name ?? '')
      : '',
    policy_holder_birth_date: customer?.date_of_birth ?? '',
    policy_holder_type: customer ? getPolicyHolderType(customer) : 1,
    policy_holder_id_number: customer?.id_number ?? '',
    policy_holder_id_type: (customer?.id_type ?? '') as CustomerIdType | '',
    gender: customer?.gender ?? '',
    country_code: customer?.country_code ?? 'TZA',
    region: customer?.region ?? '',
    district: customer?.district ?? '',
    street: customer?.street ?? '',
    policy_holder_phone_number: customer?.phone ?? '',
    policy_holder_fax: customer?.fax ?? '',
    postal_address: customer?.postal_address ?? '',
    email_address: customer?.email ?? '',
  };
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function buildCustomerPayload(
  values: CustomerFormValues,
): CustomerPayload {
  return {
    policy_holder_name: values.policy_holder_name.trim(),
    policy_holder_birth_date: values.policy_holder_birth_date,
    policy_holder_type: values.policy_holder_type,
    policy_holder_id_number: values.policy_holder_id_number.trim(),
    policy_holder_id_type: values.policy_holder_id_type as CustomerIdType,
    gender: values.gender || null,
    country_code: values.country_code.trim().toUpperCase(),
    region: values.region.trim(),
    district: values.district.trim(),
    street: values.street.trim(),
    policy_holder_phone_number: values.policy_holder_phone_number.trim(),
    policy_holder_fax: optional(values.policy_holder_fax),
    postal_address: optional(values.postal_address),
    email_address: optional(values.email_address),
  };
}

/**
 * Quotation drafts saved before the policyholder-only form stored the old
 * customer form shape (customer_type, full_name, phone, ...). Converts such a
 * snapshot to the current fields; current-shape values pass through.
 */
export function normalizePolicyholderFormValues(
  value: unknown,
): CustomerFormValues {
  const defaults = getCustomerDefaultValues();
  if (!value || typeof value !== 'object') return defaults;

  const source = value as Record<string, unknown>;
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = source[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    return '';
  };
  const legacyName = [source.first_name, source.middle_name, source.last_name]
    .filter((part): part is string => typeof part === 'string' && !!part.trim())
    .join(' ');
  const policyHolderType =
    source.policy_holder_type === 2 || source.customer_type === 'CORPORATE'
      ? 2
      : 1;
  const idType = Number(source.policy_holder_id_type ?? source.id_type);
  const gender =
    source.gender === 'M' || source.gender === 'F' ? source.gender : '';

  return {
    policy_holder_name:
      text('policy_holder_name', 'full_name', 'company_name') || legacyName,
    policy_holder_birth_date: text('policy_holder_birth_date', 'date_of_birth'),
    policy_holder_type: policyHolderType,
    policy_holder_id_number: text('policy_holder_id_number', 'id_number'),
    policy_holder_id_type:
      idType >= 1 && idType <= 7 ? (idType as CustomerIdType) : '',
    gender,
    country_code: text('country_code') || defaults.country_code,
    region: text('region'),
    district: text('district'),
    street: text('street'),
    policy_holder_phone_number: text('policy_holder_phone_number', 'phone'),
    policy_holder_fax: text('policy_holder_fax', 'fax'),
    postal_address: text('postal_address'),
    email_address: text('email_address', 'email'),
  };
}
