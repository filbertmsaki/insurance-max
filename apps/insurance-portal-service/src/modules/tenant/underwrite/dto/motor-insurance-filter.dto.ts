import { IsIn, IsOptional } from 'class-validator';
import { FilterPolicyDto } from '../../policies/dto/filter-policy.dto';
import { FilterQuotationDto } from '../../quotations/dto/filter-quotation.dto';

export const MOTOR_INSURANCE_TYPES = ['single', 'fleet'] as const;

export class MotorInsuranceQuotationFilterDto extends FilterQuotationDto {
  @IsOptional()
  @IsIn(MOTOR_INSURANCE_TYPES)
  type?: (typeof MOTOR_INSURANCE_TYPES)[number];
}

export class MotorInsurancePolicyFilterDto extends FilterPolicyDto {
  @IsOptional()
  @IsIn(MOTOR_INSURANCE_TYPES)
  type?: (typeof MOTOR_INSURANCE_TYPES)[number];
}
