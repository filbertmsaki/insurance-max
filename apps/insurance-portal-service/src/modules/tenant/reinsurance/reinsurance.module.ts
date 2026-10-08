import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { SharedModule } from '../../shared/shared.module';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { InsurancePartnersModule } from '../insurance-partners/insurance-partners.module';
import { BillingCommissionModule } from '../billing-commission/billing-commission.module';
import { InsuranceClaim } from '../claims/entities/claim.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { ReinsuranceController } from './reinsurance.controller';
import { ReinsuranceService } from './reinsurance.service';
import { FacultativePlacementOffer } from './entities/facultative-placement-offer.entity';
import { FacultativePlacement } from './entities/facultative-placement.entity';
import { FacultativeSignedLine } from './entities/facultative-signed-line.entity';
import { PolicyCessionParticipant } from './entities/policy-cession-participant.entity';
import { PolicyCession } from './entities/policy-cession.entity';
import { ReinsuranceBordereauItem } from './entities/reinsurance-bordereau-item.entity';
import { ReinsuranceBordereau } from './entities/reinsurance-bordereau.entity';
import { ReinsuranceClaimRecovery } from './entities/reinsurance-claim-recovery.entity';
import { ReinsuranceCounterparty } from './entities/reinsurance-counterparty.entity';
import { ReinsuranceDeclaration } from './entities/reinsurance-declaration.entity';
import { ReinsurancePremiumAccountItem } from './entities/reinsurance-premium-account-item.entity';
import { ReinsurancePremiumAccount } from './entities/reinsurance-premium-account.entity';
import { ReinsuranceProgram } from './entities/reinsurance-program.entity';
import { ReinsuranceReconciliationItem } from './entities/reinsurance-reconciliation-item.entity';
import { ReinsuranceRecoveryReceipt } from './entities/reinsurance-recovery-receipt.entity';
import { ReinsuranceSettlementItem } from './entities/reinsurance-settlement-item.entity';
import { ReinsuranceSettlement } from './entities/reinsurance-settlement.entity';
import { ReinsuranceTreatyEligibilityRule } from './entities/reinsurance-treaty-eligibility-rule.entity';
import { ReinsuranceTreatyParticipant } from './entities/reinsurance-treaty-participant.entity';
import { ReinsuranceTreatySection } from './entities/reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from './entities/reinsurance-treaty.entity';
import { ReinsuranceCapacityService } from './services/reinsurance-capacity.service';
import { ReinsuranceAccountingService } from './services/reinsurance-accounting.service';
import { ReinsuranceDeclarationSyncService } from './services/reinsurance-declaration-sync.service';
import { ReinsuranceRecoveryService } from './services/reinsurance-recovery.service';
import { ReinsuranceSettlementService } from './services/reinsurance-settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Policy,
      PolicyRisk,
      InsuranceClaim,
      ReinsuranceTreaty,
      ReinsuranceTreatySection,
      ReinsuranceTreatyParticipant,
      ReinsuranceTreatyEligibilityRule,
      ReinsuranceProgram,
      ReinsuranceCounterparty,
      FacultativePlacement,
      FacultativePlacementOffer,
      FacultativeSignedLine,
      PolicyCession,
      PolicyCessionParticipant,
      ReinsuranceDeclaration,
      ReinsuranceBordereau,
      ReinsuranceBordereauItem,
      ReinsurancePremiumAccount,
      ReinsurancePremiumAccountItem,
      ReinsuranceClaimRecovery,
      ReinsuranceRecoveryReceipt,
      ReinsuranceSettlement,
      ReinsuranceSettlementItem,
      ReinsuranceReconciliationItem,
    ]),
    SharedModule,
    WorkItemsModule,
    TiramisModule,
    BillingCommissionModule,
    InsurancePartnersModule,
  ],
  controllers: [ReinsuranceController],
  providers: [
    ReinsuranceService,
    ReinsuranceRecoveryService,
    ReinsuranceDeclarationSyncService,
    ReinsuranceCapacityService,
    ReinsuranceAccountingService,
    ReinsuranceSettlementService,
  ],
  exports: [
    ReinsuranceService,
    ReinsuranceRecoveryService,
    ReinsuranceDeclarationSyncService,
    ReinsuranceCapacityService,
    ReinsuranceAccountingService,
    ReinsuranceSettlementService,
  ],
})
export class ReinsuranceModule {}
