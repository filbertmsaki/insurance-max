import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateMemberBranchReadAccessDto {
  @ApiProperty({
    description: 'Branch to share read access within, or null to use defaults',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  branch_id: string | null;
}
