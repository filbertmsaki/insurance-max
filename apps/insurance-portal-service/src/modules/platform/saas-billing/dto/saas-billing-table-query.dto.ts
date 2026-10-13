import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  BillingInterval,
  SaasBillingCycleStatus,
  SaasInvoiceStatus,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

export class FindSaasInvoicesQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: SaasInvoiceStatus })
  @IsOptional()
  @IsEnum(SaasInvoiceStatus)
  status?: SaasInvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_id?: string;
}

export class FindSaasCyclesQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: SaasBillingCycleStatus })
  @IsOptional()
  @IsEnum(SaasBillingCycleStatus)
  status?: SaasBillingCycleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_id?: string;
}

export class FindSaasSubscriptionsQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billing_interval?: BillingInterval;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_id?: string;
}
