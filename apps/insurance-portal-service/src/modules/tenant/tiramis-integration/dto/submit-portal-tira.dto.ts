import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SubmitPortalTiraDto {
  @IsIn(['NON_MOTOR', 'MOTOR', 'MOTOR_FLEET'])
  requestType!: 'NON_MOTOR' | 'MOTOR' | 'MOTOR_FLEET';

  @IsOptional()
  @IsString()
  policy_id?: string;

  @IsOptional()
  @IsString()
  quotation_id?: string;

  @IsOptional()
  @IsString()
  source_module?: string;

  @IsOptional()
  @IsString()
  source_record_id?: string;

  @IsNotEmpty()
  @IsString()
  business_reference!: string;

  /**
   * Already prepared TIRAMIS payload for Motor or Non-Motor submission.
   */
  @IsObject()
  payload!: Record<string, any>;
}
