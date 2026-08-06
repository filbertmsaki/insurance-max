import type {
  AssetOwnershipType,
  InsuredAssetType,
  InsuredAssetVerificationStatus,
} from './insured-data.enums';

export interface MotorVehicleSnapshot {
  registrationNumber: string | null;
  chassisNumber: string;
  engineNumber: string | null;
  make: string | null;
  model: string | null;
  modelNumber: string | null;
  bodyType: string | null;
  color: string | null;
  yearOfManufacture: number | null;
  usageType: string | null;
  vehicleCategory: string | null;
  seatingCapacity: number | null;
  grossWeightTons: string | null;
  tareWeightTons: string | null;
  cubicCapacity: number | null;
  motorCategory: number | null;
  motorType: number | null;
  motorUsage: number | null;
  ownerName: string;
  ownerCategory: number | null;
  ownerAddress: string | null;
}

export interface NonMotorSubjectSnapshot {
  subjectCode: string;
  subjectType: string | null;
  subjectCategory: string | null;
  description: string;
  location: string | null;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  attributes: Array<{
    factorId: string;
    factorCode: string;
    factorName: string;
    value: string | number | boolean | Record<string, unknown>;
  }>;
}

export interface InsuredAssetSnapshot {
  insuredAssetId: string;
  assetNumber: string;
  assetType: InsuredAssetType;
  customerId: string;
  ownerCustomerId: string;
  displayName: string;
  ownershipType: AssetOwnershipType;
  declaredValue: string;
  currencyCode: string;
  verificationStatus: InsuredAssetVerificationStatus;
  verificationReference: string | null;
  motorVehicle: MotorVehicleSnapshot | null;
  nonMotorSubject: NonMotorSubjectSnapshot | null;
  snapshotVersion: number;
  snapshotHash: string;
  snapshottedAt: string;
}
