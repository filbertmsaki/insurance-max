import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CompanyAddressDto } from './company-address.dto';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  contact_email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-().]{7,30}$/, {
    message: 'contact_phone must be a valid phone number',
  })
  contact_phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: true }, { message: 'website must be a valid URL' })
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo_url?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  address?: CompanyAddressDto;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateCompanyStatusDto {
  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive';
}
