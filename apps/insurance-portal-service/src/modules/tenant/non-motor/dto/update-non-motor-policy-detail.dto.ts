import { PartialType } from '@nestjs/mapped-types';
import { CreateNonMotorPolicyDetailDto } from './create-non-motor-policy-detail.dto';

export class UpdateNonMotorPolicyDetailDto extends PartialType(
  CreateNonMotorPolicyDetailDto,
) {}
