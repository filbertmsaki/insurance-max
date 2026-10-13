import { Type } from 'class-transformer';
import { ReinsuranceTerritory } from '@insurance-max/contracts';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ReinsuranceBordereauType,
  ReinsuranceCessionType,
  TreatyForm,
  TreatyParticipantRole,
  TreatyType,
} from '../enums/reinsurance.enums';

export class CreateTreatyEligibilityRuleDto {
  @IsIn(['CLASS_OF_BUSINESS', 'TERRITORY', 'SUM_INSURED_MAX'])
  rule_type: 'CLASS_OF_BUSINESS' | 'TERRITORY' | 'SUM_INSURED_MAX';

  @IsString()
  rule_value: string;

  @IsOptional()
  @IsIn([true, false])
  is_exclusion?: boolean;
}

export class CreateTreatyDto {
  @IsString()
  treaty_name: string;

  @IsEnum(TreatyType)
  treaty_type: TreatyType;

  @IsEnum(TreatyForm)
  treaty_form: TreatyForm;

  @IsDateString()
  effective_from: string;

  @IsDateString()
  effective_to: string;

  @IsString()
  currency: string;

  total_capacity: string | number;

  company_retention: string | number;

  @IsOptional()
  aggregate_limit?: string | number;

  @IsOptional()
  minimum_deposit_premium?: string | number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reinstatement_count?: number;

  @IsOptional()
  @IsString()
  agreement_reference?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  agreement_document_url?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTreatySectionDto {
  @IsString()
  section_no: string;

  @IsString()
  section_name: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsUUID()
  sub_class_id?: string;

  retention_amount: string | number;

  cession_limit: string | number;

  treaty_limit: string | number;

  @IsOptional()
  line_count?: string | number;

  @IsOptional()
  rate_on_line?: string | number;

  @IsOptional()
  minimum_premium?: string | number;

  @IsOptional()
  maximum_premium?: string | number;

  @IsOptional()
  ceding_commission_rate?: string | number;

  @IsOptional()
  brokerage_rate?: string | number;

  @IsOptional()
  profit_commission_rate?: string | number;

  @IsOptional()
  event_limit?: string | number;

  @IsOptional()
  aggregate_limit?: string | number;

  @IsOptional()
  @IsInt()
  reinsurance_category?: number;

  @IsOptional()
  @IsInt()
  reinsurance_form?: number;

  @IsOptional()
  @IsInt()
  reinsurance_type?: number;
}

export class CreateTreatyParticipantDto {
  @IsUUID()
  participant_company_id: string;

  @IsOptional()
  @IsUUID()
  treaty_section_id?: string;

  @IsOptional()
  @IsUUID()
  reinsurance_broker_company_id?: string;

  @IsString()
  participant_code: string;

  @IsOptional()
  @IsString()
  re_broker_code?: string;

  @IsEnum(TreatyParticipantRole)
  participant_role: TreatyParticipantRole;

  share_percent: string | number;

  @IsOptional()
  signed_line_percent?: string | number;

  @IsOptional()
  capacity_amount?: string | number;

  @IsOptional()
  brokerage_commission_rate?: string | number;

  @IsOptional()
  reinsurance_commission_rate?: string | number;

  @IsOptional()
  @IsDateString()
  participation_date?: string;

  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;
}

export enum TreatyInvitationDecision {
  ACCEPT = 'ACCEPT',
  DECLINE = 'DECLINE',
}

export class RespondTreatyInvitationDto {
  @IsEnum(TreatyInvitationDecision)
  decision!: TreatyInvitationDecision;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateFacultativePlacementDto {
  @IsUUID()
  policy_id: string;

  @IsOptional()
  @IsUUID()
  policy_risk_id?: string;

  @IsString()
  risk_description: string;

  @IsOptional()
  company_retention?: string | number;

  @IsOptional()
  amount_to_place?: string | number;

  @IsOptional()
  premium_to_place?: string | number;

  @IsOptional()
  @IsDateString()
  submission_deadline?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InviteFacultativeOfferDto {
  @IsUUID()
  reinsurer_company_id: string;

  @IsOptional()
  @IsUUID()
  reinsurance_broker_company_id?: string;

  offered_share_percent: string | number;

  @IsOptional()
  @IsString()
  participant_code?: string;

  @IsOptional()
  @IsString()
  re_broker_code?: string;
}

export class RespondFacultativeOfferDto {
  quoted_share_percent: string | number;

  @IsOptional()
  quoted_premium?: string | number;

  @IsOptional()
  brokerage_commission_rate?: string | number;

  @IsOptional()
  reinsurance_commission_rate?: string | number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsString()
  exclusions?: string;
}

export class AcceptFacultativeOfferDto {
  accepted_share_percent: string | number;
}

export class CreatePolicyCessionDto {
  @IsUUID()
  policy_id: string;

  @IsOptional()
  @IsUUID()
  policy_risk_id?: string;

  @IsEnum(ReinsuranceCessionType)
  cession_type: ReinsuranceCessionType;

  @IsOptional()
  @IsUUID()
  treaty_id?: string;

  @IsOptional()
  @IsUUID()
  treaty_section_id?: string;

  @IsOptional()
  @IsUUID()
  facultative_placement_id?: string;

  @IsOptional()
  retention_amount?: string | number;

  @IsOptional()
  @IsString()
  authorizing_officer_name?: string;

  @IsOptional()
  @IsString()
  authorizing_officer_title?: string;
}

export class ReinsuranceDecisionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdmitRecoveryDto {
  admitted_amount: string | number;
}

export class RecordRecoveryReceiptDto {
  amount: string | number;

  @IsOptional()
  @IsDateString()
  received_at?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class EvaluateCapacityDto {
  @IsUUID()
  treaty_id: string;

  @IsOptional()
  @IsUUID()
  treaty_section_id?: string;

  exposure_amount: string | number;

  @IsOptional()
  @IsString()
  class_of_business?: string;

  @IsOptional()
  @IsEnum(ReinsuranceTerritory)
  territory?: ReinsuranceTerritory;
}

export class EvaluateQuotationCapacityDto {
  @IsUUID()
  treaty_id: string;

  @IsOptional()
  @IsUUID()
  treaty_section_id?: string;

  exposure_amount: string | number;

  @IsOptional()
  @IsString()
  class_of_business?: string;

  @IsOptional()
  @IsEnum(ReinsuranceTerritory)
  territory?: ReinsuranceTerritory;
}

export class CreateReinsuranceSettlementDto {
  @IsUUID()
  counterparty_company_id: string;

  @IsString()
  settlement_type: string;

  @IsOptional()
  @IsDateString()
  period_from?: string;

  @IsOptional()
  @IsDateString()
  period_to?: string;

  @IsString()
  currency: string;

  gross_amount: string | number;

  @IsOptional()
  deduction_amount?: string | number;

  @IsOptional()
  @IsString()
  payment_method?: string;
}

export class RejectReinsuranceSettlementDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RespondReinsurancePremiumAccountDto {
  @IsIn(['CONFIRM', 'DISPUTE'])
  decision: 'CONFIRM' | 'DISPUTE';

  @IsOptional()
  @IsString()
  note?: string;
}

export class GenerateReinsuranceBordereauDto {
  @IsEnum(ReinsuranceBordereauType)
  bordereau_type: ReinsuranceBordereauType;

  @IsOptional()
  @IsUUID()
  treaty_id?: string;

  @IsOptional()
  @IsUUID()
  participant_company_id?: string;

  @IsDateString()
  period_from: string;

  @IsDateString()
  period_to: string;

  @IsString()
  currency: string;
}

export class GenerateReinsurancePremiumAccountDto {
  @IsOptional()
  @IsUUID()
  treaty_id?: string;

  @IsUUID()
  participant_company_id: string;

  @IsOptional()
  @IsUUID()
  reinsurance_broker_company_id?: string;

  @IsDateString()
  period_from: string;

  @IsDateString()
  period_to: string;

  @IsString()
  currency: string;

  @IsOptional()
  tax_amount?: string | number;

  @IsOptional()
  other_adjustments?: string | number;
}

/** Server-side workbench table query (treaties, offers, cessions, settlements, recoveries). */
export class ReinsuranceListQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}
