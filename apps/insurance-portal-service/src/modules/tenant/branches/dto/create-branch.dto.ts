import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BranchAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Dar es Salaam Branch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 'DAR-001',
    description: 'Unique branch code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({
    type: BranchAddressDto,
    example: {
      street: '123 Samora Ave',
      city: 'Dar es Salaam',
      country: 'Tanzania',
    },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BranchAddressDto)
  address?: BranchAddressDto;

  @ApiPropertyOptional({ example: '+255712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'darsalaam@company.co.tz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID) of the branch manager' })
  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @ApiPropertyOptional({
    description: 'Whether this branch is the company head office',
  })
  @IsOptional()
  @IsBoolean()
  is_head_office?: boolean;
}
