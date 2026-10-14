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

export type CustomerIdType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CustomerIdField =
  | 'nida_no'
  | 'voter_no'
  | 'passport_no'
  | 'driving_license_no'
  | 'zanid_no'
  | 'tin'
  | 'incorporation_certificate_no';

export interface CustomerRecord {
  id: string;
  company_id: string;
  customer_no: string;
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

export interface CustomerFormValues {
  customer_type: CustomerType;
  customer_no?: string;
  full_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: CustomerGender | '';
  date_of_birth: string;
  nationality: string;
  company_name: string;
  registration_no: string;
  incorporation_certificate_no: string;
  tin: string;
  vrn: string;
  id_type: CustomerIdType | '';
  id_number: string;
  nida_no: string;
  voter_no: string;
  passport_no: string;
  driving_license_no: string;
  zanid_no: string;
  phone: string;
  alternate_phone: string;
  fax: string;
  email: string;
  country: string;
  country_code: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  postal_address: string;
  contact_name: string;
  contact_role: string;
  contact_phone: string;
  contact_email: string;
  document_type: CustomerDocumentType | '';
  document_no: string;
  document_file_name: string;
  document_file_url: string;
  document_mime_type: string;
  document_verified: boolean;
  status: CustomerStatus;
}

export type CustomerPayload = {
  customer_type: CustomerType;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  gender?: CustomerGender;
  date_of_birth?: string;
  nationality?: string | null;
  company_name?: string;
  registration_no?: string | null;
  incorporation_certificate_no?: string | null;
  tin?: string | null;
  vrn?: string | null;
  policy_holder_type?: number;
  id_type: number;
  id_number: string;
  nida_no?: string | null;
  voter_no?: string | null;
  passport_no?: string | null;
  driving_license_no?: string | null;
  zanid_no?: string | null;
  phone: string;
  alternate_phone?: string | null;
  fax?: string | null;
  email?: string | null;
  country?: string | null;
  country_code: string;
  region: string;
  district: string;
  ward?: string | null;
  street?: string | null;
  postal_address?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  document_type?: CustomerDocumentType | null;
  document_no?: string | null;
  document_file_name?: string | null;
  document_file_url?: string | null;
  document_mime_type?: string | null;
  document_verified?: boolean;
  status?: CustomerStatus;
  metadata?: Record<string, unknown> | null;
};

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
  field: CustomerIdField;
  appliesTo: CustomerType | 'BOTH';
}[] = [
  {
    value: 1,
    label: 'National Identification Number (NIN)',
    field: 'nida_no',
    appliesTo: 'INDIVIDUAL',
  },
  {
    value: 2,
    label: 'Voters Registration Number',
    field: 'voter_no',
    appliesTo: 'INDIVIDUAL',
  },
  {
    value: 3,
    label: 'Passport Number',
    field: 'passport_no',
    appliesTo: 'INDIVIDUAL',
  },
  {
    value: 4,
    label: 'Driving License',
    field: 'driving_license_no',
    appliesTo: 'INDIVIDUAL',
  },
  {
    value: 5,
    label: 'Zanzibar Resident ID (ZANID)',
    field: 'zanid_no',
    appliesTo: 'INDIVIDUAL',
  },
  {
    value: 6,
    label: 'Tax Identification Number (TIN)',
    field: 'tin',
    appliesTo: 'BOTH',
  },
  {
    value: 7,
    label: 'Company Incorporation Certificate Number',
    field: 'incorporation_certificate_no',
    appliesTo: 'CORPORATE',
  },
];

export function getCustomerIdFieldName(
  customerType: CustomerType,
  idType: CustomerIdType | '',
): CustomerIdField | null {
  const option = CUSTOMER_ID_TYPE_OPTIONS.find(
    (item) =>
      item.value === idType &&
      (item.appliesTo === 'BOTH' || item.appliesTo === customerType),
  );
  return option?.field ?? null;
}

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

export function splitCustomerFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      first_name: '',
      middle_name: '',
      last_name: '',
    };
  }

  if (parts.length === 1) {
    return {
      first_name: parts[0],
      middle_name: '',
      last_name: '',
    };
  }

  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
}
