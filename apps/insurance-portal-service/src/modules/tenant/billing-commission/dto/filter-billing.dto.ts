import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class FilterBillingDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;
}
