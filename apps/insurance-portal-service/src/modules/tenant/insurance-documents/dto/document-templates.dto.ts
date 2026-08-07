import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDocumentTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  template_code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  template_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  document_type: string;

  @ApiPropertyOptional({ default: 'TEXT_TEMPLATE' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  engine?: string;

  @ApiPropertyOptional({ default: 'COMPANY' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  scope?: string;
}

export class CreateDocumentTemplateVersionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  template_content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stylesheet_content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  header_content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footer_content?: string;

  @ApiProperty()
  @IsObject()
  variable_schema: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sample_data?: Record<string, unknown>;
}

export class PreviewDocumentTemplateVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  source_snapshot?: Record<string, unknown>;
}

export class GenerateDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  template_code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  document_type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsObject()
  source_snapshot: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  resource_type: string;

  @ApiProperty()
  @IsUUID()
  resource_id: string;

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class CreateSignatureParticipantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  participant_type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  participant_id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  signing_order?: number;
}

export class CreateSignatureRequestDto {
  @ApiProperty()
  @IsUUID()
  document_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  signature_provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  signing_order_required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiProperty({ type: [CreateSignatureParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSignatureParticipantDto)
  participants: CreateSignatureParticipantDto[];
}

export class CancelSignatureRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class PublicSignatureDecisionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  decision: 'SIGN' | 'DECLINE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decline_reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
