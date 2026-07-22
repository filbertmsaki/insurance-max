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

  @IsOptional()
  @IsString()
  declare source_module?: string;
}
