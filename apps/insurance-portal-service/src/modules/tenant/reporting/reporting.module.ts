import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from '../../shared/mail/mail.module';
import { SaasBillingModule } from '../../platform/saas-billing/saas-billing.module';
import { User } from '../users/entities/user.entity';
import { ProductPerformanceSnapshot } from '../regulatory-compliance/entities/product-performance-snapshot.entity';
import { ReportArtifact } from './entities/report-artifact.entity';
import { ReportDefinition } from './entities/report-definition.entity';
import { ReportJob } from './entities/report-job.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { ProductPerformanceReportGenerator } from './generators/product-performance-report.generator';
import { REPORT_GENERATORS } from './interfaces/report-generator.interface';
import { ReportSchedulerJob } from './jobs/report-scheduler.job';
import { ReportWorkerJob } from './jobs/report-worker.job';
import { ReportingController } from './reporting.controller';
import { ExcelReportWriterService } from './services/excel-report-writer.service';
import { ReportMailHealthService } from './services/report-mail-health.service';
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
      ProductPerformanceSnapshot,
    ]),
    SaasBillingModule,
    MailModule,
  ],
  controllers: [ReportingController],
  providers: [
    ExcelReportWriterService,
    ReportMailHealthService,
    ReportScheduleService,
    ReportSchedulerJob,
    ReportWorkerJob,
    ProductPerformanceReportGenerator,
    {
      provide: REPORT_GENERATORS,
      useFactory: (productPerformance: ProductPerformanceReportGenerator) => [
        productPerformance,
      ],
      inject: [ProductPerformanceReportGenerator],
    },
    ReportRegistryService,
  ],
  exports: [ReportRegistryService, ReportScheduleService],
})
export class ReportingModule {}
