import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AssignBranchUserDto {
  @ApiProperty({
    description: 'The company_users.id of the user to assign to this branch',
  })
  @IsUUID()
  @IsNotEmpty()
  company_user_id: string;

  @ApiPropertyOptional({
    description: 'Mark this as the primary branch for this user',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ description: 'Make this branch the user active branch' })
  @IsOptional()
  @IsBoolean()
  make_active?: boolean;

  @ApiPropertyOptional({ description: 'Bulk company membership IDs to assign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  company_user_ids?: string[];
}
