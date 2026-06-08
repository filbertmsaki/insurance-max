import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimantDto {
  @ApiProperty({ example: 'Mock Claimant' })
  claimantName!: string;

  @ApiPropertyOptional({ nullable: true, example: '1990-01-01' })
  claimantBirthDate?: Date | string | null;

  @ApiProperty({ example: 1 })
  claimantCategory!: number;

  @ApiProperty({ example: 1 })
  claimantType!: number;

  @ApiProperty({ example: '19900101123456789000' })
  claimantIdNumber!: string;

  @ApiProperty({ example: 1 })
  claimantIdType!: number;

  @ApiPropertyOptional({ nullable: true, example: 'M' })
  gender?: string | null;

  @ApiProperty({ example: 'TZA' })
  countryCode!: string;

  @ApiProperty({ example: 'Dar es Salaam' })
  region!: string;

  @ApiProperty({ example: 'Ilala' })
  district!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Samora Avenue' })
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  claimantPhoneNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  claimantFax?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'P.O. BOX 123, Dar es Salaam' })
  postalAddress?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'claimant@example.com' })
  emailAddress?: string | null;
}

export class CreateClaimNotificationDto {
  @ApiProperty({ example: 'CLM-NOT-LOCAL-001' })
  claimNotificationNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-06T10:00:00' })
  claimReportDate!: Date | string;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  claimFormDullyFilled?: string | null;

  @ApiProperty({ example: '2026-06-05T21:30:00' })
  lossDate!: Date | string;

  @ApiPropertyOptional({ nullable: true, example: 'Accident' })
  lossNature?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Collision' })
  lossType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Dar es Salaam' })
  lossLocation?: string | null;

  @ApiProperty({ example: 'Mock Underwriter' })
  officerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  officerTitle!: string;
}

export class CreateClaimIntimationDto {
  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-06T11:00:00' })
  claimIntimationDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: '1000000.00' })
  claimEstimatedAmount!: string;

  @ApiProperty({ example: '800000.00' })
  claimReserveAmount!: string;

  @ApiProperty({ example: 'Manual' })
  claimReserveMethod!: string;

  @ApiProperty({ example: 1 })
  lossAssessmentOption!: number;

  @ApiPropertyOptional({ nullable: true, example: 'Jane Doe' })
  assessorName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'AS12345' })
  assessorIdNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  assessorIdType?: number | null;

  @ApiProperty({ type: () => [CreateClaimantDto] })
  claimants!: CreateClaimantDto[];
}

export class CreateClaimAssessmentDto {
  @ApiProperty({ example: 'CLM-ASM-LOCAL-001' })
  claimAssessmentNumber!: string;

  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-07T11:00:00' })
  assessmentReceivedDate!: Date | string;

  @ApiPropertyOptional({ nullable: true, example: 'Initial assessment complete' })
  assessmentReportSummary?: string | null;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: '900000.00' })
  assessmentAmount!: string;

  @ApiProperty({ example: '850000.00' })
  approvedClaimAmount!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-07T15:00:00' })
  claimApprovalDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Claims Manager' })
  claimApprovalAuthority?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'N' })
  isReAssessment?: string | null;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  claimants?: CreateClaimantDto[];
}

export class CreateDischargeVoucherDto {
  @ApiProperty({ example: 'CLM-DV-LOCAL-001' })
  dischargeVoucherNumber!: string;

  @ApiProperty({ example: 'CLM-ASM-LOCAL-001' })
  claimAssessmentNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-08T10:00:00' })
  dischargeVoucherDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-08T11:00:00' })
  claimOfferCommunicationDate?: Date | string | null;

  @ApiProperty({ example: '850000.00' })
  claimOfferAmount!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-08T14:00:00' })
  claimantResponseDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-09T09:00:00' })
  adjustmentDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Additional salvage recovery applied' })
  adjustmentReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '50000.00' })
  adjustmentAmount?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-09T13:00:00' })
  reconciliationDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Claim settled amicably' })
  reconciliationSummary?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '800000.00' })
  reconciledAmount?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  offerAccepted?: string | null;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  claimants?: CreateClaimantDto[];
}

export class CreateClaimPaymentDto {
  @ApiProperty({ example: 'CLM-PAY-LOCAL-001' })
  claimPaymentNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-10T10:00:00' })
  paymentDate!: Date | string;

  @ApiProperty({ example: '800000.00' })
  paidAmount!: string;

  @ApiProperty({ example: 1 })
  paymentMode!: number;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  partiesNotified?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '100000.00' })
  netPremiumEarned?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'N' })
  claimResultedLitigation?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '' })
  litigationReason?: string | null;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  claimants?: CreateClaimantDto[];
}

export class CreateClaimRejectionDto {
  @ApiProperty({ example: 'CLM-REJ-LOCAL-001' })
  claimRejectionNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-10T15:00:00' })
  rejectionDate!: Date | string;

  @ApiProperty({ example: 'Claim is outside the policy scope' })
  rejectionReason!: string;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  claimants?: CreateClaimantDto[];
}
