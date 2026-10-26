import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MotorCoverClass } from '@insurance-max/contracts';

export class CreateInsuranceRiskDto {
  @ApiProperty({ description: 'Insurance product UUID this risk belongs to' })
  @IsUUID()
  @IsNotEmpty()
  product_id: string;

  @ApiPropertyOptional({ description: 'Insurance sub-class UUID (optional)' })
  @IsOptional()
  @IsUUID()
  sub_class_id?: string;

  @ApiProperty({
    example: 'MOTOR-COMP-001',
    description: 'Unique risk code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  risk_code: string;

  @ApiProperty({
    example: 'Comprehensive Motor Risk',
    description: 'Risk display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  risk_name: string;

  @ApiPropertyOptional({ example: 'Covers loss or damage to motor vehicles' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: Object.values(MotorCoverClass),
    nullable: true,
    description:
      'Motor cover class; counts towards the TIRAMIS fleet comprehensive total',
  })
  @IsOptional()
  @IsIn([...Object.values(MotorCoverClass), null])
  cover_class?: MotorCoverClass | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
