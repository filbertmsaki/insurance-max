import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateReinsuranceParticipantDto {
  @ApiProperty({ example: 'RE001' })
  @IsOptional()
  participantCode!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  participantType!: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  reinsuranceForm!: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  reinsuranceType!: number;

  @ApiPropertyOptional({ nullable: true, example: 'BRK001' })
  @IsOptional()
  reBrokerCode?: string | null;

  @ApiProperty({ example: '5.00' })
  @IsOptional()
  brokerageCommission!: string;

  @ApiProperty({ example: '10.00' })
  @IsOptional()
  reinsuranceCommission!: string;

  @ApiProperty({ example: '50.00' })
  @IsOptional()
  premiumShare!: string;

  @ApiProperty({ example: '2026-06-06T00:00:00' })
  @IsOptional()
  participationDate!: Date | string;
}

export class CreateReinsuranceDto {
  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '118000.00' })
  @IsOptional()
  premiumIncludingTax!: string;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: 'Mock Underwriter' })
  @IsOptional()
  authorizingOfficerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  @IsOptional()
  authorizingOfficerTitle!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  reinsuranceCategory!: number;

  @ApiProperty({ type: () => [CreateReinsuranceParticipantDto] })
  @IsOptional()
  participants!: CreateReinsuranceParticipantDto[];
}
