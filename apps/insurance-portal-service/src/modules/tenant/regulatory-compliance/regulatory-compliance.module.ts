import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { CompanyRegulatoryProfile } from './entities/company-regulatory-profile.entity';
import { PremiumLedgerEntry } from './entities/premium-ledger-entry.entity';
import { PremiumLevyReturnLine } from './entities/premium-levy-return-line.entity';
import { PremiumLevyReturn } from './entities/premium-levy-return.entity';
import { ProductPerformanceSnapshot } from './entities/product-performance-snapshot.entity';
import { RegulatoryObligationTemplate } from './entities/regulatory-obligation-template.entity';
import { RegulatoryObligation } from './entities/regulatory-obligation.entity';
import { RegulatoryReturnAttachment } from './entities/regulatory-return-attachment.entity';
import { RegulatoryReturnDefinition } from './entities/regulatory-return-definition.entity';
import { RegulatoryReturn } from './entities/regulatory-return.entity';
import { RegulatorySubmissionEvent } from './entities/regulatory-submission-event.entity';
import { RegulatoryMonitorJob } from './jobs/regulatory-monitor.job';
import { RegulatoryController } from './regulatory.controller';
import { PremiumLedgerService } from './services/premium-ledger.service';
import { PremiumLevyReturnService } from './services/premium-levy-return.service';
import { RegulatoryCalendarService } from './services/regulatory-calendar.service';
import { RegulatoryDueDateService } from './services/regulatory-due-date.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyRegulatoryProfile,
      RegulatoryObligationTemplate,
      RegulatoryObligation,
      RegulatoryReturnDefinition,
      RegulatoryReturn,
      RegulatoryReturnAttachment,
      RegulatorySubmissionEvent,
      PremiumLedgerEntry,
      PremiumLevyReturn,
      PremiumLevyReturnLine,
      ProductPerformanceSnapshot,
    ]),
    WorkItemsModule,
  ],
  controllers: [RegulatoryController],
  providers: [
    RegulatoryDueDateService,
    RegulatoryCalendarService,
    RegulatoryMonitorJob,
    PremiumLedgerService,
    PremiumLevyReturnService,
  ],
  exports: [
    RegulatoryCalendarService,
    PremiumLedgerService,
    PremiumLevyReturnService,
  ],
})
export class RegulatoryComplianceModule {}
