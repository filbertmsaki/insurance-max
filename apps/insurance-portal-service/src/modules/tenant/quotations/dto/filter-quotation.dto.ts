import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export class FilterQuotationDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  product_id?: string;
}

