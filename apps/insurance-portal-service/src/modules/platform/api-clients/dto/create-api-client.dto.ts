import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiClientDto {
  @ApiProperty({ example: 'Mobile App Integration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: ['policies:read', 'claims:create'], isArray: true })
  @IsOptional()
  scopes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
