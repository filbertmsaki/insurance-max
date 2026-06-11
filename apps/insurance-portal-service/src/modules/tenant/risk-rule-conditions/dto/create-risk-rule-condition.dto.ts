import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';

export class CreateRiskRuleConditionDto {
  @ApiProperty({ description: 'Risk rating rule UUID' })
  @IsUUID()
  @IsNotEmpty()
  rule_id: string;

  @ApiProperty({ example: 'vehicle_age', description: 'Rating factor code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  factor_code: string;

  @ApiProperty({ enum: ConditionOperator, example: ConditionOperator.BETWEEN })
  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @ApiPropertyOptional({
    example: '1',
    description:
      'Lower bound value (required for BETWEEN; value for EQUALS etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  value_from?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Upper bound value (required for BETWEEN)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  value_to?: string;

  @ApiPropertyOptional({
    enum: LogicalOperator,
    default: LogicalOperator.AND,
    description: 'How this condition combines with the next',
  })
  @IsOptional()
  @IsEnum(LogicalOperator)
  logical_operator?: LogicalOperator;
}
