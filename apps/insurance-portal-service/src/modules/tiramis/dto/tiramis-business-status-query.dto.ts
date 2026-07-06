import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class TiramisBusinessStatusQueryDto {
  @ApiPropertyOptional({
    example: 'NIN_VERIFICATION',
  })
  @IsOptional()
  @IsString()
  requestType?: string;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includePayload?: boolean;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeHistory?: boolean;
}
