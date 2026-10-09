import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, EntityManager, In } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { DocumentGenerationService } from '../../insurance-documents/document-generation.service';
import { REJECTABLE_STATUSES } from '../claim-lifecycle';
import { ClaimsService } from '../claims.service';
import {
  CreateClaimRejectionDto,
  TiramisSubmitOptionsDto,
} from '../dto/claim-workflow.dto';
import { ClaimDischargeVoucher } from '../entities/claim-discharge-voucher.entity';
import { ClaimDisbursement } from '../entities/claim-disbursement.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import { ClaimRejection } from '../entities/claim-rejection.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
  ClaimDisbursementStatus,
  ClaimDischargeStatus,
  ClaimIntimationStatus,
  ClaimLiabilityStatus,
  ClaimPaymentStatus,
  ClaimRejectionStatus,
  ClaimSettlementStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimApprovalService } from './claim-approval.service';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';
import { ClaimTiramisService } from './claim-tiramis.service';

const REJECTION_SUBJECT = 'REJECTION';
export const REJECTION_LETTER_TEMPLATE = 'CLAIM_REJECTION_LETTER';

/**
 * Claim rejection (TIRAMIS §14): recommended, approved through the
 * authority matrix, then reported. A rejected claim is never deleted; it
 * moves to REJECTED and later CLOSED with its full history.
 */
@Injectable()
export class ClaimRejectionService {
  private readonly logger = new Logger(ClaimRejectionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: ClaimAccessService,
    private readonly claims: ClaimsService,
    private readonly referenceService: BusinessReferenceService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly approvals: ClaimApprovalService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
    private readonly documentGeneration: DocumentGenerationService,
  ) {}

  async create(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimRejectionDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (!REJECTABLE_STATUSES.includes(claim.status)) {
        throw new ConflictException(
          `A claim cannot be rejected from ${claim.status}`,
        );
      }

      await this.assertNothingPaid(manager, claim);

      const intimation = await manager.getRepository(ClaimIntimation).findOne({
        where: { claim_id: claim.id, status: ClaimIntimationStatus.ACCEPTED },
        order: { created_at: 'DESC' },
      });
      const claimants = await this.claims.activeClaimants(manager, claim.id);
      const rejection = await manager.getRepository(ClaimRejection).save(
        manager.getRepository(ClaimRejection).create({
          company_id: claim.company_id,
          branch_id: claim.branch_id,
          claim_id: claim.id,
          claim_rejection_number: await this.referenceService.next({
            companyId: claim.company_id,
            documentType: 'CLAIM_REJECTION',
            prefix: `CRJ-${new Date().getFullYear()}-`,
            manager,
          }),
          claim_reference_number: claim.claim_reference_number,
          claim_intimation_number: intimation?.claim_intimation_number ?? null,
          cover_note_reference_number: claim.cover_note_reference_number,
          rejection_date: new Date(),
          rejection_reason: dto.rejection_reason.trim(),
          tira_rejection_reason: dto.tira_rejection_reason.trim(),
          recommendation: dto.recommendation?.trim() ?? null,
          policy_clause_reference: dto.policy_clause_reference?.trim() ?? null,
          claim_resulted_litigation: dto.claim_resulted_litigation ? 'Y' : 'N',
          claim_amount: dto.claim_amount ?? claim.estimated_amount,
          currency_code: claim.currency_code,
          exchange_rate: claim.exchange_rate,
          claimants: claimants.map((claimant) =>
            this.tiramisPayload.identityClaimant(claimant),
          ) as unknown as Record<string, unknown>[],
          previous_claim_status: claim.status,
          status: ClaimRejectionStatus.PENDING_APPROVAL,
          created_by: user.id,
          submitted_by: user.id,
          submitted_at: new Date(),
          tiramis_status: 'NOT_SUBMITTED',
        }),
      );

      await this.approvals.submit(
        manager,
        this.subject(claim, rejection),
        user.id,
      );
      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.REJECTION_PENDING,
        {
          eventType: 'REJECTION_RECOMMENDED',
          summary: `Rejection ${rejection.claim_rejection_number} recommended: ${rejection.tira_rejection_reason}`,
          actorId: user.id,
          subjectType: REJECTION_SUBJECT,
          subjectId: rejection.id,
        },
      );

      return rejection;
    });
  }

  async approve(
    user: AuthenticatedUser,
    rejectionId: string,
    comments?: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, rejectionId);

      if (record.status !== ClaimRejectionStatus.PENDING_APPROVAL) {
        throw new ConflictException('Only a pending rejection can be approved');
      }

      const outcome = await this.approvals.approve(
        manager,
        user,
        this.subject(claim, record),
        comments,
      );

      if (!outcome.completed) {
        return { rejection: record, completed: false };
      }

      await this.assertNothingPaid(manager, claim);

      record.status = ClaimRejectionStatus.APPROVED;
      record.approved_by = user.id;
      record.approved_at = new Date();
      record.rejection_date = record.approved_at;
      await manager.getRepository(ClaimRejection).save(record);

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          liability_status: ClaimLiabilityStatus.DENIED,
          settlement_status: ClaimSettlementStatus.NO_PAYMENT_REQUIRED,
        },
      );
      await this.stateMachine.transition(manager, claim, ClaimStatus.REJECTED, {
        eventType: 'CLAIM_REJECTED',
        summary: `Claim rejected (${record.claim_rejection_number}): ${record.tira_rejection_reason}`,
        actorId: user.id,
        subjectType: REJECTION_SUBJECT,
        subjectId: record.id,
      });

      return { rejection: record, completed: true };
    });

    if (result.completed && result.rejection.claim_intimation_number) {
      try {
        await this.submitToTiramis(user, result.rejection.id);
      } catch (error: any) {
        this.logger.warn(
          `Rejection ${result.rejection.claim_rejection_number} not yet sent to TIRAMIS: ${error?.message}`,
        );
      }
    }

    return result;
  }

  async decline(
    user: AuthenticatedUser,
    rejectionId: string,
    comments: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, rejectionId);

      if (record.status !== ClaimRejectionStatus.PENDING_APPROVAL) {
        throw new ConflictException('Only a pending rejection can be declined');
      }

      await this.approvals.decline(
        manager,
        user,
        this.subject(claim, record),
        ClaimApprovalStatus.REJECTED,
        comments,
      );

      record.status = ClaimRejectionStatus.CANCELLED;
      await manager.getRepository(ClaimRejection).save(record);

      await this.stateMachine.revertPendingRejection(
        manager,
        claim,
        record.previous_claim_status as ClaimStatus,
        {
          eventType: 'REJECTION_DECLINED',
          summary: `Rejection ${record.claim_rejection_number} not approved: ${comments.trim()}`,
          actorId: user.id,
          subjectType: REJECTION_SUBJECT,
          subjectId: record.id,
        },
      );

      return record;
    });
  }

  async submitToTiramis(
    user: AuthenticatedUser,
    rejectionId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const { record, claim } = await this.dataSource.transaction((manager) =>
      this.lock(manager, user, rejectionId),
    );

    if (record.status !== ClaimRejectionStatus.APPROVED) {
      throw new ConflictException(
        'Only an approved rejection is reported to TIRAMIS',
      );
    }

    if (!claim.claim_reference_number || !record.claim_intimation_number) {
      throw new UnprocessableEntityException({
        code: 'CLAIM_REJECTION_NOT_REPORTABLE',
        message:
          'TIRAMIS requires the claim reference and an accepted intimation to report a rejection',
      });
    }

    return this.claimTiramis.submit({
      user,
      claim,
      operationType: ClaimRegulatoryOperationType.REJECTION,
      sourceRecordId: record.id,
      sourceRecordNumber: record.claim_rejection_number,
      payload: this.tiramisPayload.rejection(claim, record),
      retry: options.retry,
    });
  }

  async generateLetter(user: AuthenticatedUser, rejectionId: string) {
    const { record, claim } = await this.dataSource.transaction((manager) =>
      this.lock(manager, user, rejectionId),
    );

    if (record.status !== ClaimRejectionStatus.APPROVED) {
      throw new ConflictException(
        'A rejection letter needs an approved rejection',
      );
    }

    const full = await this.claims.findOne(user, claim.id);

    let document;
    try {
      document = await this.documentGeneration.request(user, {
        templateCode: REJECTION_LETTER_TEMPLATE,
        documentType: 'CLAIM_REJECTION_LETTER',
        title: `Claim rejection ${record.claim_rejection_number}`,
        sourceSnapshot: {
          rejection: {
            number: record.claim_rejection_number,
            date: record.rejection_date,
            reason: record.rejection_reason,
            policy_clause_reference: record.policy_clause_reference,
          },
          claim: {
            claim_no: claim.claim_no,
            claim_reference_number: claim.claim_reference_number,
            loss_date: claim.loss_date,
            loss_nature: claim.loss_nature,
          },
          policy: { policy_no: full.policy?.policy_no ?? null },
          customer: {
            name:
              full.customer?.display_name ??
              full.customer?.company_name ??
              [full.customer?.first_name, full.customer?.last_name]
                .filter(Boolean)
                .join(' '),
          },
        },
        resourceType: 'CLAIM',
        resourceId: claim.id,
        customerVisible: true,
        intermediaryVisible: true,
        publicVerificationEnabled: true,
        idempotencyKey: `claim-rejection-letter:${record.id}`,
      });
    } catch (error: any) {
      if (error?.status === 404 || /template/i.test(String(error?.message))) {
        throw new UnprocessableEntityException({
          code: 'CLAIM_TEMPLATE_NOT_CONFIGURED',
          message: `Publish a ${REJECTION_LETTER_TEMPLATE} document template to generate rejection letters`,
        });
      }
      throw error;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(ClaimRejection)
        .update({ id: record.id }, { letter_document_id: document.id });
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'REJECTION_LETTER_GENERATED',
        summary: `Rejection letter generated for ${record.claim_rejection_number}`,
        actorId: user.id,
        subjectType: REJECTION_SUBJECT,
        subjectId: record.id,
        sourceEventId: `rejection-letter:${record.id}:${document.id}`,
      });
    });

    return document;
  }

  private async assertNothingPaid(
    manager: EntityManager,
    claim: InsuranceClaim,
  ) {
    if (MoneyUtil.compare(claim.paid_amount, '0.00') > 0) {
      throw new ConflictException(
        'A claim with completed payments cannot be rejected',
      );
    }

    // Sequential: the manager is transactional (one pg connection).
    const disbursements = await manager.getRepository(ClaimDisbursement).count({
      where: {
        claim_id: claim.id,
        status: In([
          ClaimDisbursementStatus.REQUESTED,
          ClaimDisbursementStatus.PROCESSING,
          ClaimDisbursementStatus.PAID,
        ]),
      },
    });
    const payments = await manager.getRepository(ClaimPayment).count({
      where: {
        claim_id: claim.id,
        status: In([
          ClaimPaymentStatus.SUBMITTED,
          ClaimPaymentStatus.APPROVED,
          ClaimPaymentStatus.PROCESSING,
          ClaimPaymentStatus.PAID,
        ]),
      },
    });
    const acceptedVouchers = await manager
      .getRepository(ClaimDischargeVoucher)
      .count({
        where: { claim_id: claim.id, status: ClaimDischargeStatus.ACCEPTED },
      });

    if (disbursements || payments) {
      throw new ConflictException(
        'A claim with payments in progress cannot be rejected',
      );
    }

    if (acceptedVouchers) {
      throw new ConflictException(
        'A claim with an accepted discharge voucher cannot be rejected',
      );
    }
  }

  private lock(
    manager: EntityManager,
    user: AuthenticatedUser,
    rejectionId: string,
  ) {
    return this.access.getRecordForWrite(
      manager,
      user,
      ClaimRejection,
      rejectionId,
      'Claim rejection',
    );
  }

  private subject(claim: InsuranceClaim, rejection: ClaimRejection) {
    return {
      claim,
      subjectType: REJECTION_SUBJECT,
      subjectId: rejection.id,
      approvalType: ClaimApprovalType.REJECTION,
      amount: rejection.claim_amount,
      currencyCode: rejection.currency_code ?? claim.currency_code,
    };
  }
}
