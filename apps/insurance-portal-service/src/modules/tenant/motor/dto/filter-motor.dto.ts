import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterMotorDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  motor_category?: string;

  @IsOptional()
  @IsString()
  motor_usage?: string;

  @IsOptional()
  @IsString()
  verification_status?: string;
}
