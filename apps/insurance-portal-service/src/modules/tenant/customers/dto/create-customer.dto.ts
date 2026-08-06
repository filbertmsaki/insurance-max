import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  IsArray,
  Length,
  MaxLength,
  ValidateIf,
  IsEmail,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { CustomerDocumentType } from '../enums/customer-document-type.enum';
import { CustomerGender } from '../enums/customer-gender.enum';
import { CustomerKycStatus } from '../enums/customer-kyc-status.enum';
import { CustomerStatus } from '../enums/customer-status.enum';
import { CustomerType } from '../enums/customer-type.enum';

export class CustomerIdentifierDto {
  @IsString()
  @MaxLength(50)
  identifier_type: string;

  @IsString()
  @MaxLength(150)
  identifier_value: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  country_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @IsOptional()
  @IsDateString()
  issued_at?: string | null;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class CustomerAddressDto {
  @IsString()
  @MaxLength(40)
  address_type: string;

  @IsString()
  @Length(3, 3)
  country_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsString()
  @MaxLength(100)
  region: string;

  @IsString()
  @MaxLength(100)
  district: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  street?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  postal_address?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number | null;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class CustomerContactDto {
  @IsString()
  @MaxLength(30)
  contact_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_role?: string | null;

  @IsString()
  @MaxLength(180)
  value: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;
}

export class CustomerDocumentDto {
  @IsString()
  @MaxLength(50)
  document_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  document_number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  original_file_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mime_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksum?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string | null;

  @IsOptional()
  @IsDateString()
  issued_at?: string | null;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;
}

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  customer_type: CustomerType;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  middle_name?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsEnum(CustomerGender)
  gender?: CustomerGender;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsDateString()
  date_of_birth?: string;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.CORPORATE)
  @IsString()
  @MaxLength(150)
  company_name?: string;

  @ValidateIf((o) => o.customer_type === CustomerType.CORPORATE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registration_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.CORPORATE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  incorporation_certificate_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.CORPORATE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tin?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.CORPORATE)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vrn?: string | null;

  @IsNumber()
  @Type(() => Number)
  policy_holder_type?: number;

  @IsNumber()
  @Type(() => Number)
  id_type: number;

  @IsString()
  @MaxLength(50)
  id_number: string;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nida_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  voter_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  passport_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  driving_license_no?: string | null;

  @ValidateIf((o) => o.customer_type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  zanid_no?: string | null;

  @IsString()
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  alternate_phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  fax?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsString()
  @Length(3, 3)
  country_code: string;

  @IsString()
  @MaxLength(50)
  region: string;

  @IsString()
  @MaxLength(50)
  district: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ward?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  street?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  postal_address?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_role?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  contact_email?: string | null;

  @IsOptional()
  @IsEnum(CustomerKycStatus)
  kyc_status?: CustomerKycStatus;

  @IsOptional()
  @IsEnum(CustomerDocumentType)
  document_type?: CustomerDocumentType | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  document_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  document_file_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  document_file_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  document_mime_type?: string | null;

  @IsOptional()
  @IsBoolean()
  document_verified?: boolean;

  @IsOptional()
  @IsUUID()
  document_verified_by?: string | null;

  @IsOptional()
  @IsDateString()
  document_verified_at?: string | null;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerIdentifierDto)
  identifiers?: CustomerIdentifierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses?: CustomerAddressDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerContactDto)
  contacts?: CustomerContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerDocumentDto)
  documents?: CustomerDocumentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  duplicate_override_reason?: string | null;
}
