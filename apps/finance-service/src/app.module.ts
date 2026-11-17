import { Controller, Get, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { financeDatabaseOptions } from './database/options';
import {
  FINANCE_ALLOCATION_EXECUTION_ENABLED,
  FINANCE_ALLOCATION_DIMENSION_VERIFIER,
  FinanceAllocationSchedulerService,
} from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-allocation-scheduler.service';
import { FinanceSourceAttestationsService } from './source-attestations.service';
import { FinanceSourceAttestationsController } from './source-attestations.controller';
import { FinanceSourceKeyChangesService } from './source-key-changes.service';
import { FinanceSourceKeyChangesController } from './source-key-changes.controller';
import { FinanceHumanReadService } from './human-read.service';
import { FinanceHumanReadController } from './human-read.controller';
import { FinanceLedgerFoundationService } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service';
import { FINANCE_JOURNAL_DIMENSION_VERIFIER } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-reviewed-dimension-master';
import { FinanceJournalCandidateService } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-journal-candidate.service';
import { FinanceApprovalService } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-approval.service';

@Controller('health')
class HealthController {
  constructor(private readonly database: DataSource) {}

  @Get()
  async health() {
    await this.database.query('SELECT 1');
    return {
      status: 'ok',
      mode: 'inactive-allocation-worker',
      postingEnabled: false,
      allocationExecutionEnabled: false,
      authenticatedApiEnabled: Boolean(
        process.env.FINANCE_PORTAL_IDENTITY_ORIGIN,
      ),
    };
  }
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => financeDatabaseOptions(process.env),
    }),
  ],
  controllers: [
    HealthController,
    FinanceSourceAttestationsController,
    FinanceSourceKeyChangesController,
    FinanceHumanReadController,
  ],
  providers: [
    { provide: FINANCE_ALLOCATION_EXECUTION_ENABLED, useValue: false },
    {
      provide: FINANCE_ALLOCATION_DIMENSION_VERIFIER,
      useFactory: (service: FinanceSourceAttestationsService) =>
        service.verifyDimensions.bind(service),
      inject: [FinanceSourceAttestationsService],
    },
    FinanceAllocationSchedulerService,
    FinanceSourceAttestationsService,
    {
      provide: FINANCE_JOURNAL_DIMENSION_VERIFIER,
      useFactory: (service: FinanceSourceAttestationsService) =>
        service.verifyDimensions.bind(service),
      inject: [FinanceSourceAttestationsService],
    },
    FinanceSourceKeyChangesService,
    FinanceHumanReadService,
    FinanceLedgerFoundationService,
    FinanceApprovalService,
    FinanceJournalCandidateService,
  ],
})
export class AppModule {}
