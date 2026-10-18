import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MOTOR_VEHICLE_SEARCH_MAX_LIMIT = 50;

/** Single-box registration / chassis lookup used by the quotation wizards. */
export class SearchMotorVehiclesDto {
  @ApiPropertyOptional({
    example: 'T 123 ABC',
    description:
      'Registration or chassis number (spaces, hyphens and case are ignored)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Ranks this customer's vehicles first; it does not filter the results. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MOTOR_VEHICLE_SEARCH_MAX_LIMIT)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
