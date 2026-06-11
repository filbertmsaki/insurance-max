import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive';
}
