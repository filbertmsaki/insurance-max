import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class UpdateDepartmentStatusDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive'])
  @IsOptional()
  status: 'active' | 'inactive';
}
