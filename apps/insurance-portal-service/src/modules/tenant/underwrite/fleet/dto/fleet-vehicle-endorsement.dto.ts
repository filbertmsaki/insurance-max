import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class AddFleetVehicleDto {
  @ApiProperty({
    description:
      'TIRAMIS MotorDtl fields (camelCase, e.g. registrationNumber, chassisNumber, make, model).',
  })
  @IsObject()
  motor: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Sum insured per risk. Defaults to the template vehicle's.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;

  @ApiPropertyOptional({
    description:
      'Fleet entry of the vehicle the new one is priced like. Defaults to the first active vehicle.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  template_fleet_entry?: number;
}
