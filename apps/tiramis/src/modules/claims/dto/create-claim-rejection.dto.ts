import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimRejectionClaimantDto {
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

export class CreateClaimRejectionDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'REJ-2026-00001',
    description: 'Claim rejection number as per insurer',
  })
  claimRejectionNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description: 'Claim reference number received from TIRA',
  })
  claimReferenceNumber!: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number',
  })
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T19:30:00',
  })
  rejectionDate!: Date | string;

  @ApiProperty({
    example:
      'Claim rejected because required supporting documents were not provided.',
  })
  rejectionReason!: string;

  @ApiProperty({
    example: 'N',
    enum: ['Y', 'N'],
    description: 'Y = claim resulted in litigation, N = no litigation',
  })
  claimResultedLitigation!: 'Y' | 'N';

  @ApiProperty({ example: '1100000.00' })
  claimAmount!: string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ type: () => [CreateClaimRejectionClaimantDto] })
  claimants!: CreateClaimRejectionClaimantDto[];
}
