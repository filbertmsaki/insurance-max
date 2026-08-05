import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Product identity updates only. Product terms (name, description,
 * business line, fleet support, wording, TIRAMIS product code) are
 * changed through product versions and lifecycle endpoints, not here.
 */
export class UpdateInsuranceProductDto {
  @ApiPropertyOptional({
    description: 'Only permitted before the product has been published',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Only permitted before the product has been published',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/)
  product_code?: string;
}
