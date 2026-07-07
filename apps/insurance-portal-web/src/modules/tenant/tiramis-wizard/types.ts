import type { PortalTiramisSubmitPayload, TiramisRequestType } from '@/modules/tenant/tiramis/types';

export type TiramisWizardFlow = 'motor' | 'motor-fleet' | 'non-motor';

export type TiramisWizardStepId =
  | 'quotation'
  | 'context'
  | 'policyholders'
  | 'details'
  | 'risk'
  | 'review';

export interface TiramisWizardPolicyHolder {
  PolicyHolderName: string;
  PolicyHolderBirthDate: string;
  PolicyHolderType: '1' | '2';
  PolicyHolderIdNumber: string;
  PolicyHolderIdType: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  Gender: '' | 'F' | 'M';
  CountryCode: string;
  Region: string;
  District: string;
  Street: string;
  PolicyHolderPhoneNumber: string;
  PolicyHolderFax: string;
  PostalAddress: string;
  EmailAddress: string;
}

export interface TiramisWizardRisk {
  RiskCode: string;
  SumInsured: string;
  SumInsuredEquivalent: string;
  PremiumRate: string;
  PremiumBeforeDiscount: string;
  PremiumAfterDiscount: string;
  PremiumExcludingTaxEquivalent: string;
  PremiumIncludingTax: string;
}

export interface TiramisWizardDiscount {
  DiscountType: string;
  DiscountRate: string;
  DiscountAmount: string;
}

export interface TiramisWizardTax {
  TaxCode: string;
  IsTaxExempted: 'N' | 'Y';
  TaxExemptionType: '' | '1' | '2';
  TaxExemptionReference: string;
  TaxRate: string;
  TaxAmount: string;
}

export interface TiramisWizardSubjectMatter {
  SubjectMatterReference: string;
  SubjectMatterDesc: string;
}

export interface TiramisWizardAddon {
  AddonReference: string;
  AddonDesc: string;
  AddonAmount: string;
  AddonPremiumRate: string;
  PremiumExcludingTax: string;
  PremiumExcludingTaxEquivalent: string;
  PremiumIncludingTax: string;
}

export interface TiramisWizardMotor {
  MotorCategory: '1' | '2';
  MotorType: '1' | '2';
  RegistrationNumber: string;
  ChassisNumber: string;
  Make: string;
  Model: string;
  ModelNumber: string;
  BodyType: string;
  Color: string;
  EngineNumber: string;
  EngineCapacity: string;
  FuelUsed: string;
  NumberOfAxles: string;
  AxleDistance: string;
  SittingCapacity: string;
  YearOfManufacture: string;
  TareWeight: string;
  GrossWeight: string;
  MotorUsage: '1' | '2' | '';
  OwnerName: string;
  OwnerCategory: '1' | '2' | '';
  OwnerAddress: string;
}

export interface TiramisWizardFleetHeader {
  FleetId: string;
  FleetType: '1' | '2';
  FleetSize: string;
  ComprehensiveInsured: string;
  SalePointCode: string;
  CoverNoteStartDate: string;
  CoverNoteEndDate: string;
  PaymentMode: '1' | '2' | '3';
  CurrencyCode: string;
  ExchangeRate: string;
  TotalPremiumExcludingTax: string;
  TotalPremiumIncludingTax: string;
  CommissionPaid: string;
  CommissionRate: string;
  OfficerName: string;
  OfficerTitle: string;
  ProductCode: string;
}

export interface TiramisWizardFleetEntry {
  FleetEntry: string;
  CoverNoteNumber: string;
  PrevCoverNoteReferenceNumber: string;
  CoverNoteDesc: string;
  OperativeClause: string;
  EndorsementType: '' | '1' | '2' | '3' | '4';
  EndorsementReason: string;
  EndorsementPremiumEarned: string;
  RisksCovered: TiramisWizardRisk[];
  DiscountsOffered: TiramisWizardDiscount[];
  TaxesCharged: TiramisWizardTax[];
  SubjectMattersCovered: TiramisWizardSubjectMatter[];
  CoverNoteAddons: TiramisWizardAddon[];
  MotorDtl: TiramisWizardMotor;
}

export interface TiramisWizardFormValues {
  flow: TiramisWizardFlow;
  requestId: string;
  companyCode: string;
  insurerCompanyCode: string;
  clientCode: string;
  clientKey: string;
  systemCode: string;
  branchCode: string;
  salePointCode: string;
  salePointName: string;
  callbackUrl: string;
  tranCompanyCode: string;
  coverNoteType: '1' | '2' | '3';
  quotationId: string;
  quotationNo: string;
  quotationType: 'MOTOR' | 'NON_MOTOR';
  customerId: string;
  productCode: string;
  currencyCode: string;
  coverNoteNumber: string;
  prevCoverNoteReferenceNumber: string;
  coverNoteStartDate: string;
  coverNoteEndDate: string;
  coverNoteDesc: string;
  operativeClause: string;
  paymentMode: '1' | '2' | '3';
  exchangeRate: string;
  totalPremiumExcludingTax: string;
  totalPremiumIncludingTax: string;
  commissionPaid: string;
  commissionRate: string;
  officerName: string;
  officerTitle: string;
  endorsementType: '' | '1' | '2' | '3' | '4';
  endorsementReason: string;
  endorsementPremiumEarned: string;
  policyholders: TiramisWizardPolicyHolder[];
  risks: TiramisWizardRisk[];
  discounts: TiramisWizardDiscount[];
  taxes: TiramisWizardTax[];
  subjectMatters: TiramisWizardSubjectMatter[];
  addons: TiramisWizardAddon[];
  motor: TiramisWizardMotor;
  fleetHeader: TiramisWizardFleetHeader;
  fleetEntries: TiramisWizardFleetEntry[];
}

export interface TiramisWizardReferenceData {
  companyCode: string;
  insurerCompanyCode: string;
  clientCode: string;
  clientKey: string;
  systemCode: string;
  branchCode: string;
  salePointCode: string;
  salePointName: string;
  callbackUrl: string;
  tranCompanyCode: string;
}

export interface TiramisWizardBuildResult {
  requestType: TiramisRequestType;
  payload: Record<string, unknown>;
  businessReference: string;
  sourceModule: string;
  sourceRecordId: string;
  quotationId?: string;
  policyId?: string;
}

export type TiramisWizardSubmitPayload = PortalTiramisSubmitPayload;
