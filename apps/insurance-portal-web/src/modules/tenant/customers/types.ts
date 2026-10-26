import type { SortOrder } from '@/types';

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE';
export type CustomerGender = 'M' | 'F';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | 'MERGED';
export type CustomerDocumentType =
  | 'NIDA'
  | 'VOTER_ID'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'ZANID'
  | 'TIN_CERTIFICATE'
  | 'VRN_CERTIFICATE'
  | 'BUSINESS_REGISTRATION'
  | 'INCORPORATION_CERTIFICATE'
  | 'OTHER';

/** TIRA PolicyHolderIdType. */
export type CustomerIdType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** TIRA PolicyHolderType: 1 = Individual, 2 = Corporate. */
export type CustomerPolicyHolderType = 1 | 2;

export interface CustomerRecord {
  id: string;
  company_id: string;
  customer_no: string;
  display_name: string | null;
  customer_type: CustomerType;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  gender: CustomerGender | null;
  date_of_birth: string | null;
  nationality: string | null;
  company_name: string | null;
  registration_no: string | null;
  incorporation_certificate_no: string | null;
  tin: string | null;
  vrn: string | null;
  policy_holder_type: number | null;
  id_type: CustomerIdType | null;
  id_number: string | null;
  nida_no: string | null;
  voter_no: string | null;
  passport_no: string | null;
  driving_license_no: string | null;
  zanid_no: string | null;
  phone: string;
  alternate_phone: string | null;
  fax: string | null;
  email: string | null;
  country: string | null;
  country_code: string;
  region: string;
  district: string;
  ward: string | null;
  street: string | null;
  postal_address: string | null;
  latitude: string | null;
  longitude: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  document_type: CustomerDocumentType | null;
  document_no: string | null;
  document_file_name: string | null;
  document_file_url: string | null;
  document_mime_type: string | null;
  document_verified: boolean;
  document_verified_by: string | null;
  document_verified_at: string | null;
  status: CustomerStatus;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerVersionRecord {
  id: string | null;
  company_id: string;
  customer_id: string;
  version_number: number;
  is_current_version: boolean;
  customer_snapshot: Record<string, unknown>;
  customer_snapshot_hash: string;
  created_by: string | null;
  created_at: string;
}

export interface CustomerAuditLogRecord {
  id: string;
  company_id: string;
  customer_id: string;
  customer_version_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  fields_changed: string[] | null;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  source: string;
  related_record_type: string | null;
  related_record_id: string | null;
  created_at: string;
}

/** Summary row from `GET /tenant/customers/search` (ID number masked). */
export interface CustomerSearchResult {
  id: string;
  customer_no: string;
  customer_type: CustomerType;
  policy_holder_type: number | null;
  name: string;
  phone: string | null;
  id_type: CustomerIdType | null;
  id_number_masked: string | null;
  status: CustomerStatus;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  customer_type?: CustomerType;
  status?: CustomerStatus;
  sortBy?:
    | 'customer_no'
    | 'first_name'
    | 'last_name'
    | 'company_name'
    | 'status'
    | 'customer_type'
    | 'created_at'
    | 'updated_at';
  sortOrder?: SortOrder;
}

/**
 * Customer form and API payload. Field-for-field the TIRA `PolicyHolder`
 * element (snake_case); these are the only customer fields the API accepts.
 */
export interface CustomerFormValues {
  policy_holder_name: string;
  policy_holder_birth_date: string;
  policy_holder_type: CustomerPolicyHolderType;
  policy_holder_id_number: string;
  policy_holder_id_type: CustomerIdType | '';
  gender: CustomerGender | '';
  country_code: string;
  region: string;
  district: string;
  street: string;
  policy_holder_phone_number: string;
  policy_holder_fax: string;
  postal_address: string;
  email_address: string;
}

export interface CustomerPayload {
  policy_holder_name: string;
  policy_holder_birth_date: string;
  policy_holder_type: CustomerPolicyHolderType;
  policy_holder_id_number: string;
  policy_holder_id_type: CustomerIdType;
  gender: CustomerGender | null;
  country_code: string;
  region: string;
  district: string;
  street: string;
  policy_holder_phone_number: string;
  policy_holder_fax: string | null;
  postal_address: string | null;
  email_address: string | null;
  duplicate_override_reason?: string | null;
}

/** Maximum lengths from the TIRA PolicyHolder specification. */
export const POLICY_HOLDER_FIELD_MAX_LENGTH = {
  policy_holder_name: 100,
  policy_holder_id_number: 50,
  region: 50,
  district: 50,
  street: 50,
  policy_holder_phone_number: 50,
  policy_holder_fax: 50,
  postal_address: 50,
  email_address: 100,
} as const;

export const POLICY_HOLDER_TYPE_OPTIONS: {
  value: CustomerPolicyHolderType;
  label: string;
}[] = [
  { value: 1, label: 'Individual' },
  { value: 2, label: 'Corporate' },
];

export function getPolicyHolderType(
  customer: Partial<
    Pick<CustomerRecord, 'policy_holder_type' | 'customer_type'>
  >,
): CustomerPolicyHolderType {
  if (customer.policy_holder_type === 1 || customer.policy_holder_type === 2) {
    return customer.policy_holder_type;
  }
  return customer.customer_type === 'CORPORATE' ? 2 : 1;
}

export const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'CORPORATE', label: 'Corporate' },
];

export const CUSTOMER_GENDER_OPTIONS: {
  value: CustomerGender;
  label: string;
}[] = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
];

export const CUSTOMER_STATUS_OPTIONS: {
  value: CustomerStatus;
  label: string;
}[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'BLACKLISTED', label: 'Blacklisted' },
  { value: 'MERGED', label: 'Merged' },
];

export const CUSTOMER_DOCUMENT_TYPE_OPTIONS: {
  value: CustomerDocumentType;
  label: string;
}[] = [
  { value: 'NIDA', label: 'NIDA' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'ZANID', label: 'ZANID' },
  { value: 'TIN_CERTIFICATE', label: 'TIN Certificate' },
  { value: 'VRN_CERTIFICATE', label: 'VRN Certificate' },
  { value: 'BUSINESS_REGISTRATION', label: 'Business Registration' },
  { value: 'INCORPORATION_CERTIFICATE', label: 'Incorporation Certificate' },
  { value: 'OTHER', label: 'Other' },
];

export const CUSTOMER_ID_TYPE_OPTIONS: {
  value: CustomerIdType;
  label: string;
}[] = [
  { value: 1, label: 'National Identification Number (NIN)' },
  { value: 2, label: 'Voter Registration Number' },
  { value: 3, label: 'Passport Number' },
  { value: 4, label: 'Driving Licence' },
  { value: 5, label: 'Zanzibar Resident ID (ZANID)' },
  { value: 6, label: 'Tax Identification Number (TIN)' },
  { value: 7, label: 'Company Incorporation Certificate Number' },
];

export function getCustomerDisplayName(
  customer: Pick<
    CustomerRecord,
    | 'customer_type'
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'company_name'
  >,
) {
  const fullName = getCustomerFullName(customer);

  if (fullName) {
    return fullName;
  }

  if (customer.customer_type === 'CORPORATE') {
    return customer.company_name || 'Corporate Customer';
  }

  return (
    [customer.first_name, customer.middle_name, customer.last_name]
      .filter(Boolean)
      .join(' ') || 'Individual Customer'
  );
}

export function getCustomerFullName(
  customer:
    | Partial<
        Pick<
          CustomerRecord,
          | 'customer_type'
          | 'first_name'
          | 'middle_name'
          | 'last_name'
          | 'company_name'
        >
      >
    | null
    | undefined,
) {
  if (!customer) return '';

  if (customer.customer_type === 'CORPORATE') {
    return customer.company_name?.trim() ?? '';
  }

  return [customer.first_name, customer.middle_name, customer.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}
