import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from '../../shared/mail/mail.module';
import { SaasBillingModule } from '../../platform/saas-billing/saas-billing.module';
import { User } from '../users/entities/user.entity';
import { ProductPerformanceSnapshot } from '../regulatory-compliance/entities/product-performance-snapshot.entity';
import { ReportAccessAuditEvent } from './entities/report-access-audit-event.entity';
import { ReportArtifact } from './entities/report-artifact.entity';
import { ReportDeliveryAttempt } from './entities/report-delivery-attempt.entity';
import { ReportDefinition } from './entities/report-definition.entity';
import { ReportJob } from './entities/report-job.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { ProductPerformanceReportGenerator } from './generators/product-performance-report.generator';
import { ClaimsReportGenerator } from './generators/claims-report.generator';
import { REPORT_GENERATORS } from './interfaces/report-generator.interface';
import { ProductPerformanceSnapshotJob } from './jobs/product-performance-snapshot.job';
import { ReportSchedulerJob } from './jobs/report-scheduler.job';
import { ReportWorkerJob } from './jobs/report-worker.job';
import { ReportingController } from './reporting.controller';
import { ExcelReportWriterService } from './services/excel-report-writer.service';
import { ProductPerformanceSnapshotService } from './services/product-performance-snapshot.service';
import { ReportMailHealthService } from './services/report-mail-health.service';
import { ReportParameterValidationService } from './services/report-parameter-validation.service';
import { ReportRegistryService } from './services/report-registry.service';
import { ReportScheduleService } from './services/report-schedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ReportDefinition,
      ReportSchedule,
      ReportJob,
      ReportArtifact,
      ReportDeliveryAttempt,
      ReportAccessAuditEvent,
      ProductPerformanceSnapshot,
    ]),
    SaasBillingModule,
    MailModule,
  ],
  controllers: [ReportingController],
  providers: [
    ExcelReportWriterService,
    ReportMailHealthService,
    ReportParameterValidationService,
    ReportScheduleService,
    ReportSchedulerJob,
    ReportWorkerJob,
    ProductPerformanceSnapshotService,
    ProductPerformanceSnapshotJob,
    ProductPerformanceReportGenerator,
    ClaimsReportGenerator,
    {
      provide: REPORT_GENERATORS,
      useFactory: (
        productPerformance: ProductPerformanceReportGenerator,
        claims: ClaimsReportGenerator,
      ) => [productPerformance, claims],
      inject: [ProductPerformanceReportGenerator, ClaimsReportGenerator],
    },
    ReportRegistryService,
  ],
  exports: [ReportRegistryService, ReportScheduleService],
})
export class ReportingModule {}
