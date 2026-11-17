import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccountingBook } from './entities/finance-accounting-book.entity';
import { FinanceLegalEntity } from './entities/finance-legal-entity.entity';
import { FinanceLegalEntitySourceMap } from './entities/finance-legal-entity-source-map.entity';
import { FinanceScopeMembership } from './entities/finance-scope-membership.entity';
import { FinanceScopeService } from './finance-scope.service';
import { FinanceConfigurationAuthority } from './entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from './entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from './entities/finance-configuration-event.entity';
import { FinanceConfigurationService } from './finance-configuration.service';
import { FinanceChartSourceAuthority } from './entities/finance-chart-source-authority.entity';
import { FinanceJournalCandidateService } from './finance-journal-candidate.service';
import { FinanceApprovalService } from './finance-approval.service';
import { FinanceEventPreviewService } from './finance-event-preview.service';
import { FinanceIntakeService } from './finance-intake.service';
import { FinanceReferenceDeliveryService } from './finance-reference-delivery.service';
import { FINANCE_REFERENCE_TRANSPORTS } from './finance-integration.types';
import { FinanceOperationsService } from './finance-operations.service';
import { FinanceQuotationBillingService } from './finance-quotation-billing.service';
import { FinanceReceivablesService } from './finance-receivables.service';
import { FinancePolicyService } from './finance-policy.service';
import { FinanceLedgerFoundationService } from './finance-ledger-foundation.service';
import { FinanceOutgoingService } from './finance-outgoing.service';
import { OUTGOING_SIMULATORS } from './finance-outgoing.types';
import { FinancePolicyChangeService } from './finance-policy-change.service';
import { FinanceAllocationSchedulerService } from './finance-allocation-scheduler.service';
import { FinanceSourceDeliveryService } from './finance-source-delivery.service';

/** Versioned foundations; the company adapter is registered by BillingCommissionModule. Importing this module never grants access, activates a policy or enables posting. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceLegalEntity,
      FinanceAccountingBook,
      FinanceScopeMembership,
      FinanceLegalEntitySourceMap,
      FinanceConfigurationAuthority,
      FinanceConfigurationRelease,
      FinanceConfigurationEvent,
      FinanceChartSourceAuthority,
    ]),
  ],
  providers: [
    FinanceSourceDeliveryService,
    FinanceAllocationSchedulerService,
    FinancePolicyChangeService,
    FinanceOutgoingService,
    { provide: OUTGOING_SIMULATORS, useValue: Object.freeze([]) },
    FinanceLedgerFoundationService,
    FinancePolicyService,
    FinanceReceivablesService,
    FinanceQuotationBillingService,
    FinanceOperationsService,
    { provide: FINANCE_REFERENCE_TRANSPORTS, useValue: Object.freeze([]) },
    FinanceIntakeService,
    FinanceReferenceDeliveryService,
    FinanceEventPreviewService,
    FinanceApprovalService,
    FinanceScopeService,
    FinanceConfigurationService,
    FinanceJournalCandidateService,
  ],
  exports: [
    FinanceSourceDeliveryService,
    FinanceAllocationSchedulerService,
    FinancePolicyChangeService,
    FinanceOutgoingService,
    FinanceLedgerFoundationService,
    FinancePolicyService,
    FinanceReceivablesService,
    FinanceQuotationBillingService,
    FinanceOperationsService,
    FinanceIntakeService,
    FinanceReferenceDeliveryService,
    FinanceEventPreviewService,
    FinanceApprovalService,
    FinanceScopeService,
    FinanceConfigurationService,
    FinanceJournalCandidateService,
  ],
})
export class FinanceFoundationModule {}
