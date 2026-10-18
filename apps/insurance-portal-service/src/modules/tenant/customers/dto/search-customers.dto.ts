import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CUSTOMER_SEARCH_MAX_LIMIT = 50;

/** Single-box lookup used by the quotation wizards. */
export class SearchCustomersDto {
  @ApiPropertyOptional({
    example: '0712 345 678',
    description: 'Name, phone number, ID number or customer number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CUSTOMER_SEARCH_MAX_LIMIT)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
