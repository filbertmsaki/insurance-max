export interface CustomerIdentifierSnapshot {
  type: string;
  value: string;
  countryCode: string | null;
  verified: boolean;
}

export interface CustomerAddressSnapshot {
  type: string;
  countryCode: string;
  country: string | null;
  region: string;
  district: string;
  ward: string | null;
  street: string | null;
  postalAddress: string | null;
}

export interface CustomerContactSnapshot {
  type: string;
  value: string;
  name: string | null;
  role: string | null;
}

export interface CustomerSnapshot {
  customerId: string;
  customerNumber: string;
  customerType: 'INDIVIDUAL' | 'CORPORATE';
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  companyName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  policyHolderType: number;
  primaryIdType: number;
  primaryIdNumber: string;
  primaryPhone: string;
  primaryEmail: string | null;
  identifiers: CustomerIdentifierSnapshot[];
  addresses: CustomerAddressSnapshot[];
  contacts: CustomerContactSnapshot[];
  snapshotHash: string;
  snapshottedAt: string;
}
