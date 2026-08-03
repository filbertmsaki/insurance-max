import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../../shared/shared.module';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { ClaimAssessment } from './entities/claim-assessment.entity';
import { ClaimClaimant } from './entities/claim-claimant.entity';
import { ClaimDischargeVoucher } from './entities/claim-discharge-voucher.entity';
import { ClaimDocument } from './entities/claim-document.entity';
import { InsuranceClaim } from './entities/claim.entity';
import { ClaimIntimation } from './entities/claim-intimation.entity';
import { ClaimPayment } from './entities/claim-payment.entity';
import { ClaimRecovery } from './entities/claim-recovery.entity';
import { ClaimRejection } from './entities/claim-rejection.entity';
import { ClaimReserve } from './entities/claim-reserve.entity';
import { ClaimServiceAssignment } from './entities/claim-service-assignment.entity';
import { ClaimSlaEvent } from './entities/claim-sla-event.entity';
import { ClaimSlaRule } from './entities/claim-sla-rule.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { ComplaintStatusHistory } from './entities/complaint-status-history.entity';
import { Complaint } from './entities/complaint.entity';
import { ClaimSlaMonitorService } from './services/claim-sla-monitor.service';
import { ClaimSlaService } from './services/claim-sla.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceClaim,
      ClaimClaimant,
      ClaimDocument,
      ClaimReserve,
      ClaimIntimation,
      ClaimAssessment,
      ClaimServiceAssignment,
      ClaimDischargeVoucher,
      ClaimPayment,
      ClaimRejection,
      ClaimRecovery,
      ClaimStatusHistory,
      ClaimSlaRule,
      ClaimSlaEvent,
      Complaint,
      ComplaintStatusHistory,
      Policy,
      PolicyRisk,
    ]),
    SharedModule,
    TiramisModule,
    WorkItemsModule,
  ],
  controllers: [ClaimsController, ComplaintsController],
  providers: [
    ClaimsService,
    ComplaintsService,
    ClaimSlaService,
    ClaimSlaMonitorService,
  ],
  exports: [ClaimsService, ComplaintsService, ClaimSlaService],
})
export class ClaimsModule {}
