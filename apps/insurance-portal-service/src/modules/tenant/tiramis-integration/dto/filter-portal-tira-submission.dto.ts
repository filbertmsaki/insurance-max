import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';

export class FilterPortalTiraSubmissionDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsString()
  declare status?: string;

  @IsOptional()
  @IsString()
  declare policy_id?: string;

  @IsOptional()
  @IsString()
  declare quotation_id?: string;

  @IsOptional()
  @IsString()
  declare request_id?: string;

  @IsOptional()
  @IsString()
  declare business_reference?: string;

  @ApiPropertyOptional({
    example: 'quotations',
    description: 'Filter by source module',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value)
  declare source_module?: string;

  @ApiPropertyOptional({
    example: 'quotations',
    description: 'Alias for source_module',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.source_module)
  declare sourceModule?: string;

}
