import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AccessStatus } from '@insurance-max/portal-shared/enums/access-status.enum';

export class UpsertBranchCategoryAccessDto {
  @ApiProperty({ description: 'Branch UUID' })
  @IsUUID()
  @IsNotEmpty()
  branch_id: string;

  @ApiProperty({ description: 'Insurance category UUID' })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_view?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_create_policy?: boolean;

  @ApiPropertyOptional({ enum: AccessStatus, default: AccessStatus.ALLOW })
  @IsOptional()
  @IsEnum(AccessStatus)
  access_status?: AccessStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertDepartmentCategoryAccessDto {
  @ApiProperty({ description: 'Department UUID' })
  @IsUUID()
  @IsNotEmpty()
  department_id: string;

  @ApiProperty({ description: 'Insurance category UUID' })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_view?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_create_policy?: boolean;

  @ApiPropertyOptional({ enum: AccessStatus, default: AccessStatus.ALLOW })
  @IsOptional()
  @IsEnum(AccessStatus)
  access_status?: AccessStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertUserCategoryAccessDto {
  @ApiProperty({ description: 'Company user UUID (membership ID)' })
  @IsUUID()
  @IsNotEmpty()
  company_user_id: string;

  @ApiProperty({ description: 'Insurance category UUID' })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_view?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_create_policy?: boolean;

  @ApiPropertyOptional({ enum: AccessStatus, default: AccessStatus.ALLOW })
  @IsOptional()
  @IsEnum(AccessStatus)
  access_status?: AccessStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ResolveAccessDto {
  @ApiProperty({ description: 'Category UUID to resolve access for' })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({ description: 'Company user UUID (membership ID)' })
  @IsUUID()
  @IsNotEmpty()
  company_user_id: string;

  @ApiPropertyOptional({ description: 'Branch UUID for the context' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Department UUID for the context' })
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
