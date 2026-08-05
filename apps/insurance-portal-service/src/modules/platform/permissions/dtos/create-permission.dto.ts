import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PermissionAssignmentScope } from '@insurance-max/contracts';

export class CreatePermissionDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/, {
    message: 'New permission names must use resource:action format',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  display_name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Which actor scope this permission applies to.',
    enum: Object.values(PermissionAssignmentScope),
  })
  @IsEnum(PermissionAssignmentScope)
  assignment_scope: PermissionAssignmentScope;

  @ApiPropertyOptional({
    description:
      'Whether the permission can be attached to company (tenant) roles.',
  })
  @IsBoolean()
  assignable_to_company_role: boolean;

  @ApiPropertyOptional({
    description: 'Whether the permission can be attached to platform roles.',
  })
  @IsBoolean()
  assignable_to_platform_role: boolean;
}
