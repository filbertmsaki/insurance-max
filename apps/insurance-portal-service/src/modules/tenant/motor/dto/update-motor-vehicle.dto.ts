import { PartialType } from '@nestjs/mapped-types';
import { CreateMotorVehicleDto } from './create-motor-vehicle.dto';

export class UpdateMotorVehicleDto extends PartialType(CreateMotorVehicleDto) {}
