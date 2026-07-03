import { PartialType } from '@nestjs/mapped-types';
import { CreateMotorPolicyDetailDto } from './create-motor-policy-detail.dto';

export class UpdateMotorPolicyDetailDto extends PartialType(
  CreateMotorPolicyDetailDto,
) {}
