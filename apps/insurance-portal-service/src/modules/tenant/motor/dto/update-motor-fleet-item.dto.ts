import { PartialType } from '@nestjs/mapped-types';
import { CreateMotorFleetItemDto } from './create-motor-fleet-item.dto';

export class UpdateMotorFleetItemDto extends PartialType(
  CreateMotorFleetItemDto,
) {}
