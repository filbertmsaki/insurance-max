import { CustomerGender } from './enums/customer-gender.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { CustomerType } from './enums/customer-type.enum';

// Internal shapes the service persists. The public API only accepts the
// TIRA policyholder fields (see CreateCustomerDto); these carry the stored
// columns and child records derived from them plus existing data that the
// policyholder contract does not cover, so updates never drop it.

export interface CustomerIdentifierInput {
  identifier_type: string;
  identifier_value: string;
  country_code?: string | null;
  is_primary?: boolean;
  is_verified?: boolean;
  issued_at?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CustomerAddressInput {
  address_type: string;
  country_code: string;
  country?: string | null;
  region: string;
  district: string;
  ward?: string | null;
  street?: string | null;
  postal_address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_primary?: boolean;
}

export interface CustomerContactInput {
  contact_type: string;
  label?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  value: string;
  is_primary?: boolean;
  is_verified?: boolean;
}

export interface CustomerWriteModel {
  customer_type: CustomerType;
  display_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  company_name: string | null;
  gender: CustomerGender | null;
  date_of_birth: string;
  id_type: number;
  id_number: string;
  phone: string;
  fax: string | null;
  email: string | null;
  country_code: string;
  region: string;
  district: string;
  street: string;
  postal_address: string | null;
  status: CustomerStatus;
  metadata: Record<string, unknown> | null;
  identifiers: CustomerIdentifierInput[];
  addresses: CustomerAddressInput[];
  contacts: CustomerContactInput[];
  duplicate_override_reason: string | null;
}
