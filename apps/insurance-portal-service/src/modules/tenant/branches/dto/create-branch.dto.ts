import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export interface BranchAddressDto {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
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

  @ApiPropertyOptional({ example: 'SP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sale_point_code?: string;

  @ApiPropertyOptional({ example: 'Main Sale Point' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  sale_point_name?: string;

  @ApiPropertyOptional({
    type: Object,
    example: {
      street: '123 Samora Ave',
      city: 'Dar es Salaam',
      country: 'Tanzania',
    },
  })
  @IsOptional()
  @IsObject()
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
}
