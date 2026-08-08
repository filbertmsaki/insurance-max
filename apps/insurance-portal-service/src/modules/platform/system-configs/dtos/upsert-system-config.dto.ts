import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertSystemConfigDto {
  @ApiProperty({
    description: 'Any JSON-serializable value for this platform-wide setting.',
    example: { enabled: true, maxRetries: 5 },
  })
  @IsObject()
  config_value: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Global TIRAMIS retry ceiling' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
