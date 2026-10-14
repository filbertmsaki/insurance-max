import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UnderwriteLine } from '@insurance-max/contracts';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { CustomerStatus } from '../enums/customer-status.enum';
import { CustomerType } from '../enums/customer-type.enum';

export class FilterCustomerDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  customer_type?: CustomerType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  /** Only customers with a quotation or policy in this underwrite line. */
  @IsOptional()
  @IsEnum(UnderwriteLine)
  business_line?: UnderwriteLine;
}
