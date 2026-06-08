import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReinsuranceParticipantDto {
  @ApiProperty({ example: 'RE001' })
  participantCode!: string;

  @ApiProperty({ example: 1 })
  participantType!: number;

  @ApiProperty({ example: 1 })
  reinsuranceForm!: number;

  @ApiProperty({ example: 1 })
  reinsuranceType!: number;

  @ApiPropertyOptional({ nullable: true, example: 'BRK001' })
  reBrokerCode?: string | null;

  @ApiProperty({ example: '5.00' })
  brokerageCommission!: string;

  @ApiProperty({ example: '10.00' })
  reinsuranceCommission!: string;

  @ApiProperty({ example: '50.00' })
  premiumShare!: string;

  @ApiProperty({ example: '2026-06-06T00:00:00' })
  participationDate!: Date | string;
}

export class CreateReinsuranceDto {
  @ApiProperty({ example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '118000.00' })
  premiumIncludingTax!: string;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: 'Mock Underwriter' })
  authorizingOfficerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  authorizingOfficerTitle!: string;

  @ApiProperty({ example: 1 })
  reinsuranceCategory!: number;

  @ApiProperty({ type: () => [CreateReinsuranceParticipantDto] })
  participants!: CreateReinsuranceParticipantDto[];
}
