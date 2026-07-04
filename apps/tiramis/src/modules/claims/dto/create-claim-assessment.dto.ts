import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimAssessmentClaimantDto {
  @ApiPropertyOptional({
    example: 2,
    description: '1 = Policyholder, 2 = Third Party',
  })
  claimantCategory?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: '1 = Individual, 2 = Corporate',
  })
  claimantType?: number | null;

  @ApiPropertyOptional({ example: '24241241' })
  claimantIdNumber?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      '1=NIN, 2=Voter ID, 3=Passport, 4=Driving License, 5=ZANID, 6=TIN, 7=Company Incorporation Certificate',
  })
  claimantIdType?: number | null;
}

export class CreateClaimAssessmentDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-ASM-2026-00001',
    description: 'Claim assessment number as per insurer',
  })
  claimAssessmentNumber!: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number',
  })
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description: 'Claim reference number received from TIRA',
  })
  claimReferenceNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T12:30:00',
  })
  assessmentReceivedDate!: Date | string;

  @ApiProperty({
    example: 'Assessment confirms partial property damage caused by fire.',
  })
  assessmentReportSummary!: string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: '1500000.00' })
  assessmentAmount!: string;

  @ApiProperty({ example: '1200000.00' })
  approvedClaimAmount!: string;

  @ApiProperty({
    example: '2026-07-05T14:30:00',
  })
  claimApprovalDate!: Date | string;

  @ApiProperty({
    example: 'CEO',
  })
  claimApprovalAuthority!: string;

  @ApiProperty({
    example: 'N',
    enum: ['Y', 'N'],
    description: 'Y = Yes, N = No',
  })
  isReAssessment!: 'Y' | 'N';

  @ApiProperty({ type: () => [CreateClaimAssessmentClaimantDto] })
  claimants!: CreateClaimAssessmentClaimantDto[];
}
