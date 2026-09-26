import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

export class UpdateUserDataScopeDto {
  @IsEnum(QuotationPolicyDataScope)
  quotation_policy_data_scope: QuotationPolicyDataScope;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
