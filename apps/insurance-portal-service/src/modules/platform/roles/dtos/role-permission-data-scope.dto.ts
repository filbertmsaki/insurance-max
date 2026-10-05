import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

export class RolePermissionDataScopeDto {
  @ApiProperty({ description: 'Permission catalog record UUID' })
  @IsUUID()
  permission_id: string;

  @ApiProperty({ enum: QuotationPolicyDataScope })
  @IsEnum(QuotationPolicyDataScope)
  data_scope: QuotationPolicyDataScope;
}
