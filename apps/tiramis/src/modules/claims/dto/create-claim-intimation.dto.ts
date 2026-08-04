import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateClaimIntimationClaimantDto {
  @ApiProperty({ example: 'Augustino Aidan Mwageni' })
  @IsOptional()
  claimantName!: string;

  @ApiPropertyOptional({ example: '1990-02-05' })
  @IsOptional()
  claimantBirthDate?: Date | string | null;

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

  @ApiPropertyOptional({
    example: 'M',
    enum: ['M', 'F'],
  })
  @IsOptional()
  gender?: 'M' | 'F' | '' | null;

  @ApiProperty({
    example: 'TZA',
    description: 'ISO 3166 alpha-3 country code',
  })
  @IsOptional()
  countryCode!: string;

  @ApiPropertyOptional({ example: 'Dar es Salaam' })
  @IsOptional()
  region?: string | null;

  @ApiProperty({ example: 'Ilala' })
  @IsOptional()
  district!: string;

  @ApiPropertyOptional({ example: 'Samora Avenue' })
  @IsOptional()
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  @IsOptional()
  claimantPhoneNumber!: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  claimantFax?: string | null;

  @ApiPropertyOptional({ example: 'P.O. Box 1000' })
  @IsOptional()
  postalAddress?: string | null;

  @ApiPropertyOptional({ example: 'claimant@example.com' })
  @IsOptional()
  emailAddress?: string | null;
}

export class CreateClaimIntimationDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  @IsOptional()
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number as per insurer',
  })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description:
      'Claim reference number received from Claim Notification final response',
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
    example: '2026-07-05T11:30:00',
    description: 'Claim intimation date and time',
  })
  @IsOptional()
  claimIntimationDate!: Date | string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: '2000000.00' })
  @IsOptional()
  claimEstimatedAmount!: string;

  @ApiProperty({ example: '1000000.00' })
  @IsOptional()
  claimReserveAmount!: string;

  @ApiProperty({ example: 'Chain Ladder' })
  @IsOptional()
  claimReserveMethod!: string;

  @ApiProperty({
    example: 1,
    description:
      '1 = In-house insurer employee, 2 = External registered insurance adjuster',
  })
  @IsOptional()
  lossAssessmentOption!: number;

  @ApiProperty({ example: 'Baraka Kiswigu' })
  @IsOptional()
  assessorName!: string;

  @ApiProperty({ example: '124214114' })
  @IsOptional()
  assessorIdNumber!: string;

  @ApiProperty({
    example: 1,
    description:
      '1=NIN, 2=Voter ID, 3=Passport, 4=Driving License, 5=ZANID, 6=TIN, 7=Company Incorporation Certificate',
  })
  @IsOptional()
  assessorIdType!: number;

  @ApiProperty({ type: () => [CreateClaimIntimationClaimantDto] })
  @IsOptional()
  claimants!: CreateClaimIntimationClaimantDto[];
}
