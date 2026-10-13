import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindDocumentsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  classification?: string;
}

export class FindDocumentTemplatesQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}

export class FindSignatureRequestsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
