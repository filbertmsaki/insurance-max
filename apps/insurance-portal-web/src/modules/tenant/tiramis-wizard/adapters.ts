import type { TiramisRequestType } from '@/modules/tenant/tiramis/types';
import type { PortalTiramisSubmitPayload } from '@/modules/tenant/tiramis/types';
import type {
  TiramisWizardBuildResult,
  TiramisWizardFlow,
  TiramisWizardFormValues,
} from './types';

function flowToRequestType(flow: TiramisWizardFlow): TiramisRequestType {
  if (flow === 'non-motor') return 'NON_MOTOR';
  if (flow === 'motor-fleet') return 'MOTOR_FLEET';
  return 'MOTOR';
}

function buildPolicyHolder(holder: TiramisWizardFormValues['policyholders'][number]) {
  return {
    PolicyHolderName: holder.PolicyHolderName,
    PolicyHolderBirthDate: holder.PolicyHolderBirthDate,
    PolicyHolderType: holder.PolicyHolderType,
    PolicyHolderIdNumber: holder.PolicyHolderIdNumber,
    PolicyHolderIdType: holder.PolicyHolderIdType,
    Gender: holder.Gender || undefined,
    CountryCode: holder.CountryCode,
    Region: holder.Region || undefined,
    District: holder.District || undefined,
    Street: holder.Street || undefined,
    PolicyHolderPhoneNumber: holder.PolicyHolderPhoneNumber || undefined,
    PolicyHolderFax: holder.PolicyHolderFax || undefined,
    PostalAddress: holder.PostalAddress || undefined,
    EmailAddress: holder.EmailAddress || undefined,
  };
}

function buildRisk(risk: TiramisWizardFormValues['risks'][number]) {
  return {
    RiskCode: risk.RiskCode,
    SumInsured: risk.SumInsured,
    SumInsuredEquivalent: risk.SumInsuredEquivalent || undefined,
    PremiumRate: risk.PremiumRate,
    PremiumBeforeDiscount: risk.PremiumBeforeDiscount,
    PremiumAfterDiscount: risk.PremiumAfterDiscount,
    PremiumExcludingTaxEquivalent: risk.PremiumExcludingTaxEquivalent || undefined,
    PremiumIncludingTax: risk.PremiumIncludingTax,
  };
}

function buildDiscount(discount: TiramisWizardFormValues['discounts'][number]) {
  return {
    DiscountType: discount.DiscountType || undefined,
    DiscountRate: discount.DiscountRate || undefined,
    DiscountAmount: discount.DiscountAmount || undefined,
  };
}

function buildTax(tax: TiramisWizardFormValues['taxes'][number]) {
  return {
    TaxCode: tax.TaxCode || undefined,
    IsTaxExempted: tax.IsTaxExempted,
    TaxExemptionType: tax.TaxExemptionType || undefined,
    TaxExemptionReference: tax.TaxExemptionReference || undefined,
    TaxRate: tax.TaxRate || undefined,
    TaxAmount: tax.TaxAmount || undefined,
  };
}

function buildSubjectMatter(subjectMatter: TiramisWizardFormValues['subjectMatters'][number]) {
  return {
    SubjectMatterReference: subjectMatter.SubjectMatterReference,
    SubjectMatterDesc: subjectMatter.SubjectMatterDesc,
  };
}

function buildAddon(addon: TiramisWizardFormValues['addons'][number]) {
  return {
    AddonReference: addon.AddonReference,
    AddonDesc: addon.AddonDesc,
    AddonAmount: addon.AddonAmount || undefined,
    AddonPremiumRate: addon.AddonPremiumRate || undefined,
    PremiumExcludingTax: addon.PremiumExcludingTax || undefined,
    PremiumExcludingTaxEquivalent: addon.PremiumExcludingTaxEquivalent || undefined,
    PremiumIncludingTax: addon.PremiumIncludingTax || undefined,
  };
}

function buildMotor(motor: TiramisWizardFormValues['motor']) {
  return {
    MotorCategory: motor.MotorCategory,
    MotorType: motor.MotorType,
    RegistrationNumber: motor.RegistrationNumber || undefined,
    ChassisNumber: motor.ChassisNumber || undefined,
    Make: motor.Make || undefined,
    Model: motor.Model || undefined,
    ModelNumber: motor.ModelNumber || undefined,
    BodyType: motor.BodyType || undefined,
    Color: motor.Color || undefined,
    EngineNumber: motor.EngineNumber || undefined,
    EngineCapacity: motor.EngineCapacity || undefined,
    FuelUsed: motor.FuelUsed || undefined,
    NumberOfAxles: motor.NumberOfAxles || undefined,
    AxleDistance: motor.AxleDistance || undefined,
    SittingCapacity: motor.SittingCapacity || undefined,
    YearOfManufacture: motor.YearOfManufacture || undefined,
    TareWeight: motor.TareWeight || undefined,
    GrossWeight: motor.GrossWeight || undefined,
    MotorUsage: motor.MotorUsage || undefined,
    OwnerName: motor.OwnerName || undefined,
    OwnerCategory: motor.OwnerCategory || undefined,
    OwnerAddress: motor.OwnerAddress || undefined,
  };
}

export function buildTiramisWizardSubmission(values: TiramisWizardFormValues): TiramisWizardBuildResult {
  const requestType = flowToRequestType(values.flow);
  const commonHeader = {
    RequestId: values.requestId,
    CompanyCode: values.companyCode,
    SystemCode: values.systemCode,
    CallBackUrl: values.callbackUrl,
    InsurerCompanyCode: values.insurerCompanyCode,
    TranCompanyCode: values.tranCompanyCode,
    CoverNoteType: values.coverNoteType,
  };

  const coverNoteDtl = {
    CoverNoteNumber: values.coverNoteNumber,
    PrevCoverNoteReferenceNumber: values.prevCoverNoteReferenceNumber || undefined,
    SalePointCode: values.salePointCode,
    CoverNoteStartDate: values.coverNoteStartDate,
    CoverNoteEndDate: values.coverNoteEndDate,
    CoverNoteDesc: values.coverNoteDesc || undefined,
    OperativeClause: values.operativeClause || undefined,
    PaymentMode: values.paymentMode,
    CurrencyCode: values.currencyCode,
    ExchangeRate: values.exchangeRate || undefined,
    TotalPremiumExcludingTax: values.totalPremiumExcludingTax,
    TotalPremiumIncludingTax: values.totalPremiumIncludingTax,
    CommissionPaid: values.commissionPaid || undefined,
    CommissionRate: values.commissionRate || undefined,
    OfficerName: values.officerName,
    OfficerTitle: values.officerTitle,
    ProductCode: values.productCode,
    EndorsementType: values.endorsementType || undefined,
    EndorsementReason: values.endorsementReason || undefined,
    EndorsementPremiumEarned: values.endorsementPremiumEarned || undefined,
  };

  const payload: Record<string, unknown> = {
    ...commonHeader,
    CoverNoteDtl: {
      ...coverNoteDtl,
      PolicyHolders: values.policyholders.map(buildPolicyHolder),
    },
  };

  if (values.flow === 'motor') {
    payload.CoverNoteDtl = {
      ...payload.CoverNoteDtl as Record<string, unknown>,
      RisksCovered: values.risks.map(buildRisk),
      DiscountsOffered: values.discounts.map(buildDiscount),
      TaxesCharged: values.taxes.map(buildTax),
      CoverNoteAddons: values.addons.map(buildAddon),
      MotorDtl: buildMotor(values.motor),
    };
  }

  if (values.flow === 'non-motor') {
    payload.CoverNoteDtl = {
      ...payload.CoverNoteDtl as Record<string, unknown>,
      RisksCovered: values.risks.map(buildRisk),
      DiscountsOffered: values.discounts.map(buildDiscount),
      TaxesCharged: values.taxes.map(buildTax),
      SubjectMattersCovered: values.subjectMatters.map(buildSubjectMatter),
      CoverNoteAddons: values.addons.map(buildAddon),
    };
  }

  if (values.flow === 'motor-fleet') {
    payload.CoverNoteDtl = {
      ...payload.CoverNoteDtl as Record<string, unknown>,
      FleetHdr: {
        FleetId: values.fleetHeader.FleetId,
        FleetType: values.fleetHeader.FleetType,
        FleetSize: values.fleetHeader.FleetSize,
        ComprehensiveInsured: values.fleetHeader.ComprehensiveInsured,
        SalePointCode: values.fleetHeader.SalePointCode || values.salePointCode,
        CoverNoteStartDate: values.fleetHeader.CoverNoteStartDate || values.coverNoteStartDate,
        CoverNoteEndDate: values.fleetHeader.CoverNoteEndDate || values.coverNoteEndDate,
        PaymentMode: values.fleetHeader.PaymentMode,
        CurrencyCode: values.fleetHeader.CurrencyCode || values.currencyCode,
        ExchangeRate: values.fleetHeader.ExchangeRate || values.exchangeRate || undefined,
        TotalPremiumExcludingTax: values.fleetHeader.TotalPremiumExcludingTax || values.totalPremiumExcludingTax,
        TotalPremiumIncludingTax: values.fleetHeader.TotalPremiumIncludingTax || values.totalPremiumIncludingTax,
        CommissionPaid: values.fleetHeader.CommissionPaid || values.commissionPaid || undefined,
        CommissionRate: values.fleetHeader.CommissionRate || values.commissionRate || undefined,
        OfficerName: values.fleetHeader.OfficerName || values.officerName,
        OfficerTitle: values.fleetHeader.OfficerTitle || values.officerTitle,
        ProductCode: values.fleetHeader.ProductCode || values.productCode,
      },
      FleetDtl: values.fleetEntries.map((entry) => ({
        FleetEntry: entry.FleetEntry,
        CoverNoteNumber: entry.CoverNoteNumber,
        PrevCoverNoteReferenceNumber: entry.PrevCoverNoteReferenceNumber || undefined,
        CoverNoteDesc: entry.CoverNoteDesc || undefined,
        OperativeClause: entry.OperativeClause || undefined,
        EndorsementType: entry.EndorsementType || undefined,
        EndorsementReason: entry.EndorsementReason || undefined,
        EndorsementPremiumEarned: entry.EndorsementPremiumEarned || undefined,
        RisksCovered: entry.RisksCovered.map(buildRisk),
        DiscountsOffered: entry.DiscountsOffered.map(buildDiscount),
        TaxesCharged: entry.TaxesCharged.map(buildTax),
        SubjectMattersCovered: entry.SubjectMattersCovered.map(buildSubjectMatter),
        CoverNoteAddons: entry.CoverNoteAddons.map(buildAddon),
        MotorDtl: buildMotor(entry.MotorDtl),
      })),
    };
  }

  return {
    requestType,
    payload,
    businessReference: values.coverNoteNumber || values.requestId,
    sourceModule: 'tiramis-wizard',
    sourceRecordId: values.quotationId || values.requestId,
    quotationId: values.quotationId || undefined,
  };
}

export function toPortalTiramisSubmitPayload(values: TiramisWizardFormValues): PortalTiramisSubmitPayload {
  const built = buildTiramisWizardSubmission(values);
  return {
    requestType: built.requestType,
    quotation_id: built.quotationId,
    source_module: built.sourceModule,
    source_record_id: built.sourceRecordId,
    business_reference: built.businessReference,
    payload: built.payload,
  };
}
