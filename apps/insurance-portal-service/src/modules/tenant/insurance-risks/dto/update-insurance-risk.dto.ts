import { PartialType } from '@nestjs/swagger';
import { CreateInsuranceRiskDto } from './create-insurance-risk.dto';

export class UpdateInsuranceRiskDto extends PartialType(
  CreateInsuranceRiskDto,
) {}
