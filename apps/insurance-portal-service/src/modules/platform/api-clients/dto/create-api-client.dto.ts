import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiClientType, DeploymentEnvironment } from '@insurance-max/contracts';

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

  @ApiProperty({
    required: false,
    enum: ApiClientType,
    default: ApiClientType.TENANT_INTEGRATION,
  })
  @IsOptional()
  @IsEnum(ApiClientType)
  client_type?: ApiClientType;

  @ApiProperty({
    required: false,
    enum: DeploymentEnvironment,
    default: DeploymentEnvironment.PRODUCTION,
  })
  @IsOptional()
  @IsEnum(DeploymentEnvironment)
  environment?: DeploymentEnvironment;

  @ApiProperty({ required: false, example: ['10.0.0.10', '203.0.113.5'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ip_whitelist?: string[];

  @ApiProperty({ required: false, example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rate_limit_per_minute?: number;
}
