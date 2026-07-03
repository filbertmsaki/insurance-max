import { PartialType } from '@nestjs/mapped-types';
import { CreateMotorFleetDto } from './create-motor-fleet.dto';

export class UpdateMotorFleetDto extends PartialType(CreateMotorFleetDto) {}
