import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompanyAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;
}
