import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CalculateSingleRiskPremiumDto {
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
}

export class CalculateMultiRiskPremiumDto {
  @ApiProperty({ type: [CalculateSingleRiskPremiumDto] })
  @IsArray()
  risks: CalculateSingleRiskPremiumDto[];

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
}
