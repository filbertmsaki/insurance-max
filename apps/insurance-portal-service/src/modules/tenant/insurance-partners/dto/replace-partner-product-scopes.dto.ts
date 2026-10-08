import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartnerOperation } from '../enums/partner-operation.enum';

export class PartnerProductScopeInputDto {
  @IsUUID()
  product_id: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(PartnerOperation, { each: true })
  allowed_operations: PartnerOperation[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  branch_ids?: string[] | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commission_rate?: number | null;
}

export class ReplacePartnerProductScopesDto {
  @IsArray()
  @ArrayUnique((scope: PartnerProductScopeInputDto) => scope.product_id)
  @ValidateNested({ each: true })
  @Type(() => PartnerProductScopeInputDto)
  product_scopes: PartnerProductScopeInputDto[];
}
