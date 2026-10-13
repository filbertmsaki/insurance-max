import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

export class FindCompaniesQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({ enum: ['PENDING_REVIEW', 'VERIFIED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'VERIFIED', 'REJECTED'])
  verification_status?: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional({ enum: CompanyType })
  @IsOptional()
  @IsEnum(CompanyType)
  company_type?: CompanyType;
}
