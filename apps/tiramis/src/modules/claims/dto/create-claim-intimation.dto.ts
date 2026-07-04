import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimIntimationClaimantDto {
  @ApiProperty({ example: 'Augustino Aidan Mwageni' })
  claimantName!: string;

  @ApiPropertyOptional({ example: '1990-02-05' })
  claimantBirthDate?: Date | string | null;

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

  @ApiPropertyOptional({
    example: 'M',
    enum: ['M', 'F'],
  })
  gender?: 'M' | 'F' | '' | null;

  @ApiProperty({
    example: 'TZA',
    description: 'ISO 3166 alpha-3 country code',
  })
  countryCode!: string;

  @ApiPropertyOptional({ example: 'Dar es Salaam' })
  region?: string | null;

  @ApiProperty({ example: 'Ilala' })
  district!: string;

  @ApiPropertyOptional({ example: 'Samora Avenue' })
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  claimantPhoneNumber!: string;

  @ApiPropertyOptional({ example: '' })
  claimantFax?: string | null;

  @ApiPropertyOptional({ example: 'P.O. Box 1000' })
  postalAddress?: string | null;

  @ApiPropertyOptional({ example: 'claimant@example.com' })
  emailAddress?: string | null;
}

export class CreateClaimIntimationDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number as per insurer',
  })
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description:
      'Claim reference number received from Claim Notification final response',
  })
  claimReferenceNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T11:30:00',
    description: 'Claim intimation date and time',
  })
  claimIntimationDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: '2000000.00' })
  claimEstimatedAmount!: string;

  @ApiProperty({ example: '1000000.00' })
  claimReserveAmount!: string;

  @ApiProperty({ example: 'Chain Ladder' })
  claimReserveMethod!: string;

  @ApiProperty({
    example: 1,
    description:
      '1 = In-house insurer employee, 2 = External registered insurance adjuster',
  })
  lossAssessmentOption!: number;

  @ApiProperty({ example: 'Baraka Kiswigu' })
  assessorName!: string;

  @ApiProperty({ example: '124214114' })
  assessorIdNumber!: string;

  @ApiProperty({
    example: 1,
    description:
      '1=NIN, 2=Voter ID, 3=Passport, 4=Driving License, 5=ZANID, 6=TIN, 7=Company Incorporation Certificate',
  })
  assessorIdType!: number;

  @ApiProperty({ type: () => [CreateClaimIntimationClaimantDto] })
  claimants!: CreateClaimIntimationClaimantDto[];
}
