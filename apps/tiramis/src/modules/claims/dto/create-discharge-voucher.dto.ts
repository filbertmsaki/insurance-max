import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CreateClaimantDto } from './create-claim.dto';

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

  @ApiPropertyOptional({
    nullable: true,
    example: 'Additional salvage recovery applied',
  })
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
  claimants?: CreateClaimantDto[] | null;
}
