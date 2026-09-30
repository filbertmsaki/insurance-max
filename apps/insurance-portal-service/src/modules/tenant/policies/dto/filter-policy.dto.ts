import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UnderwriteLine } from '@insurance-max/contracts';
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

  @IsOptional()
  @IsEnum(UnderwriteLine)
  business_line?: UnderwriteLine;
}
