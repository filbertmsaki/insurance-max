import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

export class GrantCompanyUserPermissionDto {
  @ApiProperty({ description: 'Permission catalog record UUID' })
  @IsUUID()
  permission_id: string;

  @ApiProperty({ enum: QuotationPolicyDataScope })
  @IsEnum(QuotationPolicyDataScope)
  data_scope: QuotationPolicyDataScope;

  @ApiPropertyOptional({
    description: 'Required only when narrowing the grant to one branch',
  })
  @IsUUID()
  @IsOptional()
  scope_branch_id?: string;

  @ApiPropertyOptional({
    description: 'Required only when narrowing the grant to one department',
  })
  @IsUUID()
  @IsOptional()
  scope_department_id?: string;
}
