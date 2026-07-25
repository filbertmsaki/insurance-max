import { z } from 'zod';
import {
  getCustomerFullName,
  getCustomerIdFieldName,
  splitCustomerFullName,
  type CustomerFormValues,
  type CustomerIdType,
  type CustomerPayload,
  type CustomerRecord,
} from './types';

const optionalText = z.string().trim().max(255).optional().or(z.literal(''));

/**
 * The customer field shape without the customer_type-conditional refinement.
 * Exported separately so other forms (e.g. the quotation wizard's inline
 * "create new policyholder" step) can nest it as a sub-object and decide for
 * themselves when the full `customerFormSchema` validation should apply,
 * without unconditionally forcing every required-customer-field check to run.
 */
export const customerFormObjectSchema = z.object({
  customer_type: z.enum(['INDIVIDUAL', 'CORPORATE']),
  customer_no: z.string().optional().or(z.literal('')),
  full_name: z.string().trim().max(150).optional().or(z.literal('')),
  first_name: z.string().trim().max(50).optional().or(z.literal('')),
  middle_name: z.string().trim().max(50).optional().or(z.literal('')),
  last_name: z.string().trim().max(50).optional().or(z.literal('')),
  gender: z.enum(['M', 'F']).optional().or(z.literal('')),
  date_of_birth: z.string().optional().or(z.literal('')),
  nationality: optionalText,
  company_name: z.string().trim().max(150).optional().or(z.literal('')),
  registration_no: optionalText,
  incorporation_certificate_no: optionalText,
  tin: optionalText,
  vrn: optionalText,
  id_type: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
    ])
    .optional()
    .or(z.literal('')),
  id_number: z.string().trim().max(50).optional().or(z.literal('')),
  nida_no: optionalText,
  voter_no: optionalText,
  passport_no: optionalText,
  driving_license_no: optionalText,
  zanid_no: optionalText,
  phone: z.string().trim().max(30),
  alternate_phone: optionalText,
  fax: optionalText,
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  country: optionalText,
  country_code: z
    .string()
    .trim()
    .length(3, 'Country code must be 3 letters')
    .optional()
    .or(z.literal('')),
  region: z.string().trim().max(50).optional().or(z.literal('')),
  district: z.string().trim().max(50).optional().or(z.literal('')),
  ward: optionalText,
  street: optionalText,
  postal_address: optionalText,
  contact_name: optionalText,
  contact_role: optionalText,
  contact_phone: optionalText,
  contact_email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('')),
  kyc_status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  document_type: z
    .union([
      z.literal('NIDA'),
      z.literal('VOTER_ID'),
      z.literal('PASSPORT'),
      z.literal('DRIVING_LICENSE'),
      z.literal('ZANID'),
      z.literal('TIN_CERTIFICATE'),
      z.literal('VRN_CERTIFICATE'),
      z.literal('BUSINESS_REGISTRATION'),
      z.literal('INCORPORATION_CERTIFICATE'),
      z.literal('OTHER'),
    ])
    .optional()
    .or(z.literal('')),
  document_no: optionalText,
  document_file_name: optionalText,
  document_file_url: optionalText,
  document_mime_type: optionalText,
  document_verified: z.boolean(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']),
});

export const customerFormSchema = customerFormObjectSchema.superRefine(
  (values, ctx) => {
    const text = (value?: string | null) => (value ?? '').trim();
    const fullName = text(values.full_name);
    const nameParts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
    const isIndividual = values.customer_type === 'INDIVIDUAL';
    const isCorporate = values.customer_type === 'CORPORATE';
    const today = new Date().toISOString().slice(0, 10);
    const idField = getCustomerIdFieldName(
      values.customer_type,
      values.id_type as CustomerIdType | '',
    );
    const idSpecificValue = idField
      ? text((values as unknown as Record<string, string | undefined>)[idField])
      : '';
    const resolvedIdNumber = text(values.id_number) || idSpecificValue;

    if (values.id_type && !idField) {
      ctx.addIssue({
        code: 'custom',
        path: ['id_type'],
        message:
          'Select a valid identification type for this policyholder type',
      });
    }

    if (isIndividual) {
      if (!fullName && !text(values.first_name) && !text(values.last_name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['full_name'],
          message: 'Full name is required',
        });
      }
      if (fullName && nameParts.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['full_name'],
          message: 'Enter at least first and last name',
        });
      }
      if (!values.gender)
        ctx.addIssue({
          code: 'custom',
          path: ['gender'],
          message: 'Gender is required',
        });
      if (!values.date_of_birth)
        ctx.addIssue({
          code: 'custom',
          path: ['date_of_birth'],
          message: 'Date of birth is required',
        });
      if (values.date_of_birth && values.date_of_birth > today) {
        ctx.addIssue({
          code: 'custom',
          path: ['date_of_birth'],
          message: 'Date of birth cannot be in the future',
        });
      }
      if (!values.id_type)
        ctx.addIssue({
          code: 'custom',
          path: ['id_type'],
          message: 'ID type is required',
        });
      if (!resolvedIdNumber)
        ctx.addIssue({
          code: 'custom',
          path: ['id_number'],
          message: 'ID number is required',
        });
      if (!text(values.phone))
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Phone is required',
        });
      if (!text(values.country_code))
        ctx.addIssue({
          code: 'custom',
          path: ['country_code'],
          message: 'Country code is required',
        });
      if (!text(values.region))
        ctx.addIssue({
          code: 'custom',
          path: ['region'],
          message: 'Region is required',
        });
      if (!text(values.district))
        ctx.addIssue({
          code: 'custom',
          path: ['district'],
          message: 'District is required',
        });
    }

    if (isCorporate) {
      if (!fullName && !text(values.company_name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['full_name'],
          message: 'Full name is required',
        });
      }
      if (!values.id_type)
        ctx.addIssue({
          code: 'custom',
          path: ['id_type'],
          message: 'ID type is required',
        });
      if (!resolvedIdNumber)
        ctx.addIssue({
          code: 'custom',
          path: ['id_number'],
          message: 'ID number is required',
        });
      if (!values.date_of_birth) {
        ctx.addIssue({
          code: 'custom',
          path: ['date_of_birth'],
          message: 'Date of birth / incorporation date is required',
        });
      }
      if (values.date_of_birth && values.date_of_birth > today) {
        ctx.addIssue({
          code: 'custom',
          path: ['date_of_birth'],
          message: 'Date of birth / incorporation date cannot be in the future',
        });
      }
      if (!text(values.phone))
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Phone is required',
        });
      if (!text(values.country_code))
        ctx.addIssue({
          code: 'custom',
          path: ['country_code'],
          message: 'Country code is required',
        });
      if (!text(values.region))
        ctx.addIssue({
          code: 'custom',
          path: ['region'],
          message: 'Region is required',
        });
      if (!text(values.district))
        ctx.addIssue({
          code: 'custom',
          path: ['district'],
          message: 'District is required',
        });
    }
  },
);

export function getCustomerDefaultValues(
  customer?: Partial<CustomerRecord> | null,
): CustomerFormValues {
  return {
    customer_type: customer?.customer_type ?? 'INDIVIDUAL',
    customer_no: customer?.customer_no ?? '',
    full_name: getCustomerFullName(customer ?? null),
    first_name: customer?.first_name ?? '',
    middle_name: customer?.middle_name ?? '',
    last_name: customer?.last_name ?? '',
    gender: customer?.gender ?? '',
    date_of_birth: customer?.date_of_birth ?? '',
    nationality: customer?.nationality ?? '',
    company_name: customer?.company_name ?? '',
    registration_no: customer?.registration_no ?? '',
    incorporation_certificate_no: customer?.incorporation_certificate_no ?? '',
    tin: customer?.tin ?? '',
    vrn: customer?.vrn ?? '',
    id_type: customer?.id_type ?? '',
    id_number: customer?.id_number ?? '',
    nida_no: customer?.nida_no ?? '',
    voter_no: customer?.voter_no ?? '',
    passport_no: customer?.passport_no ?? '',
    driving_license_no: customer?.driving_license_no ?? '',
    zanid_no: customer?.zanid_no ?? '',
    phone: customer?.phone ?? '',
    alternate_phone: customer?.alternate_phone ?? '',
    fax: customer?.fax ?? '',
    email: customer?.email ?? '',
    country: customer?.country ?? '',
    country_code: customer?.country_code ?? 'TZA',
    region: customer?.region ?? '',
    district: customer?.district ?? '',
    ward: customer?.ward ?? '',
    street: customer?.street ?? '',
    postal_address: customer?.postal_address ?? '',
    contact_name: customer?.contact_name ?? '',
    contact_role: customer?.contact_role ?? '',
    contact_phone: customer?.contact_phone ?? '',
    contact_email: customer?.contact_email ?? '',
    kyc_status: customer?.kyc_status ?? 'PENDING',
    document_type: customer?.document_type ?? '',
    document_no: customer?.document_no ?? '',
    document_file_name: customer?.document_file_name ?? '',
    document_file_url: customer?.document_file_url ?? '',
    document_mime_type: customer?.document_mime_type ?? '',
    document_verified: customer?.document_verified ?? false,
    status: customer?.status ?? 'ACTIVE',
  };
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function buildCustomerPayload(
  values: CustomerFormValues,
): CustomerPayload {
  const fullName = normalizeText(values.full_name) ?? '';
  const derivedNames = fullName ? splitCustomerFullName(fullName) : null;
  const idType = values.id_type || 1;
  const idField = getCustomerIdFieldName(values.customer_type, idType);
  const formValues = values as unknown as Record<string, string>;
  const idNumber =
    normalizeText(values.id_number) ??
    (idField ? normalizeText(formValues[idField] ?? '') : undefined) ??
    '';
  const specificValue = idField
    ? (normalizeText(formValues[idField] ?? '') ?? idNumber)
    : undefined;

  const payload = {
    customer_type: values.customer_type,
    id_type: idType,
    id_number: idNumber,
    phone: normalizeText(values.phone) ?? values.phone,
    country_code: (normalizeText(values.country_code) ?? 'TZA').toUpperCase(),
    region: normalizeText(values.region) ?? values.region,
    district: normalizeText(values.district) ?? values.district,
    document_verified: values.document_verified,
    status: values.status,
  } as CustomerPayload &
    Record<string, string | number | boolean | null | undefined>;

  if (values.customer_type === 'INDIVIDUAL') {
    const firstName =
      normalizeText(values.first_name) ?? derivedNames?.first_name;
    const middleName =
      normalizeText(values.middle_name) ?? derivedNames?.middle_name;
    const lastName = normalizeText(values.last_name) ?? derivedNames?.last_name;

    if (firstName) payload.first_name = firstName;
    if (middleName) payload.middle_name = middleName;
    if (lastName) payload.last_name = lastName;
  }

  if (values.gender) payload.gender = values.gender;
  if (values.date_of_birth) payload.date_of_birth = values.date_of_birth;
  if (normalizeText(values.nationality))
    payload.nationality = normalizeText(values.nationality);
  if (values.customer_type === 'CORPORATE') {
    const companyName = normalizeText(values.company_name) ?? fullName;
    if (companyName) payload.company_name = companyName;
  }
  if (normalizeText(values.registration_no))
    payload.registration_no = normalizeText(values.registration_no);
  if (normalizeText(values.incorporation_certificate_no))
    payload.incorporation_certificate_no = normalizeText(
      values.incorporation_certificate_no,
    );
  if (normalizeText(values.tin)) payload.tin = normalizeText(values.tin);
  if (normalizeText(values.vrn)) payload.vrn = normalizeText(values.vrn);
  if (specificValue && idField) {
    payload[idField] = specificValue;
    if (idField !== 'tin' && values.customer_type === 'CORPORATE') {
      payload.tin = payload.tin ?? specificValue;
    }
  }
  if (normalizeText(values.alternate_phone))
    payload.alternate_phone = normalizeText(values.alternate_phone);
  if (normalizeText(values.fax)) payload.fax = normalizeText(values.fax);
  if (normalizeText(values.email)) payload.email = normalizeText(values.email);
  if (normalizeText(values.country))
    payload.country = normalizeText(values.country);
  if (normalizeText(values.ward)) payload.ward = normalizeText(values.ward);
  if (normalizeText(values.street))
    payload.street = normalizeText(values.street);
  if (normalizeText(values.postal_address))
    payload.postal_address = normalizeText(values.postal_address);
  if (normalizeText(values.contact_name))
    payload.contact_name = normalizeText(values.contact_name);
  if (normalizeText(values.contact_role))
    payload.contact_role = normalizeText(values.contact_role);
  if (normalizeText(values.contact_phone))
    payload.contact_phone = normalizeText(values.contact_phone);
  if (normalizeText(values.contact_email))
    payload.contact_email = normalizeText(values.contact_email);
  if (values.kyc_status) payload.kyc_status = values.kyc_status;
  if (values.document_type) payload.document_type = values.document_type;
  if (normalizeText(values.document_no))
    payload.document_no = normalizeText(values.document_no);
  if (normalizeText(values.document_file_name))
    payload.document_file_name = normalizeText(values.document_file_name);
  if (normalizeText(values.document_file_url))
    payload.document_file_url = normalizeText(values.document_file_url);
  if (normalizeText(values.document_mime_type))
    payload.document_mime_type = normalizeText(values.document_mime_type);

  payload.policy_holder_type = values.customer_type === 'INDIVIDUAL' ? 1 : 2;

  return payload;
}
