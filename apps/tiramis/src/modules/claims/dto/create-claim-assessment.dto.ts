import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateClaimAssessmentClaimantDto {
  @ApiPropertyOptional({
    example: 2,
    description: '1 = Policyholder, 2 = Third Party',
  })
  @IsOptional()
  claimantCategory?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: '1 = Individual, 2 = Corporate',
  })
  @IsOptional()
  claimantType?: number | null;

  @ApiPropertyOptional({ example: '24241241' })
  @IsOptional()
  claimantIdNumber?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      '1=NIN, 2=Voter ID, 3=Passport, 4=Driving License, 5=ZANID, 6=TIN, 7=Company Incorporation Certificate',
  })
  @IsOptional()
  claimantIdType?: number | null;
}

export class CreateClaimAssessmentDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  @IsOptional()
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-ASM-2026-00001',
    description: 'Claim assessment number as per insurer',
  })
  @IsOptional()
  claimAssessmentNumber!: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number',
  })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description: 'Claim reference number received from TIRA',
  })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T12:30:00',
  })
  @IsOptional()
  assessmentReceivedDate!: Date | string;

  @ApiProperty({
    example: 'Assessment confirms partial property damage caused by fire.',
  })
  @IsOptional()
  assessmentReportSummary!: string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: '1500000.00' })
  @IsOptional()
  assessmentAmount!: string;

  @ApiProperty({ example: '1200000.00' })
  @IsOptional()
  approvedClaimAmount!: string;

  @ApiProperty({
    example: '2026-07-05T14:30:00',
  })
  @IsOptional()
  claimApprovalDate!: Date | string;

  @ApiProperty({
    example: 'CEO',
  })
  @IsOptional()
  claimApprovalAuthority!: string;

  @ApiProperty({
    example: 'N',
    enum: ['Y', 'N'],
    description: 'Y = Yes, N = No',
  })
  @IsOptional()
  isReAssessment!: 'Y' | 'N';

  @ApiProperty({ type: () => [CreateClaimAssessmentClaimantDto] })
  @IsOptional()
  claimants!: CreateClaimAssessmentClaimantDto[];
}
