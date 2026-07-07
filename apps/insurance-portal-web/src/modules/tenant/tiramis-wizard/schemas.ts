import { z } from 'zod';
import type { TiramisWizardFlow, TiramisWizardFormValues } from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));
const requiredText = z.string().trim().min(1, 'Required');
const requiredNumberLike = z.string().trim().refine((value) => value !== '' && Number.isFinite(Number(value)), 'Must be a number');

const policyHolderSchema = z.object({
  PolicyHolderName: requiredText,
  PolicyHolderBirthDate: optionalText,
  PolicyHolderType: z.enum(['1', '2']),
  PolicyHolderIdNumber: requiredText,
  PolicyHolderIdType: z.enum(['1', '2', '3', '4', '5', '6', '7']),
  Gender: z.union([z.literal(''), z.enum(['F', 'M'])]),
  CountryCode: optionalText,
  Region: optionalText,
  District: optionalText,
  Street: optionalText,
  PolicyHolderPhoneNumber: optionalText,
  PolicyHolderFax: optionalText,
  PostalAddress: optionalText,
  EmailAddress: optionalText,
});

const riskSchema = z.object({
  RiskCode: requiredText,
  SumInsured: requiredNumberLike,
  SumInsuredEquivalent: optionalText,
  PremiumRate: requiredNumberLike,
  PremiumBeforeDiscount: requiredNumberLike,
  PremiumAfterDiscount: requiredNumberLike,
  PremiumExcludingTaxEquivalent: optionalText,
  PremiumIncludingTax: requiredNumberLike,
});

const discountSchema = z.object({
  DiscountType: optionalText,
  DiscountRate: optionalText,
  DiscountAmount: optionalText,
});

const taxSchema = z.object({
  TaxCode: optionalText,
  IsTaxExempted: z.enum(['N', 'Y']),
  TaxExemptionType: z.union([z.literal(''), z.enum(['1', '2'])]),
  TaxExemptionReference: optionalText,
  TaxRate: optionalText,
  TaxAmount: optionalText,
});

const subjectMatterSchema = z.object({
  SubjectMatterReference: requiredText,
  SubjectMatterDesc: requiredText,
});

const addonSchema = z.object({
  AddonReference: requiredText,
  AddonDesc: requiredText,
  AddonAmount: optionalText,
  AddonPremiumRate: optionalText,
  PremiumExcludingTax: optionalText,
  PremiumExcludingTaxEquivalent: optionalText,
  PremiumIncludingTax: optionalText,
});

const motorSchema = z.object({
  MotorCategory: z.enum(['1', '2']),
  MotorType: z.enum(['1', '2']),
  RegistrationNumber: optionalText,
  ChassisNumber: optionalText,
  Make: optionalText,
  Model: optionalText,
  ModelNumber: optionalText,
  BodyType: optionalText,
  Color: optionalText,
  EngineNumber: optionalText,
  EngineCapacity: optionalText,
  FuelUsed: optionalText,
  NumberOfAxles: optionalText,
  AxleDistance: optionalText,
  SittingCapacity: optionalText,
  YearOfManufacture: optionalText,
  TareWeight: optionalText,
  GrossWeight: optionalText,
  MotorUsage: z.union([z.literal(''), z.enum(['1', '2'])]),
  OwnerName: optionalText,
  OwnerCategory: z.union([z.literal(''), z.enum(['1', '2'])]),
  OwnerAddress: optionalText,
});

const fleetHeaderSchema = z.object({
  FleetId: requiredText,
  FleetType: z.enum(['1', '2']),
  FleetSize: requiredNumberLike,
  ComprehensiveInsured: requiredNumberLike,
  SalePointCode: optionalText,
  CoverNoteStartDate: optionalText,
  CoverNoteEndDate: optionalText,
  PaymentMode: z.enum(['1', '2', '3']),
  CurrencyCode: optionalText,
  ExchangeRate: optionalText,
  TotalPremiumExcludingTax: optionalText,
  TotalPremiumIncludingTax: optionalText,
  CommissionPaid: optionalText,
  CommissionRate: optionalText,
  OfficerName: optionalText,
  OfficerTitle: optionalText,
  ProductCode: optionalText,
});

const fleetEntrySchema = z.object({
  FleetEntry: requiredText,
  CoverNoteNumber: requiredText,
  PrevCoverNoteReferenceNumber: optionalText,
  CoverNoteDesc: optionalText,
  OperativeClause: optionalText,
  EndorsementType: z.union([z.literal(''), z.enum(['1', '2', '3', '4'])]),
  EndorsementReason: optionalText,
  EndorsementPremiumEarned: optionalText,
  RisksCovered: z.array(riskSchema).default([]),
  DiscountsOffered: z.array(discountSchema).default([]),
  TaxesCharged: z.array(taxSchema).default([]),
  SubjectMattersCovered: z.array(subjectMatterSchema).default([]),
  CoverNoteAddons: z.array(addonSchema).default([]),
  MotorDtl: motorSchema,
});

export function buildTiramisWizardSchema(flow: TiramisWizardFlow) {
  return z
    .object({
      flow: z.enum(['motor', 'motor-fleet', 'non-motor']),
      requestId: requiredText,
      companyCode: requiredText,
      insurerCompanyCode: requiredText,
      clientCode: optionalText,
      clientKey: optionalText,
      systemCode: requiredText,
      branchCode: optionalText,
      salePointCode: requiredText,
      salePointName: optionalText,
      callbackUrl: requiredText,
      tranCompanyCode: requiredText,
      coverNoteType: z.enum(['1', '2', '3']),
      quotationId: optionalText,
      quotationNo: optionalText,
      quotationType: z.enum(['MOTOR', 'NON_MOTOR']),
      customerId: requiredText,
      productCode: requiredText,
      currencyCode: requiredText,
      coverNoteNumber: requiredText,
      prevCoverNoteReferenceNumber: optionalText,
      coverNoteStartDate: requiredText,
      coverNoteEndDate: requiredText,
      coverNoteDesc: optionalText,
      operativeClause: optionalText,
      paymentMode: z.enum(['1', '2', '3']),
      exchangeRate: optionalText,
      totalPremiumExcludingTax: requiredText,
      totalPremiumIncludingTax: requiredText,
      commissionPaid: optionalText,
      commissionRate: optionalText,
      officerName: requiredText,
      officerTitle: requiredText,
      endorsementType: z.union([z.literal(''), z.enum(['1', '2', '3', '4'])]),
      endorsementReason: optionalText,
      endorsementPremiumEarned: optionalText,
      policyholders: z.array(policyHolderSchema).min(1, 'At least one policyholder is required'),
      risks: z.array(riskSchema).default([]),
      discounts: z.array(discountSchema).default([]),
      taxes: z.array(taxSchema).default([]),
      subjectMatters: z.array(subjectMatterSchema).default([]),
      addons: z.array(addonSchema).default([]),
      motor: motorSchema,
      fleetHeader: fleetHeaderSchema,
      fleetEntries: z.array(fleetEntrySchema).default([]),
    })
    .superRefine((values, ctx) => {
      if (values.coverNoteType === '3' && !(values.prevCoverNoteReferenceNumber ?? '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prevCoverNoteReferenceNumber'],
          message: 'Previous cover note reference number is required for endorsements',
        });
      }

      if (flow === 'motor' || flow === 'motor-fleet') {
        if (!(values.motor.ChassisNumber ?? '').trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'ChassisNumber'],
            message: 'Chassis number is required for motor flows',
          });
        }
      }

      if (flow === 'motor-fleet') {
        const fleetSize = Number(values.fleetHeader.FleetSize || 0);
        if (fleetSize < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleetHeader', 'FleetSize'],
            message: 'Fleet size must be at least 1',
          });
        }
        if (values.fleetEntries.length !== fleetSize) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleetEntries'],
            message: 'Fleet entry count must match fleet size',
          });
        }
      }

      if (flow === 'non-motor' && values.risks.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['risks'],
          message: 'At least one risk is required for non-motor cover notes',
        });
      }
    });
}

export type TiramisWizardSchema = ReturnType<typeof buildTiramisWizardSchema>;
export type TiramisWizardSchemaValues = TiramisWizardFormValues;

export function createDefaultWizardValues(flow: TiramisWizardFlow): TiramisWizardFormValues {
  return {
    flow,
    requestId: crypto.randomUUID(),
    companyCode: '',
    insurerCompanyCode: '',
    clientCode: '',
    clientKey: '',
    systemCode: '',
    branchCode: '',
    salePointCode: '',
    salePointName: '',
    callbackUrl: '',
    tranCompanyCode: '',
    coverNoteType: '1',
    quotationId: '',
    quotationNo: '',
    quotationType: flow === 'non-motor' ? 'NON_MOTOR' : 'MOTOR',
    customerId: '',
    productCode: '',
    currencyCode: 'TZS',
    coverNoteNumber: '',
    prevCoverNoteReferenceNumber: '',
    coverNoteStartDate: new Date().toISOString(),
    coverNoteEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    coverNoteDesc: '',
    operativeClause: '',
    paymentMode: '1',
    exchangeRate: '',
    totalPremiumExcludingTax: '',
    totalPremiumIncludingTax: '',
    commissionPaid: '',
    commissionRate: '',
    officerName: '',
    officerTitle: '',
    endorsementType: '',
    endorsementReason: '',
    endorsementPremiumEarned: '',
    policyholders: [
      {
        PolicyHolderName: '',
        PolicyHolderBirthDate: '',
        PolicyHolderType: '2',
        PolicyHolderIdNumber: '',
        PolicyHolderIdType: '6',
        Gender: '',
        CountryCode: 'TZA',
        Region: '',
        District: '',
        Street: '',
        PolicyHolderPhoneNumber: '',
        PolicyHolderFax: '',
        PostalAddress: '',
        EmailAddress: '',
      },
    ],
    risks: [
      {
        RiskCode: '',
        SumInsured: '',
        SumInsuredEquivalent: '',
        PremiumRate: '',
        PremiumBeforeDiscount: '',
        PremiumAfterDiscount: '',
        PremiumExcludingTaxEquivalent: '',
        PremiumIncludingTax: '',
      },
    ],
    discounts: [],
    taxes: [],
    subjectMatters: [],
    addons: [],
    motor: {
      MotorCategory: '1',
      MotorType: '1',
      RegistrationNumber: '',
      ChassisNumber: '',
      Make: '',
      Model: '',
      ModelNumber: '',
      BodyType: '',
      Color: '',
      EngineNumber: '',
      EngineCapacity: '',
      FuelUsed: '',
      NumberOfAxles: '',
      AxleDistance: '',
      SittingCapacity: '',
      YearOfManufacture: '',
      TareWeight: '',
      GrossWeight: '',
      MotorUsage: '',
      OwnerName: '',
      OwnerCategory: '',
      OwnerAddress: '',
    },
    fleetHeader: {
      FleetId: '',
      FleetType: '1',
      FleetSize: '1',
      ComprehensiveInsured: '1',
      SalePointCode: '',
      CoverNoteStartDate: '',
      CoverNoteEndDate: '',
      PaymentMode: '1',
      CurrencyCode: 'TZS',
      ExchangeRate: '',
      TotalPremiumExcludingTax: '',
      TotalPremiumIncludingTax: '',
      CommissionPaid: '',
      CommissionRate: '',
      OfficerName: '',
      OfficerTitle: '',
      ProductCode: '',
    },
    fleetEntries: [],
  };
}
