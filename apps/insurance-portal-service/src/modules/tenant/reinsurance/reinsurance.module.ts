import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { SharedModule } from '../../shared/shared.module';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { InsuranceClaim } from '../claims/entities/claim.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { ReinsuranceController } from './reinsurance.controller';
import { ReinsuranceService } from './reinsurance.service';
import { FacultativePlacementOffer } from './entities/facultative-placement-offer.entity';
import { FacultativePlacement } from './entities/facultative-placement.entity';
import { PolicyCessionParticipant } from './entities/policy-cession-participant.entity';
import { PolicyCession } from './entities/policy-cession.entity';
import { ReinsuranceBordereauItem } from './entities/reinsurance-bordereau-item.entity';
import { ReinsuranceBordereau } from './entities/reinsurance-bordereau.entity';
import { ReinsuranceClaimRecovery } from './entities/reinsurance-claim-recovery.entity';
import { ReinsuranceDeclaration } from './entities/reinsurance-declaration.entity';
import { ReinsurancePremiumAccountItem } from './entities/reinsurance-premium-account-item.entity';
import { ReinsurancePremiumAccount } from './entities/reinsurance-premium-account.entity';
import { ReinsuranceReconciliationItem } from './entities/reinsurance-reconciliation-item.entity';
import { ReinsuranceSettlementItem } from './entities/reinsurance-settlement-item.entity';
import { ReinsuranceSettlement } from './entities/reinsurance-settlement.entity';
import { ReinsuranceTreatyParticipant } from './entities/reinsurance-treaty-participant.entity';
import { ReinsuranceTreatySection } from './entities/reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from './entities/reinsurance-treaty.entity';
import { ReinsuranceDeclarationSyncService } from './services/reinsurance-declaration-sync.service';
import { ReinsuranceRecoveryService } from './services/reinsurance-recovery.service';

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
      FacultativePlacement,
      FacultativePlacementOffer,
      PolicyCession,
      PolicyCessionParticipant,
      ReinsuranceDeclaration,
      ReinsuranceBordereau,
      ReinsuranceBordereauItem,
      ReinsurancePremiumAccount,
      ReinsurancePremiumAccountItem,
      ReinsuranceClaimRecovery,
      ReinsuranceSettlement,
      ReinsuranceSettlementItem,
      ReinsuranceReconciliationItem,
    ]),
    SharedModule,
    WorkItemsModule,
    TiramisModule,
  ],
  controllers: [ReinsuranceController],
  providers: [
    ReinsuranceService,
    ReinsuranceRecoveryService,
    ReinsuranceDeclarationSyncService,
  ],
  exports: [
    ReinsuranceService,
    ReinsuranceRecoveryService,
    ReinsuranceDeclarationSyncService,
  ],
})
export class ReinsuranceModule {}
