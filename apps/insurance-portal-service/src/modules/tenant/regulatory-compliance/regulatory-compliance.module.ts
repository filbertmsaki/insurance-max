import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { CompanyRegulatoryProfile } from './entities/company-regulatory-profile.entity';
import { PremiumLedgerEntry } from './entities/premium-ledger-entry.entity';
import { PremiumLevyReturnLine } from './entities/premium-levy-return-line.entity';
import { PremiumLevyReturn } from './entities/premium-levy-return.entity';
import { ProductPerformanceSnapshot } from './entities/product-performance-snapshot.entity';
import { RegulatoryAuthorityProfile } from './entities/regulatory-authority-profile.entity';
import { RegulatoryLedgerEntry } from './entities/regulatory-ledger-entry.entity';
import { RegulatoryLevyAssessment } from './entities/regulatory-levy-assessment.entity';
import { RegulatoryLevyRule } from './entities/regulatory-levy-rule.entity';
import { RegulatoryObligationDefinition } from './entities/regulatory-obligation-definition.entity';
import { RegulatoryObligationInstance } from './entities/regulatory-obligation-instance.entity';
import { RegulatoryObligationTemplate } from './entities/regulatory-obligation-template.entity';
import { RegulatoryObligation } from './entities/regulatory-obligation.entity';
import { RegulatoryReturnAttachment } from './entities/regulatory-return-attachment.entity';
import { RegulatoryReturnDefinition } from './entities/regulatory-return-definition.entity';
import { RegulatoryReturnSubmission } from './entities/regulatory-return-submission.entity';
import { RegulatoryReturn } from './entities/regulatory-return.entity';
import { RegulatorySubmissionEvent } from './entities/regulatory-submission-event.entity';
import { RegulatoryMonitorJob } from './jobs/regulatory-monitor.job';
import { RegulatoryController } from './regulatory.controller';
import { PremiumLedgerService } from './services/premium-ledger.service';
import { PremiumLevyReturnService } from './services/premium-levy-return.service';
import { RegulatoryCalendarService } from './services/regulatory-calendar.service';
import { RegulatoryDueDateService } from './services/regulatory-due-date.service';
import { RegulatoryLedgerService } from './services/regulatory-ledger.service';
import { RegulatoryLevyCalculationService } from './services/regulatory-levy-calculation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyRegulatoryProfile,
      RegulatoryAuthorityProfile,
      RegulatoryObligationDefinition,
      RegulatoryObligationInstance,
      RegulatoryObligationTemplate,
      RegulatoryObligation,
      RegulatoryReturnDefinition,
      RegulatoryReturn,
      RegulatoryReturnSubmission,
      RegulatoryReturnAttachment,
      RegulatorySubmissionEvent,
      RegulatoryLevyRule,
      RegulatoryLevyAssessment,
      RegulatoryLedgerEntry,
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
    RegulatoryLedgerService,
    RegulatoryLevyCalculationService,
    PremiumLevyReturnService,
  ],
  exports: [
    RegulatoryCalendarService,
    PremiumLedgerService,
    RegulatoryLedgerService,
    RegulatoryLevyCalculationService,
    PremiumLevyReturnService,
  ],
})
export class RegulatoryComplianceModule {}
