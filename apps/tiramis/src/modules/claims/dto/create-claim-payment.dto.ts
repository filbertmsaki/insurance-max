import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateClaimPaymentClaimantDto {
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

export class CreateClaimPaymentDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  @IsOptional()
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'PAY-2026-00001',
    description: 'Claim payment number as per insurer',
  })
  @IsOptional()
  claimPaymentNumber!: string;

  @ApiProperty({
    example: 'TIRA-CLM-REF-000001',
    description: 'Claim reference number received from TIRA',
  })
  @IsOptional()
  claimReferenceNumber!: string;

  @ApiProperty({
    example: 'CLM-INT-2026-00001',
    description: 'Claim intimation number',
  })
  @IsOptional()
  claimIntimationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T18:30:00',
  })
  @IsOptional()
  paymentDate!: Date | string;

  @ApiProperty({ example: '1100000.00' })
  @IsOptional()
  paidAmount!: string;

  @ApiProperty({
    example: '3',
    description: '1 = Cash, 2 = Cheque, 3 = EFT',
  })
  @IsOptional()
  paymentMode!: string;

  @ApiProperty({
    example: 'Y',
    enum: ['Y', 'N'],
    description: 'Y = parties notified, N = parties not notified',
  })
  @IsOptional()
  partiesNotified!: 'Y' | 'N';

  @ApiProperty({ example: '800000.00' })
  @IsOptional()
  netPremiumEarned!: string;

  @ApiProperty({
    example: 'N',
    enum: ['Y', 'N'],
    description: 'Y = claim resulted in litigation, N = no litigation',
  })
  @IsOptional()
  claimResultedLitigation!: 'Y' | 'N';

  @ApiProperty({
    example: 'No litigation resulted from this claim.',
  })
  @IsOptional()
  litigationReason!: string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ type: () => [CreateClaimPaymentClaimantDto] })
  @IsOptional()
  claimants!: CreateClaimPaymentClaimantDto[];
}
