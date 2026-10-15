import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  PolicyTransactionStage,
  RenewalLifecycleStatus,
} from '@insurance-max/contracts';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/** Company-wide endorsement list. Paged only when `page` is sent. */
export class EndorsementListQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @ApiPropertyOptional({ enum: Object.values(PolicyTransactionStage) })
  @IsOptional()
  @IsIn(Object.values(PolicyTransactionStage))
  stage?: PolicyTransactionStage;
}

/** Company-wide renewal list. Paged only when `page` is sent. */
export class RenewalListQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @ApiPropertyOptional({ enum: Object.values(RenewalLifecycleStatus) })
  @IsOptional()
  @IsIn(Object.values(RenewalLifecycleStatus))
  renewal_status?: RenewalLifecycleStatus;
}
