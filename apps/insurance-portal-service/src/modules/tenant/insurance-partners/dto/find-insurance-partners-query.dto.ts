import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { PartnerType } from '../enums/partner-type.enum';
import { PartnerRelationshipStatus } from '../enums/partner-relationship-status.enum';

export class FindInsurancePartnersQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: PartnerRelationshipStatus })
  @IsOptional()
  @IsEnum(PartnerRelationshipStatus)
  status?: PartnerRelationshipStatus;

  @ApiPropertyOptional({ enum: PartnerType })
  @IsOptional()
  @IsEnum(PartnerType)
  partner_type?: PartnerType;
}
