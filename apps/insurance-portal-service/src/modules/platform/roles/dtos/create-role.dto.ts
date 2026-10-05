import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleScope } from '@insurance-max/contracts';
import { RolePermissionDataScopeDto } from './role-permission-data-scope.dto';

export class CreateRoleDto {
  @Transform(({ value }) =>
    String(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  display_name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Company scope for the role. Omit for company users; owners can create global or company-scoped roles.',
    type: String,
  })
  @IsUUID()
  @IsOptional()
  company_id?: string;

  @ApiPropertyOptional({
    description: 'Role scope. Only the platform owner may set this explicitly.',
    enum: Object.values(RoleScope),
  })
  @IsEnum(RoleScope)
  @IsOptional()
  scope?: RoleScope;

  @ApiPropertyOptional({
    description:
      'Marks the role as system-generated and protected from non-owner mutations. Platform owner only.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_system_generated?: boolean;

  @ApiPropertyOptional({
    description:
      'Marks the role as administrative (grants elevated company access). Platform owner only.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_administrative?: boolean;

  @ApiPropertyOptional({
    description:
      'Permission IDs to attach to the role. Must be global or from the same company scope as the role.',
    type: [String],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  @IsOptional()
  permission_ids?: string[];

  @ApiPropertyOptional({ type: [RolePermissionDataScopeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionDataScopeDto)
  @IsOptional()
  permission_data_scopes?: RolePermissionDataScopeDto[];
}
