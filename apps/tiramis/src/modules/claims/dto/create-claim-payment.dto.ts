import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimPaymentClaimantDto {
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

export class CreateClaimPaymentDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'PAY-2026-00001',
    description: 'Claim payment number as per insurer',
  })
  claimPaymentNumber!: string;

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
    example: '2026-07-05T18:30:00',
  })
  paymentDate!: Date | string;

  @ApiProperty({ example: '1100000.00' })
  paidAmount!: string;

  @ApiProperty({
    example: '3',
    description: '1 = Cash, 2 = Cheque, 3 = EFT',
  })
  paymentMode!: string;

  @ApiProperty({
    example: 'Y',
    enum: ['Y', 'N'],
    description: 'Y = parties notified, N = parties not notified',
  })
  partiesNotified!: 'Y' | 'N';

  @ApiProperty({ example: '800000.00' })
  netPremiumEarned!: string;

  @ApiProperty({
    example: 'N',
    enum: ['Y', 'N'],
    description: 'Y = claim resulted in litigation, N = no litigation',
  })
  claimResultedLitigation!: 'Y' | 'N';

  @ApiProperty({
    example: 'No litigation resulted from this claim.',
  })
  litigationReason!: string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ type: () => [CreateClaimPaymentClaimantDto] })
  claimants!: CreateClaimPaymentClaimantDto[];
}
