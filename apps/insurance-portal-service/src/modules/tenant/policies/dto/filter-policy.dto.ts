import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';

export class FilterPolicyDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsString()
  policy_status?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;
}
