export const CustomerKycLifecycleStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  REQUIRES_UPDATE: 'REQUIRES_UPDATE',
  EXPIRED: 'EXPIRED',
} as const;

export type CustomerKycLifecycleStatus =
  (typeof CustomerKycLifecycleStatus)[keyof typeof CustomerKycLifecycleStatus];

export const CustomerIdentifierType = {
  NIN: 'NIN',
  VOTER_NUMBER: 'VOTER_NUMBER',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  ZANID: 'ZANID',
  TIN: 'TIN',
  INCORPORATION_CERTIFICATE: 'INCORPORATION_CERTIFICATE',
  BUSINESS_REGISTRATION: 'BUSINESS_REGISTRATION',
  VRN: 'VRN',
  OTHER: 'OTHER',
} as const;

export type CustomerIdentifierType =
  (typeof CustomerIdentifierType)[keyof typeof CustomerIdentifierType];

export const CustomerAddressType = {
  PHYSICAL: 'PHYSICAL',
  POSTAL: 'POSTAL',
  REGISTERED_OFFICE: 'REGISTERED_OFFICE',
  BUSINESS: 'BUSINESS',
  OTHER: 'OTHER',
} as const;

export type CustomerAddressType =
  (typeof CustomerAddressType)[keyof typeof CustomerAddressType];

export const CustomerContactType = {
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  FAX: 'FAX',
  REPRESENTATIVE: 'REPRESENTATIVE',
} as const;

export type CustomerContactType =
  (typeof CustomerContactType)[keyof typeof CustomerContactType];

export const InsuredAssetType = {
  MOTOR_VEHICLE: 'MOTOR_VEHICLE',
  NON_MOTOR_SUBJECT: 'NON_MOTOR_SUBJECT',
} as const;

export type InsuredAssetType =
  (typeof InsuredAssetType)[keyof typeof InsuredAssetType];

export const InsuredAssetStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  RETIRED: 'RETIRED',
  MERGED: 'MERGED',
} as const;

export type InsuredAssetStatus =
  (typeof InsuredAssetStatus)[keyof typeof InsuredAssetStatus];

export const InsuredAssetDataSource = {
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
  TIRA_VERIFICATION: 'TIRA_VERIFICATION',
  PORTAL: 'PORTAL',
} as const;

export type InsuredAssetDataSource =
  (typeof InsuredAssetDataSource)[keyof typeof InsuredAssetDataSource];

export const InsuredAssetVerificationStatus = {
  NOT_VERIFIED: 'NOT_VERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export type InsuredAssetVerificationStatus =
  (typeof InsuredAssetVerificationStatus)[keyof typeof InsuredAssetVerificationStatus];

export const AssetOwnershipType = {
  OWNED: 'OWNED',
  LEASED: 'LEASED',
  FINANCED: 'FINANCED',
  HIRED: 'HIRED',
  OTHER: 'OTHER',
} as const;

export type AssetOwnershipType =
  (typeof AssetOwnershipType)[keyof typeof AssetOwnershipType];
