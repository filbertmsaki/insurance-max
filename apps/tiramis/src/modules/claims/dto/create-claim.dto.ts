export interface CreateClaimantDto {
  claimantName: string;
  claimantBirthDate?: Date | string | null;
  claimantCategory: number;
  claimantType: number;
  claimantIdNumber: string;
  claimantIdType: number;
  gender?: string | null;
  countryCode: string;
  region: string;
  district: string;
  street?: string | null;
  claimantPhoneNumber: string;
  claimantFax?: string | null;
  postalAddress?: string | null;
  emailAddress?: string | null;
}

interface CreateClaimBaseDto {
  environment: string;
  clientConfigurationId: string;
  sourceModule?: string;
  sourceRecordId?: string;
  companyCode: string;
  systemCode: string;
  callbackUrl: string;
  insurerCompanyCode: string;
}

export interface CreateClaimNotificationDto extends CreateClaimBaseDto {
  tranCompanyCode?: string | null;
  claimNotificationNumber: string;
  coverNoteReferenceNumber: string;
  claimReportDate: Date | string;
  claimFormDullyFilled?: string | null;
  lossDate: Date | string;
  lossNature?: string | null;
  lossType?: string | null;
  lossLocation?: string | null;
  officerName: string;
  officerTitle: string;
}

export interface CreateClaimIntimationDto extends CreateClaimBaseDto {
  claimIntimationNumber: string;
  claimReferenceNumber: string;
  coverNoteReferenceNumber: string;
  claimIntimationDate: Date | string;
  currencyCode: string;
  exchangeRate: string;
  claimEstimatedAmount: string;
  claimReserveAmount: string;
  claimReserveMethod: string;
  lossAssessmentOption: number;
  assessorName?: string | null;
  assessorIdNumber?: string | null;
  assessorIdType?: number | null;
  claimants: CreateClaimantDto[];
}

export interface CreateClaimAssessmentDto extends CreateClaimBaseDto {
  claimAssessmentNumber: string;
  claimIntimationNumber: string;
  claimReferenceNumber: string;
  coverNoteReferenceNumber: string;
  assessmentReceivedDate: Date | string;
  assessmentReportSummary?: string | null;
  currencyCode: string;
  exchangeRate: string;
  assessmentAmount: string;
  approvedClaimAmount: string;
  claimApprovalDate?: Date | string | null;
  claimApprovalAuthority?: string | null;
  isReAssessment?: string | null;
  claimants?: CreateClaimantDto[];
}

export interface CreateDischargeVoucherDto extends CreateClaimBaseDto {
  dischargeVoucherNumber: string;
  claimAssessmentNumber: string;
  claimReferenceNumber: string;
  coverNoteReferenceNumber: string;
  dischargeVoucherDate: Date | string;
  currencyCode: string;
  exchangeRate: string;
  claimOfferCommunicationDate?: Date | string | null;
  claimOfferAmount: string;
  claimantResponseDate?: Date | string | null;
  adjustmentDate?: Date | string | null;
  adjustmentReason?: string | null;
  adjustmentAmount?: string | null;
  reconciliationDate?: Date | string | null;
  reconciliationSummary?: string | null;
  reconciledAmount?: string | null;
  offerAccepted?: string | null;
  claimants?: CreateClaimantDto[];
}

export interface CreateClaimPaymentDto extends CreateClaimBaseDto {
  claimPaymentNumber: string;
  claimReferenceNumber: string;
  claimIntimationNumber: string;
  coverNoteReferenceNumber: string;
  paymentDate: Date | string;
  paidAmount: string;
  paymentMode: number;
  partiesNotified?: string | null;
  netPremiumEarned?: string | null;
  claimResultedLitigation?: string | null;
  litigationReason?: string | null;
  currencyCode: string;
  exchangeRate: string;
  claimants?: CreateClaimantDto[];
}

export interface CreateClaimRejectionDto extends CreateClaimBaseDto {
  claimRejectionNumber: string;
  claimReferenceNumber: string;
  coverNoteReferenceNumber: string;
  rejectionDate: Date | string;
  rejectionReason: string;
  claimants?: CreateClaimantDto[];
}
