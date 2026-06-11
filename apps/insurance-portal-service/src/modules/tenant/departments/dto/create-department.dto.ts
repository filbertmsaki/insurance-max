import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Claims Department' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 'CLAIMS',
    description: 'Unique department code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Handles all insurance claims processing' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Branch UUID this department belongs to',
  })
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
