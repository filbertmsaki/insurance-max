import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../shared/audit/audit.module';
import { InsuranceDocumentsModule } from '../../../insurance-documents/insurance-documents.module';
import { FinanceFoundationModule } from '../finance-foundation.module';
import { FinanceSetupController } from './finance-setup.controller';
import { FinanceSetupService } from './finance-setup.service';
import { FinanceSetupConfigurationService } from './finance-setup-configuration.service';
import { FinanceSetupEvidenceService } from './finance-setup-evidence.service';
import { FinancePortalIdentityService } from './finance-portal-identity.service';
import { FinanceBookManagementService } from './finance-book-management.service';

@Module({
  imports: [AuditModule, InsuranceDocumentsModule, FinanceFoundationModule],
  controllers: [FinanceSetupController],
  providers: [
    FinanceSetupService,
    FinanceSetupConfigurationService,
    FinanceSetupEvidenceService,
    FinancePortalIdentityService,
    FinanceBookManagementService,
  ],
  exports: [FinancePortalIdentityService],
})
export class FinanceSetupModule {}
