import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateClaimantDto {
  @ApiProperty({ example: 'Mock Claimant' })
  @IsOptional()
  claimantName!: string;

  @ApiPropertyOptional({ nullable: true, example: '1990-01-01' })
  @IsOptional()
  claimantBirthDate?: Date | string | null;

  @ApiProperty({ example: 1 })
  @IsOptional()
  claimantCategory!: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  claimantType!: number;

  @ApiProperty({ example: '19900101123456789000' })
  @IsOptional()
  claimantIdNumber!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  claimantIdType!: number;

  @ApiPropertyOptional({ nullable: true, example: 'M' })
  @IsOptional()
  gender?: string | null;

  @ApiProperty({ example: 'TZA' })
  @IsOptional()
  countryCode!: string;

  @ApiProperty({ example: 'Dar es Salaam' })
  @IsOptional()
  region!: string;

  @ApiProperty({ example: 'Ilala' })
  @IsOptional()
  district!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Samora Avenue' })
  @IsOptional()
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  @IsOptional()
  claimantPhoneNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  claimantFax?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'P.O. BOX 123, Dar es Salaam',
  })
  @IsOptional()
  postalAddress?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'claimant@example.com' })
  @IsOptional()
  emailAddress?: string | null;
}

export class CreateClaimNotificationDto {
  @ApiProperty({ example: 'CLM-NOT-LOCAL-001' })
  @IsOptional()
  claimNotificationNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-06T10:00:00' })
  @IsOptional()
  claimReportDate!: Date | string;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  @IsOptional()
  claimFormDullyFilled?: string | null;

  @ApiProperty({ example: '2026-06-05T21:30:00' })
  @IsOptional()
  lossDate!: Date | string;

  @ApiPropertyOptional({ nullable: true, example: 'Accident' })
  @IsOptional()
  lossNature?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Collision' })
  @IsOptional()
  lossType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Dar es Salaam' })
  @IsOptional()
  lossLocation?: string | null;

  @ApiProperty({ example: 'Mock Underwriter' })
  @IsOptional()
  officerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  @IsOptional()
  officerTitle!: string;
}

export class CreateClaimIntimationDto {
  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-06T11:00:00' })
  @IsOptional()
  claimIntimationDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: '1000000.00' })
  @IsOptional()
  claimEstimatedAmount!: string;

  @ApiProperty({ example: '800000.00' })
  @IsOptional()
  claimReserveAmount!: string;

  @ApiProperty({ example: 'Manual' })
  @IsOptional()
  claimReserveMethod!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  lossAssessmentOption!: number;

  @ApiPropertyOptional({ nullable: true, example: 'Jane Doe' })
  @IsOptional()
  assessorName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'AS12345' })
  @IsOptional()
  assessorIdNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  assessorIdType?: number | null;

  @ApiProperty({ type: () => [CreateClaimantDto] })
  @IsOptional()
  claimants!: CreateClaimantDto[];
}

export class CreateClaimAssessmentDto {
  @ApiProperty({ example: 'CLM-ASM-LOCAL-001' })
  @IsOptional()
  claimAssessmentNumber!: string;

  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-07T11:00:00' })
  @IsOptional()
  assessmentReceivedDate!: Date | string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Initial assessment complete',
  })
  @IsOptional()
  assessmentReportSummary?: string | null;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: '900000.00' })
  @IsOptional()
  assessmentAmount!: string;

  @ApiProperty({ example: '850000.00' })
  @IsOptional()
  approvedClaimAmount!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-07T15:00:00' })
  @IsOptional()
  claimApprovalDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Claims Manager' })
  @IsOptional()
  claimApprovalAuthority?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'N' })
  @IsOptional()
  isReAssessment?: string | null;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  @IsOptional()
  claimants?: CreateClaimantDto[];
}

export class CreateDischargeVoucherDto {
  @ApiProperty({ example: 'CLM-DV-LOCAL-001' })
  @IsOptional()
  dischargeVoucherNumber!: string;

  @ApiProperty({ example: 'CLM-ASM-LOCAL-001' })
  @IsOptional()
  claimAssessmentNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-08T10:00:00' })
  @IsOptional()
  dischargeVoucherDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-08T11:00:00' })
  @IsOptional()
  claimOfferCommunicationDate?: Date | string | null;

  @ApiProperty({ example: '850000.00' })
  @IsOptional()
  claimOfferAmount!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-08T14:00:00' })
  @IsOptional()
  claimantResponseDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-09T09:00:00' })
  @IsOptional()
  adjustmentDate?: Date | string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Additional salvage recovery applied',
  })
  @IsOptional()
  adjustmentReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '50000.00' })
  @IsOptional()
  adjustmentAmount?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-09T13:00:00' })
  @IsOptional()
  reconciliationDate?: Date | string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Claim settled amicably' })
  @IsOptional()
  reconciliationSummary?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '800000.00' })
  @IsOptional()
  reconciledAmount?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  @IsOptional()
  offerAccepted?: string | null;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  @IsOptional()
  claimants?: CreateClaimantDto[];
}

export class CreateClaimPaymentDto {
  @ApiProperty({ example: 'CLM-PAY-LOCAL-001' })
  @IsOptional()
  claimPaymentNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'CLM-INT-LOCAL-001' })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-10T10:00:00' })
  @IsOptional()
  paymentDate!: Date | string;

  @ApiProperty({ example: '800000.00' })
  @IsOptional()
  paidAmount!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  paymentMode!: number;

  @ApiPropertyOptional({ nullable: true, example: 'Y' })
  @IsOptional()
  partiesNotified?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '100000.00' })
  @IsOptional()
  netPremiumEarned?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'N' })
  @IsOptional()
  claimResultedLitigation?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  litigationReason?: string | null;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  @IsOptional()
  claimants?: CreateClaimantDto[];
}

export class CreateClaimRejectionDto {
  @ApiProperty({ example: 'CLM-REJ-LOCAL-001' })
  @IsOptional()
  claimRejectionNumber!: string;

  @ApiProperty({ example: 'CLM-REF-LOCAL-001' })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '2026-06-10T15:00:00' })
  @IsOptional()
  rejectionDate!: Date | string;

  @ApiProperty({ example: 'Claim is outside the policy scope' })
  @IsOptional()
  rejectionReason!: string;

  @ApiPropertyOptional({ type: () => [CreateClaimantDto] })
  @IsOptional()
  claimants?: CreateClaimantDto[];
}
