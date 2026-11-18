import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccountingBook } from './entities/finance-accounting-book.entity';
import { FinanceLegalEntity } from './entities/finance-legal-entity.entity';
import { FinanceLegalEntitySourceMap } from './entities/finance-legal-entity-source-map.entity';
import { FinanceScopeMembership } from './entities/finance-scope-membership.entity';
import { FinanceScopeService } from './finance-configuration/finance-scope.service';
import { FinanceConfigurationAuthority } from './entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from './entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from './entities/finance-configuration-event.entity';
import { FinanceConfigurationService } from './finance-configuration/finance-configuration.service';
import { FinanceChartSourceAuthority } from './entities/finance-chart-source-authority.entity';
import { FinanceJournalCandidateService } from '../accounting/journal-entries/finance-journal-candidate.service';
import { FinanceApprovalService } from '../governance/finance-approvals/finance-approval.service';
import { FinanceEventPreviewService } from '../accounting/accounting-events/finance-event-preview.service';
import { FinanceIntakeService } from '../accounting/accounting-events/finance-intake.service';
import { FinanceReferenceDeliveryService } from '../integrations/finance-events/finance-reference-delivery.service';
import { FINANCE_REFERENCE_TRANSPORTS } from '../integrations/finance-events/finance-integration.types';
import { FinanceOperationsService } from '../governance/financial-controls/finance-operations.service';
import { FinanceQuotationBillingService } from '../integrations/quotation-finance/finance-quotation-billing.service';
import { FinanceReceivablesService } from '../receivables/receivable-controls/finance-receivables.service';
import { FinancePolicyService } from '../governance/accounting-policies/finance-policy.service';
import { FinanceLedgerFoundationService } from '../accounting/general-ledger/finance-ledger-foundation.service';
import { FinanceOutgoingService } from '../payables/outgoing-payments/finance-outgoing.service';
import { OUTGOING_SIMULATORS } from '../payables/outgoing-payments/finance-outgoing.types';
import { FinancePolicyChangeService } from '../governance/accounting-policies/finance-policy-change.service';
import { FinanceFoundationController } from './finance-foundation.controller';
import { FinanceAllocationSchedulerService } from '../accounting/allocations/finance-allocation-scheduler.service';
import { FinanceClaimsService } from '../payables/claims-controls/finance-claims.service';
import { FinanceCommissionService } from '../payables/commission-controls/finance-commission.service';

/** Versioned foundations and the /tenant/finance/foundation API. Importing this module never grants access, activates a policy or enables posting. */
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
  controllers: [FinanceFoundationController],
  providers: [
    FinanceAllocationSchedulerService,
    FinanceClaimsService,
    FinanceCommissionService,
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
    FinanceAllocationSchedulerService,
    FinanceClaimsService,
    FinanceCommissionService,
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
