import { PartialType } from '@nestjs/swagger';
import { CreateRiskRequiredFactorDto } from './create-risk-required-factor.dto';

export class UpdateRiskRequiredFactorDto extends PartialType(
  CreateRiskRequiredFactorDto,
) {}
