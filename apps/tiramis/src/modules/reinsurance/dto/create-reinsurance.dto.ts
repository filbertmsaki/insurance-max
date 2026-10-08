import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DECIMAL_AMOUNT = /^\d{1,34}(?:\.\d{1,2})?$/;

export class CreateReinsuranceParticipantDto {
  @ApiProperty({ example: 'RE001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  participantCode!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  participantType!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reinsuranceForm!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reinsuranceType!: number;

  @ApiPropertyOptional({ nullable: true, example: 'BRK001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reBrokerCode?: string | null;

  @ApiProperty({ example: '5.00' })
  @IsString()
  @Matches(DECIMAL_AMOUNT)
  brokerageCommission!: string;

  @ApiProperty({ example: '10.00' })
  @IsString()
  @Matches(DECIMAL_AMOUNT)
  reinsuranceCommission!: string;

  @ApiProperty({ example: '50.00' })
  @IsString()
  @Matches(DECIMAL_AMOUNT)
  premiumShare!: string;

  @ApiProperty({ example: '2026-06-06T00:00:00' })
  @IsDateString()
  participationDate!: Date | string;
}

export class CreateReinsuranceDto {
  @ApiProperty({ example: 'TIRA-CN-000001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  coverNoteReferenceNumber!: string;

  @ApiProperty({ example: '118000.00' })
  @IsString()
  @Matches(DECIMAL_AMOUNT)
  premiumIncludingTax!: string;

  @ApiProperty({ example: 'TZS' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsString()
  @Matches(DECIMAL_AMOUNT)
  exchangeRate!: string;

  @ApiProperty({ example: 'Mock Underwriter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authorizingOfficerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authorizingOfficerTitle!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reinsuranceCategory!: number;

  @ApiProperty({ type: () => [CreateReinsuranceParticipantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReinsuranceParticipantDto)
  participants!: CreateReinsuranceParticipantDto[];
}
