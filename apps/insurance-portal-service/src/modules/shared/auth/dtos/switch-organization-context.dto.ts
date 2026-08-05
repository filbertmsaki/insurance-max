import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SwitchOrganizationContextDto {
  @ApiProperty({ example: 'uuid-of-branch' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  branch_id: string;

  @ApiPropertyOptional({ example: 'uuid-of-department' })
  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
