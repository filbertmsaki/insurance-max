import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';

export class CalculateSingleRiskPremiumDto {
  @ApiPropertyOptional({
    example: 'VEHICLE-001',
    description:
      'Optional client-provided identifier echoed back in pricing responses.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  client_reference?: string;

  @ApiProperty({ description: 'Insurance risk UUID' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

  @ApiProperty({
    example: 10000000,
    description:
      'Sum insured used for percentage calculations. This is preferred over embedding sum_insured inside factors.',
  })
  @IsNumber()
  sum_insured: number;

  @ApiProperty({
    type: Object,
    example: {
      seat_capacity: 10,
      vehicle_weight: 7,
      claim_record: 'NO_CLAIM',
    },
    description:
      'Map of factor_code to value. All required factors must be provided.',
  })
  @IsObject()
  factors: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Deprecated alias for factors. If present, values are merged with factors.',
  })
  @IsOptional()
  @IsObject()
  factor_values?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    example: '2026-07-27',
    description:
      'Optional charge-rule effective date. Defaults to the server date when omitted.',
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({
    enum: QuotationType,
    description:
      'Optional quotation type context for snapshot storage and downstream pricing governance.',
  })
  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @ApiPropertyOptional({
    example: 'TZS',
    description:
      'Optional currency context stored with the pricing quote snapshot.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;
}

export class CalculateMultiRiskPremiumDto {
  @ApiProperty({ type: [CalculateSingleRiskPremiumDto] })
  @IsArray()
  risks: CalculateSingleRiskPremiumDto[];

  @ApiPropertyOptional({
    example: 'MOTOR',
    description: 'Optional product code context for fleet or batch pricing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  product_code?: string;

  @ApiPropertyOptional({
    example: '2026-07-27',
    description:
      'Optional effective date context stored with the batch pricing request.',
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({ description: 'Company user UUID for access check' })
  @IsOptional()
  @IsUUID()
  company_user_id?: string;

  @ApiPropertyOptional({ description: 'Branch UUID for access context' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Department UUID for access context' })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiPropertyOptional({
    enum: QuotationType,
    description:
      'Optional quotation type context for snapshot storage and downstream pricing governance.',
  })
  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @ApiPropertyOptional({
    example: 'TZS',
    description:
      'Optional currency context stored with the pricing quote snapshot.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;
}
