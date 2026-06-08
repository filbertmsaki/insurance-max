import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

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
}
