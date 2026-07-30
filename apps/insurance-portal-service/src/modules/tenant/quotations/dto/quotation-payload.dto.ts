import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export class InternalQuotationDto {
  @IsUUID()
  insurer_company_id: string;

  @IsOptional()
  @IsUUID()
  intermediary_company_id: string | null;

  /** Resolved server-side from the authenticated user's active branch. */
  declare branch_id: string | null;

  @IsOptional()
  @IsUUID()
  department_id: string | null;

  @IsUUID()
  category_id: string;

  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  sub_class_id: string | null;

  @IsEnum(QuotationType)
  quotation_type: QuotationType;

  @IsEnum(QuotationFlow)
  quotation_flow: QuotationFlow;

  @IsEnum(ProductChannelType)
  channel_type: ProductChannelType;

  @IsBoolean()
  is_fleet: boolean;
}

export class CoverNoteHeaderDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 1;
    }

    return typeof value === 'number' ? value : Number(value);
  })
  @IsInt()
  @Min(1)
  cover_note_type: number = 1;
}

export class TaxChargedDto {
  @IsString()
  @MaxLength(50)
  tax_code: string;

  @IsIn(['Y', 'N'])
  is_tax_exempted: 'Y' | 'N';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tax_exemption_type: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tax_exemption_reference: string | null;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  tax_rate: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax_amount: number;
}

export class DiscountOfferedDto {
  @IsInt()
  @Min(1)
  discount_type: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  discount_rate: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount_amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  request_reason_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  request_comment?: string | null;

  @IsOptional()
  @IsDateString()
  effective_from?: string | null;

  @IsOptional()
  @IsDateString()
  effective_to?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  requested_by?: string | null;

  @IsOptional()
  @IsDateString()
  requested_at?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  max_permitted_rate?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max_permitted_amount?: number | null;

  @IsOptional()
  @IsBoolean()
  approval_required?: boolean | null;

  @IsOptional()
  @IsIn(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'])
  approval_status?:
    | 'NOT_REQUIRED'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  approved_rate?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  approved_amount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  approved_by?: string | null;

  @IsOptional()
  @IsDateString()
  approval_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string | null;
}

export class RiskCoveredDto {
  @IsString()
  @MaxLength(50)
  risk_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  pricing_quote_id?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sum_insured: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sum_insured_equivalent: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  premium_rate: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_before_discount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_after_discount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_excluding_tax_equivalent: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_including_tax: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountOfferedDto)
  discounts_offered: DiscountOfferedDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxChargedDto)
  taxes_charged: TaxChargedDto[];
}

export class SubjectMatterCoveredDto {
  @IsString()
  @MaxLength(100)
  subject_matter_reference: string;

  @IsString()
  @MaxLength(500)
  subject_matter_desc: string;
}

export class CoverNoteAddonDto {
  @IsString()
  @MaxLength(100)
  addon_reference: string;

  @IsString()
  @MaxLength(500)
  addon_desc: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  addon_amount: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  addon_premium_rate: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_excluding_tax: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_excluding_tax_equivalent: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  premium_including_tax: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxChargedDto)
  taxes_charged: TaxChargedDto[];
}

export class PolicyHolderDto {
  @IsString()
  @MaxLength(200)
  policy_holder_name: string;

  @IsDateString()
  policy_holder_birth_date: string;

  @IsInt()
  @Min(1)
  policy_holder_type: number;

  @IsString()
  @MaxLength(100)
  policy_holder_id_number: string;

  @IsInt()
  @Min(1)
  policy_holder_id_type: number;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender: 'M' | 'F' | null;

  @IsString()
  @MaxLength(3)
  country_code: string;

  @IsString()
  @MaxLength(100)
  region: string;

  @IsString()
  @MaxLength(100)
  district: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  street: string | null;

  @IsString()
  @MaxLength(30)
  policy_holder_phone_number: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  policy_holder_fax: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  postal_address: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email_address: string | null;
}

export class MotorDetailDto {
  @IsInt()
  @Min(1)
  motor_category: number;

  @IsInt()
  @Min(1)
  motor_type: number;

  @IsString()
  @MaxLength(50)
  registration_number: string;

  @IsString()
  @MaxLength(100)
  chassis_number: string;

  @IsString()
  @MaxLength(100)
  make: string;

  @IsString()
  @MaxLength(100)
  model: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model_number: string | null;

  @IsString()
  @MaxLength(100)
  body_type: string;

  @IsString()
  @MaxLength(50)
  color: string;

  @IsString()
  @MaxLength(100)
  engine_number: string;

  @IsString()
  @MaxLength(50)
  engine_capacity: string;

  @IsString()
  @MaxLength(50)
  fuel_used: string;

  @IsInt()
  @Min(1)
  number_of_axles: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  axle_distance: number;

  @IsInt()
  @Min(1)
  sitting_capacity: number;

  @IsInt()
  @Min(1886)
  @Max(2100)
  year_of_manufacture: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tare_weight: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gross_weight: number;

  @IsInt()
  @Min(1)
  motor_usage: number;

  @IsString()
  @MaxLength(200)
  owner_name: string;

  @IsInt()
  @Min(1)
  owner_category: number;

  @IsString()
  @MaxLength(300)
  owner_address: string;
}

export class FleetHeaderDto {
  @IsString()
  @MaxLength(100)
  fleet_id: string;

  @IsInt()
  @Min(1)
  fleet_type: number;

  @IsInt()
  @Min(1)
  fleet_size: number;

  @IsInt()
  @Min(0)
  comprehensive_insured: number;

  @IsString()
  @MaxLength(50)
  sale_point_code: string;

  @IsDateString()
  cover_note_start_date: string;

  @IsDateString()
  cover_note_end_date: string;

  @IsInt()
  @Min(1)
  payment_mode: number;

  @IsString()
  @MaxLength(10)
  currency_code: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchange_rate: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_premium_excluding_tax: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_premium_including_tax: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commision_paid: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  commision_rate: number;

  @IsString()
  @MaxLength(150)
  officer_name: string;

  @IsString()
  @MaxLength(150)
  officer_title: string;

  @IsString()
  @MaxLength(50)
  product_code: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PolicyHolderDto)
  policy_holders: PolicyHolderDto[];
}

export class FleetDetailDto {
  @IsInt()
  @Min(1)
  fleet_entry: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cover_note_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  prev_cover_note_reference_number: string | null;

  @IsString()
  @MaxLength(500)
  cover_note_desc: string;

  @IsString()
  @MaxLength(500)
  operative_clause: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  endorsement_type: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endorsement_reason: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  endorsement_premium_earned: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RiskCoveredDto)
  risks_covered: RiskCoveredDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMatterCoveredDto)
  subject_matters_covered: SubjectMatterCoveredDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoverNoteAddonDto)
  cover_note_addons: CoverNoteAddonDto[];

  @ValidateNested()
  @Type(() => MotorDetailDto)
  motor_dtl: MotorDetailDto;
}

export class CoverNoteDetailDto {
  /*
   * Non-fleet fields.
   *
   * These fields are optional at decorator level because fleet submissions
   * use fleet_hdr and fleet_dtls instead. The cross-field business validator
   * will require or reject them according to quotation_flow.
   */

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cover_note_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  prev_cover_note_reference_number?: string | null;

  /** Resolved server-side from the active branch's default sale point. */
  declare sale_point_code?: string;

  @IsOptional()
  @IsDateString()
  cover_note_start_date?: string;

  @IsOptional()
  @IsDateString()
  cover_note_end_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover_note_desc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  operative_clause?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  payment_mode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchange_rate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_premium_excluding_tax?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_premium_including_tax?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commision_paid?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  commision_rate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  officer_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  officer_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  product_code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  endorsement_type?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endorsement_reason?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  endorsement_premium_earned?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RiskCoveredDto)
  risks_covered?: RiskCoveredDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMatterCoveredDto)
  subject_matters_covered?: SubjectMatterCoveredDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoverNoteAddonDto)
  cover_note_addons?: CoverNoteAddonDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PolicyHolderDto)
  policy_holders?: PolicyHolderDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MotorDetailDto)
  motor_dtl?: MotorDetailDto;

  /*
   * Fleet fields.
   */

  @IsOptional()
  @ValidateNested()
  @Type(() => FleetHeaderDto)
  fleet_hdr?: FleetHeaderDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FleetDetailDto)
  fleet_dtls?: FleetDetailDto[];
}

export class CreateQuotationDto {
  @ValidateNested()
  @Type(() => InternalQuotationDto)
  internal_quotation: InternalQuotationDto;

  @ValidateNested()
  @Type(() => CoverNoteHeaderDto)
  cover_note_hdr: CoverNoteHeaderDto;

  @ValidateNested()
  @Type(() => CoverNoteDetailDto)
  cover_note_dtl: CoverNoteDetailDto;
}

export class UpdateQuotationDto extends CreateQuotationDto {
  @IsOptional()
  @IsDateString()
  expected_updated_at?: string;
}

export class SubmitQuotationDto {
  @IsOptional()
  @IsBoolean()
  force_resubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  return_existing?: boolean;
}
