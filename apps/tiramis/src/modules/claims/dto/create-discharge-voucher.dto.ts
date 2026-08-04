import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

import { CreateClaimantDto } from './create-claim.dto';

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
  claimants?: CreateClaimantDto[] | null;
}
