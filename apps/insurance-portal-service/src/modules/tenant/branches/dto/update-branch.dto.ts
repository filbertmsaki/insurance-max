import { PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive';

  @ApiPropertyOptional({
    description:
      'Branch ID to reassign active users to. Required when deactivating a branch that has users with this as their active branch.',
  })
  @IsOptional()
  @IsUUID()
  replacement_branch_id?: string;
}
