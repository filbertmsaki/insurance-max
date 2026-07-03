import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class FilterNonMotorDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;
}
