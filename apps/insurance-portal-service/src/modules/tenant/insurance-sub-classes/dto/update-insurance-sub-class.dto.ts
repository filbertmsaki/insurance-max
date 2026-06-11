import { PartialType } from '@nestjs/swagger';
import { CreateInsuranceSubClassDto } from './create-insurance-sub-class.dto';

export class UpdateInsuranceSubClassDto extends PartialType(
  CreateInsuranceSubClassDto,
) {}
