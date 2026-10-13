import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindPermissionsQueryDto extends TableQueryDto {
  @ApiPropertyOptional({
    example: 'users',
    description: 'Permission category (prefix before ":" or a legacy group)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_-]+$/)
  category?: string;
}
