import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DocumentClassification,
  DocumentLinkType,
} from '@insurance-max/contracts';

export class RegisterDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  owner_type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  file_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  checksum: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  content_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  file_size?: number;
}

export class RejectDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class CreateUploadSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  document_type: string;

  @ApiProperty({ default: DocumentClassification.INTERNAL })
  @IsString()
  @IsNotEmpty()
  classification: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  resource_type: string;

  @ApiProperty()
  @IsUUID()
  resource_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maximum_bytes?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_mime_types?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customer_visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  intermediary_visible?: boolean;

  @ApiPropertyOptional({ default: DocumentLinkType.COMMUNICATION })
  @IsOptional()
  @IsString()
  link_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  link_label?: string;
}

export class ShareDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customer_visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  intermediary_visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public_verification_enabled?: boolean;

  @ApiPropertyOptional({ default: DocumentLinkType.COMMUNICATION })
  @IsOptional()
  @IsString()
  link_type?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  linked_record_type: string;

  @ApiProperty()
  @IsUUID()
  linked_record_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  label?: string;
}

export class RevokeDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  link_id?: string;
}
