import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCommunicationThreadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  thread_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  resource_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resource_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customer_visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  intermediary_visible?: boolean;
}

export class CreateCommunicationMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body_text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  recipient_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recipient_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  internal_only?: boolean;
}

export class AssignCommunicationThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;
}
