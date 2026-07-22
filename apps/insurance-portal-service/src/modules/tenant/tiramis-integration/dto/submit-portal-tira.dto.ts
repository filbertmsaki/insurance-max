import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SubmitPortalTiraDto {
  @IsIn([
    'NON_MOTOR',
    'MOTOR',
    'MOTOR_FLEET',
    'REINSURANCE',
    'POLICY',
    'CLAIM_NOTIFICATION',
    'CLAIM_INTIMATION',
    'CLAIM_ASSESSMENT',
    'DISCHARGE_VOUCHER',
    'CLAIM_PAYMENT',
    'CLAIM_REJECTION',
  ])
  requestType!:
    | 'NON_MOTOR'
    | 'MOTOR'
    | 'MOTOR_FLEET'
    | 'REINSURANCE'
    | 'POLICY'
    | 'CLAIM_NOTIFICATION'
    | 'CLAIM_INTIMATION'
    | 'CLAIM_ASSESSMENT'
    | 'DISCHARGE_VOUCHER'
    | 'CLAIM_PAYMENT'
    | 'CLAIM_REJECTION';

  @IsOptional()
  @IsString()
  policy_id?: string;

  @IsOptional()
  @IsString()
  quotation_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  sale_point_id?: string;

  @IsOptional()
  @IsString()
  source_module?: string;

  @IsOptional()
  @IsString()
  source_record_id?: string;

  @IsNotEmpty()
  @IsString()
  business_reference!: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  /**
   * Already prepared TIRAMIS payload for Motor or Non-Motor submission.
   */
  @IsObject()
  payload!: Record<string, any>;
}
