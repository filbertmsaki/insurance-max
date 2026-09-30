import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingCommissionModule } from '../billing-commission/billing-commission.module';
import { InsuranceDocumentsModule } from '../insurance-documents/insurance-documents.module';
import { SharedModule } from '../../shared/shared.module';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { CoverNote } from '../cover-notes/entities/cover-note.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Document } from '../insurance-documents/entities/document.entity';
import { DocumentLink } from '../insurance-documents/entities/document-link.entity';
import { User } from '../users/entities/user.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyVersion } from '../policies/entities/policy-version.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { ClaimApproval } from './entities/claim-approval.entity';
import { ClaimApprovalLimit } from './entities/claim-approval-limit.entity';
import { ClaimAssessment } from './entities/claim-assessment.entity';
import { ClaimDocumentRequirement } from './entities/claim-document-requirement.entity';
import { ClaimEvent } from './entities/claim-event.entity';
import { ClaimClaimant } from './entities/claim-claimant.entity';
import { ClaimDecision } from './entities/claim-decision.entity';
import { ClaimDischargeVoucher } from './entities/claim-discharge-voucher.entity';
import { ClaimDisbursement } from './entities/claim-disbursement.entity';
import { ClaimDocument } from './entities/claim-document.entity';
import { InsuranceClaim } from './entities/claim.entity';
import { ClaimIntimation } from './entities/claim-intimation.entity';
import { ClaimPayment } from './entities/claim-payment.entity';
import { ClaimRecovery } from './entities/claim-recovery.entity';
import { ClaimRegulatoryOperation } from './entities/claim-regulatory-operation.entity';
import { ClaimRejection } from './entities/claim-rejection.entity';
import { ClaimReserve } from './entities/claim-reserve.entity';
import { ClaimReserveMovement } from './entities/claim-reserve-movement.entity';
import { ClaimServiceAssignment } from './entities/claim-service-assignment.entity';
import { ClaimSlaEvent } from './entities/claim-sla-event.entity';
import { ClaimSlaRule } from './entities/claim-sla-rule.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { ComplaintAppeal } from './entities/complaint-appeal.entity';
import { ComplaintComment } from './entities/complaint-comment.entity';
import { ComplaintSlaEvent } from './entities/complaint-sla-event.entity';
import { ComplaintSlaRule } from './entities/complaint-sla-rule.entity';
import { ComplaintStatusHistory } from './entities/complaint-status-history.entity';
import { Complaint } from './entities/complaint.entity';
import { ClaimAccessService } from './services/claim-access.service';
import { ClaimApprovalService } from './services/claim-approval.service';
import { ClaimAssessmentService } from './services/claim-assessment.service';
import { ClaimCoverageService } from './services/claim-coverage.service';
import { ClaimDischargeService } from './services/claim-discharge.service';
import { ClaimDocumentService } from './services/claim-document.service';
import { ClaimIntimationService } from './services/claim-intimation.service';
import { ClaimPaymentService } from './services/claim-payment.service';
import { ClaimRejectionService } from './services/claim-rejection.service';
import { ClaimSettlementService } from './services/claim-settlement.service';
import { ClaimStateMachineService } from './services/claim-state-machine.service';
import { ClaimTiramisOutcomeService } from './services/claim-tiramis-outcome.service';
import { ClaimTiramisPayloadService } from './services/claim-tiramis-payload.service';
import { ClaimTiramisService } from './services/claim-tiramis.service';
import { ClaimsDashboardService } from './services/claims-dashboard.service';
import { ClaimDecisionService } from './services/claim-decision.service';
import { ClaimDisbursementService } from './services/claim-disbursement.service';
import { ClaimFinancialProjectionService } from './services/claim-financial-projection.service';
import { ClaimRecoveryService } from './services/claim-recovery.service';
import { ClaimReserveMovementService } from './services/claim-reserve-movement.service';
import { ClaimSlaMonitorService } from './services/claim-sla-monitor.service';
import { ClaimSlaService } from './services/claim-sla.service';
import { ComplaintSlaMonitorService } from './services/complaint-sla-monitor.service';
import { ComplaintSlaService } from './services/complaint-sla.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceClaim,
      ClaimClaimant,
      ClaimDocument,
      ClaimReserve,
      ClaimReserveMovement,
      ClaimIntimation,
      ClaimAssessment,
      ClaimDecision,
      ClaimServiceAssignment,
      ClaimDischargeVoucher,
      ClaimPayment,
      ClaimDisbursement,
      ClaimRejection,
      ClaimRecovery,
      ClaimRegulatoryOperation,
      ClaimStatusHistory,
      ClaimSlaRule,
      ClaimSlaEvent,
      Complaint,
      ComplaintStatusHistory,
      ComplaintAppeal,
      ComplaintComment,
      ComplaintSlaRule,
      ComplaintSlaEvent,
      ClaimApproval,
      ClaimApprovalLimit,
      ClaimDocumentRequirement,
      ClaimEvent,
      Policy,
      PolicyVersion,
      PolicyRisk,
      CoverNote,
      Customer,
      Document,
      DocumentLink,
      User,
    ]),
    BillingCommissionModule,
    InsuranceDocumentsModule,
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
    ClaimCoverageService,
    ClaimReserveMovementService,
    ClaimFinancialProjectionService,
    ClaimDecisionService,
    ClaimDisbursementService,
    ClaimRecoveryService,
    ComplaintSlaService,
    ComplaintSlaMonitorService,
    ClaimAccessService,
    ClaimStateMachineService,
    ClaimTiramisPayloadService,
    ClaimTiramisService,
    ClaimTiramisOutcomeService,
    ClaimSettlementService,
    ClaimApprovalService,
    ClaimIntimationService,
    ClaimAssessmentService,
    ClaimDischargeService,
    ClaimPaymentService,
    ClaimRejectionService,
    ClaimDocumentService,
    ClaimsDashboardService,
  ],
  exports: [
    ClaimTiramisOutcomeService,
    ClaimsService,
    ComplaintsService,
    ClaimSlaService,
    ClaimDecisionService,
    ClaimDisbursementService,
    ClaimRecoveryService,
  ],
})
export class ClaimsModule {}
