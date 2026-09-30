import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  ClaimRegulatoryOperationType,
  ClaimReserveMovementType,
} from '@insurance-max/contracts';
import { DataSource, EntityManager } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { WorkItemsService } from '../../work-items/work-items.service';
import { ClaimsService } from '../claims.service';
import {
  CreateClaimIntimationDto,
  CreateClaimReserveDto,
  CreateServiceAssignmentDto,
  TiramisSubmitOptionsDto,
  UpdateClaimIntimationDto,
} from '../dto/claim-workflow.dto';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimReserve } from '../entities/claim-reserve.entity';
import { ClaimServiceAssignment } from '../entities/claim-service-assignment.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
  ClaimIntimationStatus,
  ClaimReserveStatus,
  ClaimServiceAssignmentStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimApprovalService } from './claim-approval.service';
import { ClaimFinancialProjectionService } from './claim-financial-projection.service';
import { ClaimReserveMovementService } from './claim-reserve-movement.service';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';
import { ClaimTiramisService } from './claim-tiramis.service';

const RESERVE_SUBJECT = 'RESERVE';

/**
 * Claim intimation (TIRAMIS §10), its reserve ledger and assessor
 * appointments. Reserves are never overwritten: every change is a reserve
 * row that goes through the authority matrix and, once approved, a signed
 * movement in claim_reserve_movements.
 */
@Injectable()
export class ClaimIntimationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: ClaimAccessService,
    private readonly claims: ClaimsService,
    private readonly referenceService: BusinessReferenceService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly approvals: ClaimApprovalService,
    private readonly reserveMovements: ClaimReserveMovementService,
    private readonly projection: ClaimFinancialProjectionService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
    private readonly workItemsService: WorkItemsService,
  ) {}

  async createIntimation(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimIntimationDto,
  ) {
    const intimation = await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (
        ![ClaimStatus.NOTIFICATION_ACCEPTED, ClaimStatus.INTIMATION_FAILED].includes(
          claim.status,
        )
      ) {
        throw new ConflictException(
          `A claim intimation cannot be created from ${claim.status}`,
        );
      }

      if (!claim.claim_reference_number) {
        throw new ConflictException(
          'TIRA has not issued a claim reference number for this claim yet',
        );
      }

      const open = await manager.getRepository(ClaimIntimation).findOne({
        where: [
          { claim_id: claim.id, status: ClaimIntimationStatus.DRAFT },
          { claim_id: claim.id, status: ClaimIntimationStatus.SUBMITTED },
        ],
      });

      if (open) {
        throw new ConflictException(
          `Intimation ${open.claim_intimation_number} is already ${open.status.toLowerCase()}`,
        );
      }

      this.validateAssessor(dto);

      const number = await this.referenceService.next({
        companyId: claim.company_id,
        documentType: 'CLAIM_INTIMATION',
        prefix: `INT-${new Date().getFullYear()}-`,
        manager,
      });
      const saved = await manager.getRepository(ClaimIntimation).save(
        manager.getRepository(ClaimIntimation).create({
          company_id: claim.company_id,
          branch_id: claim.branch_id,
          claim_id: claim.id,
          claim_intimation_number: number,
          claim_reference_number: claim.claim_reference_number,
          cover_note_reference_number: claim.cover_note_reference_number,
          claim_intimation_date: dto.claim_intimation_date
            ? new Date(dto.claim_intimation_date)
            : new Date(),
          currency_code: claim.currency_code,
          exchange_rate: dto.exchange_rate ?? claim.exchange_rate,
          claim_estimated_amount: dto.claim_estimated_amount ?? claim.estimated_amount,
          claim_reserve_amount: dto.claim_reserve_amount,
          claim_reserve_method: dto.claim_reserve_method.trim(),
          loss_assessment_option: dto.loss_assessment_option,
          assessor_name: dto.assessor_name.trim(),
          assessor_id_number: dto.assessor_id_number.trim(),
          assessor_id_type: dto.assessor_id_type,
          assessor_user_id: dto.assessor_user_id ?? null,
          assessor_company_id: dto.assessor_company_id ?? null,
          claimants: [],
          status: ClaimIntimationStatus.DRAFT,
          created_by: user.id,
          tiramis_status: 'NOT_SUBMITTED',
        }),
      );

      if (dto.exchange_rate) {
        await manager
          .getRepository(InsuranceClaim)
          .update({ id: claim.id }, { exchange_rate: dto.exchange_rate });
      }

      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.INTIMATION_PENDING,
        {
          eventType: 'INTIMATION_CREATED',
          summary: `Claim intimation ${number} prepared (reserve ${dto.claim_reserve_amount} ${claim.currency_code})`,
          actorId: user.id,
          subjectType: 'INTIMATION',
          subjectId: saved.id,
        },
      );

      if (MoneyUtil.compare(dto.claim_reserve_amount, '0.00') > 0) {
        await this.createReserveRow(manager, user, claim, {
          reserve_type: 'INITIAL',
          amount: dto.claim_reserve_amount,
          reason: `Initial reserve (${dto.claim_reserve_method.trim()}) from intimation ${number}`,
        });
      }

      return saved;
    });

    return intimation;
  }

  async updateIntimation(
    user: AuthenticatedUser,
    intimationId: string,
    dto: UpdateClaimIntimationDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimIntimation,
        intimationId,
        'Claim intimation',
      );

      if (![ClaimIntimationStatus.DRAFT, ClaimIntimationStatus.FAILED].includes(
        record.status as ClaimIntimationStatus,
      )) {
        throw new ConflictException('Only a draft or failed intimation can be edited');
      }

      const merged = {
        loss_assessment_option: record.loss_assessment_option,
        assessor_name: record.assessor_name ?? '',
        assessor_id_number: record.assessor_id_number ?? '',
        assessor_id_type: record.assessor_id_type ?? 0,
        ...dto,
      } as CreateClaimIntimationDto;
      this.validateAssessor(merged);

      if (dto.claim_estimated_amount !== undefined) record.claim_estimated_amount = dto.claim_estimated_amount;
      if (dto.claim_reserve_method !== undefined) record.claim_reserve_method = dto.claim_reserve_method.trim();
      if (dto.claim_intimation_date) record.claim_intimation_date = new Date(dto.claim_intimation_date);
      if (dto.exchange_rate) record.exchange_rate = dto.exchange_rate;
      if (dto.loss_assessment_option !== undefined) record.loss_assessment_option = dto.loss_assessment_option;
      if (dto.assessor_name !== undefined) record.assessor_name = dto.assessor_name.trim();
      if (dto.assessor_id_number !== undefined) record.assessor_id_number = dto.assessor_id_number.trim();
      if (dto.assessor_id_type !== undefined) record.assessor_id_type = dto.assessor_id_type;
      if (dto.assessor_user_id !== undefined) record.assessor_user_id = dto.assessor_user_id ?? null;
      if (dto.assessor_company_id !== undefined) record.assessor_company_id = dto.assessor_company_id ?? null;

      // The reserve itself changes only through the reserve ledger.
      if (
        dto.claim_reserve_amount !== undefined &&
        MoneyUtil.compare(dto.claim_reserve_amount, record.claim_reserve_amount) !== 0
      ) {
        const delta = MoneyUtil.subtract(dto.claim_reserve_amount, record.claim_reserve_amount);
        await this.createReserveRow(manager, user, claim, {
          reserve_type: MoneyUtil.compare(delta, '0.00') > 0 ? 'INCREASE' : 'DECREASE',
          amount: MoneyUtil.compare(delta, '0.00') > 0 ? delta : MoneyUtil.subtract('0.00', delta),
          reason: `Reserve revised on intimation ${record.claim_intimation_number}`,
        });
        record.claim_reserve_amount = dto.claim_reserve_amount;
      }

      const saved = await manager.getRepository(ClaimIntimation).save(record);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'INTIMATION_UPDATED',
        summary: `Intimation ${record.claim_intimation_number} updated`,
        actorId: user.id,
        subjectType: 'INTIMATION',
        subjectId: record.id,
      });

      return saved;
    });
  }

  async submitIntimation(
    user: AuthenticatedUser,
    intimationId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const { intimation, claim, payload } = await this.dataSource.transaction(
      async (manager) => {
        const { record, claim } = await this.access.getRecordForWrite(
          manager,
          user,
          ClaimIntimation,
          intimationId,
          'Claim intimation',
        );

        if (![ClaimIntimationStatus.DRAFT, ClaimIntimationStatus.FAILED].includes(
          record.status as ClaimIntimationStatus,
        )) {
          throw new ConflictException(
            `Intimation ${record.claim_intimation_number} is already ${record.status.toLowerCase()}`,
          );
        }

        if (claim.status === ClaimStatus.INTIMATION_FAILED) {
          await this.stateMachine.transition(manager, claim, ClaimStatus.INTIMATION_PENDING, {
            eventType: 'INTIMATION_RESUBMITTING',
            summary: `Resubmitting intimation ${record.claim_intimation_number}`,
            actorId: user.id,
          });
        }

        if (claim.status !== ClaimStatus.INTIMATION_PENDING) {
          throw new ConflictException(`The claim is ${claim.status}, not awaiting intimation`);
        }

        await this.claims.assertMandatoryDocuments(claim, 'INTIMATION', manager);

        const claimants = await this.claims.activeClaimants(manager, claim.id);
        this.claims.assertClaimantsComplete(claimants);

        // The claimants reported to TIRA are frozen on the intimation.
        record.claimants = claimants.map((claimant) =>
          this.tiramisPayload.fullClaimant(claimant),
        ) as unknown as Record<string, unknown>[];
        record.claim_reference_number = claim.claim_reference_number;
        record.status = ClaimIntimationStatus.SUBMITTED;
        record.submitted_by = user.id;
        record.submitted_at = new Date();
        await manager.getRepository(ClaimIntimation).save(record);

        return {
          intimation: record,
          claim,
          payload: this.tiramisPayload.intimation(claim, record, claimants),
        };
      },
    );

    try {
      return await this.claimTiramis.submit({
        user,
        claim,
        operationType: ClaimRegulatoryOperationType.INTIMATION,
        sourceRecordId: intimation.id,
        sourceRecordNumber: intimation.claim_intimation_number,
        payload,
        submittedStatus: ClaimStatus.INTIMATION_SUBMITTED,
        failedStatus: ClaimStatus.INTIMATION_FAILED,
        retry: options.retry || intimation.tiramis_status !== 'NOT_SUBMITTED',
      });
    } catch (error) {
      await this.dataSource
        .getRepository(ClaimIntimation)
        .update(
          { id: intimation.id, status: ClaimIntimationStatus.SUBMITTED },
          { status: ClaimIntimationStatus.FAILED },
        );
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Reserves
  // ---------------------------------------------------------------------

  async createReserve(user: AuthenticatedUser, claimId: string, dto: CreateClaimReserveDto) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if ([ClaimStatus.DRAFT, ClaimStatus.CLOSED, ClaimStatus.CANCELLED].includes(claim.status)) {
        throw new ConflictException(`Reserves cannot be changed while the claim is ${claim.status}`);
      }

      return this.createReserveRow(manager, user, claim, dto);
    });
  }

  async approveReserve(user: AuthenticatedUser, reserveId: string, comments?: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record: reserve, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimReserve,
        reserveId,
        'Claim reserve',
      );

      if (reserve.status !== ClaimReserveStatus.SUBMITTED) {
        throw new ConflictException('Only a submitted reserve can be approved');
      }

      const outcome = await this.approvals.approve(
        manager,
        user,
        this.reserveSubject(claim, reserve),
        comments,
      );

      if (!outcome.completed) {
        return { reserve, approval: outcome.approval, completed: false };
      }

      if (MoneyUtil.compare(reserve.amount, '0.00') < 0) {
        const projected = await this.projection.recalculate(manager, claim.id);
        const after = MoneyUtil.add(projected.gross_case_reserve, reserve.amount);

        if (MoneyUtil.compare(after, projected.paid_amount) < 0) {
          throw new ConflictException(
            'The reserve cannot be reduced below the amount already paid',
          );
        }
      }

      reserve.status = ClaimReserveStatus.APPROVED;
      reserve.approved_by = user.id;
      reserve.approved_at = new Date();
      await manager.getRepository(ClaimReserve).save(reserve);

      await this.recordMovement(manager, user, claim, reserve);

      return { reserve, approval: outcome.approval, completed: true };
    });
  }

  async declineReserve(user: AuthenticatedUser, reserveId: string, comments: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record: reserve, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimReserve,
        reserveId,
        'Claim reserve',
      );

      if (reserve.status !== ClaimReserveStatus.SUBMITTED) {
        throw new ConflictException('Only a submitted reserve can be declined');
      }

      await this.approvals.decline(
        manager,
        user,
        this.reserveSubject(claim, reserve),
        ClaimApprovalStatus.REJECTED,
        comments,
      );

      reserve.status = ClaimReserveStatus.REJECTED;
      reserve.rejected_by = user.id;
      reserve.rejected_at = new Date();
      reserve.rejection_reason = comments.trim();

      return manager.getRepository(ClaimReserve).save(reserve);
    });
  }

  async releaseReserve(user: AuthenticatedUser, reserveId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record: reserve, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimReserve,
        reserveId,
        'Claim reserve',
      );

      if (reserve.status !== ClaimReserveStatus.APPROVED) {
        throw new ConflictException('Only an approved reserve can be released');
      }

      const projected = await this.projection.recalculate(manager, claim.id);
      const remaining = MoneyUtil.subtract(projected.gross_case_reserve, reserve.amount);

      if (MoneyUtil.compare(remaining, projected.paid_amount) < 0) {
        throw new ConflictException(
          'Reserve cannot be released below the amount already paid on this claim',
        );
      }

      reserve.status = ClaimReserveStatus.RELEASED;
      reserve.released_by = user.id;
      reserve.released_at = new Date();
      reserve.release_reason = reason.trim();
      await manager.getRepository(ClaimReserve).save(reserve);

      await this.reserveMovements.record(
        manager,
        reserve,
        ClaimReserveMovementType.RELEASE,
        MoneyUtil.subtract('0.00', reserve.amount),
        reason.trim(),
        `reserve-released:${reserve.id}`,
        user.id,
      );
      await this.projection.recalculate(manager, claim.id);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'RESERVE_RELEASED',
        summary: `Reserve ${reserve.reserve_no} released: ${reason.trim()}`,
        actorId: user.id,
        subjectType: RESERVE_SUBJECT,
        subjectId: reserve.id,
      });

      return reserve;
    });
  }

  /**
   * Aligns the case reserve with a newly approved assessment through an
   * ASSESSMENT_ADJUSTMENT movement (approved with the assessment itself).
   */
  async adjustReserveToAssessment(
    manager: EntityManager,
    user: AuthenticatedUser,
    claim: InsuranceClaim,
    approvedAmount: string,
    assessmentNumber: string,
  ) {
    const projected = await this.projection.recalculate(manager, claim.id);
    const delta = MoneyUtil.subtract(approvedAmount, projected.gross_case_reserve);

    if (MoneyUtil.compare(delta, '0.00') === 0) {
      return;
    }

    const reserve = await manager.getRepository(ClaimReserve).save({
      company_id: claim.company_id,
      claim_id: claim.id,
      reserve_no: await this.nextReserveNo(manager, claim),
      reserve_type: ClaimReserveMovementType.ASSESSMENT_ADJUSTMENT,
      amount: delta,
      currency: claim.currency_code,
      reason: `Reserve aligned to approved assessment ${assessmentNumber}`,
      status: ClaimReserveStatus.APPROVED,
      effective_at: new Date(),
      created_by: user.id,
      submitted_by: user.id,
      submitted_at: new Date(),
      approved_by: user.id,
      approved_at: new Date(),
    });

    await this.reserveMovements.record(
      manager,
      reserve,
      ClaimReserveMovementType.ASSESSMENT_ADJUSTMENT,
      delta,
      reserve.reason,
      `reserve-assessment:${reserve.id}`,
      user.id,
    );
    await this.projection.recalculate(manager, claim.id);
  }

  // ---------------------------------------------------------------------
  // Assessor / service provider appointment
  // ---------------------------------------------------------------------

  async createServiceAssignment(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateServiceAssignmentDto,
  ) {
    const assignment = await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (!dto.provider_company_id && !dto.assigned_user_id) {
        throw new BadRequestException('Provider company or assigned user is required');
      }

      if (
        ![
          ClaimStatus.INTIMATED,
          ClaimStatus.ASSESSMENT_PENDING,
          ClaimStatus.UNDER_ASSESSMENT,
          ClaimStatus.REASSESSMENT_REQUIRED,
          ClaimStatus.REOPENED,
        ].includes(claim.status)
      ) {
        throw new ConflictException(
          `An assessor cannot be appointed while the claim is ${claim.status}`,
        );
      }

      const saved = await manager.getRepository(ClaimServiceAssignment).save({
        company_id: claim.company_id,
        claim_id: claim.id,
        provider_company_id: dto.provider_company_id ?? null,
        assigned_user_id: dto.assigned_user_id ?? null,
        service_type: dto.service_type.trim(),
        assignment_no: await this.referenceService.next({
          companyId: claim.company_id,
          documentType: 'CLAIM_SERVICE_ASSIGNMENT',
          prefix: `CSA-${new Date().getFullYear()}-`,
          manager,
        }),
        instructions: dto.instructions?.trim() ?? null,
        assigned_at: new Date(),
        due_at: dto.due_at ? new Date(dto.due_at) : null,
        estimated_fee: dto.estimated_fee ?? '0.00',
        approved_fee: '0.00',
        currency: claim.currency_code,
        status: ClaimServiceAssignmentStatus.ASSIGNED,
        created_by: user.id,
        metadata: null,
      });

      if (claim.status === ClaimStatus.INTIMATED) {
        await this.stateMachine.transition(manager, claim, ClaimStatus.ASSESSMENT_PENDING, {
          eventType: 'ASSESSOR_APPOINTED',
          summary: `${saved.service_type} appointed (${saved.assignment_no})`,
          actorId: user.id,
          subjectType: 'SERVICE_ASSIGNMENT',
          subjectId: saved.id,
        });
      } else {
        await this.stateMachine.recordEvent(manager, claim, {
          eventType: 'ASSESSOR_APPOINTED',
          summary: `${saved.service_type} appointed (${saved.assignment_no})`,
          actorId: user.id,
          subjectType: 'SERVICE_ASSIGNMENT',
          subjectId: saved.id,
        });
      }

      return { saved, claim };
    });

    await this.workItemsService.create({
      companyId: assignment.claim.company_id,
      branchId: assignment.claim.branch_id,
      domain: 'CLAIMS',
      resourceType: 'claim',
      resourceId: assignment.claim.id,
      title: `Complete ${assignment.saved.service_type} for ${assignment.claim.claim_no}`,
      priority: assignment.claim.priority,
      assignedUserId: assignment.saved.assigned_user_id ?? undefined,
      assignedRole: assignment.saved.assigned_user_id ? undefined : 'CLAIMS_ASSESSOR',
      dueAt: assignment.saved.due_at ?? undefined,
      dedupeKey: `claim-assignment:${assignment.saved.id}`,
      createdBy: user.id,
    });

    return assignment.saved;
  }

  // ---------------------------------------------------------------------

  private async createReserveRow(
    manager: EntityManager,
    user: AuthenticatedUser,
    claim: InsuranceClaim,
    dto: Pick<CreateClaimReserveDto, 'reserve_type' | 'amount' | 'reason' | 'effective_at'>,
  ) {
    if (MoneyUtil.compare(dto.amount, '0.00') <= 0) {
      throw new BadRequestException('Reserve amount must be greater than zero');
    }

    const signed =
      dto.reserve_type === 'DECREASE' ? MoneyUtil.subtract('0.00', dto.amount) : dto.amount;
    const reserve = await manager.getRepository(ClaimReserve).save({
      company_id: claim.company_id,
      claim_id: claim.id,
      reserve_no: await this.nextReserveNo(manager, claim),
      reserve_type: dto.reserve_type,
      amount: signed,
      currency: claim.currency_code,
      reason: dto.reason.trim(),
      status: ClaimReserveStatus.SUBMITTED,
      effective_at: dto.effective_at ? new Date(dto.effective_at) : new Date(),
      created_by: user.id,
      submitted_by: user.id,
      submitted_at: new Date(),
    });

    await this.approvals.submit(manager, this.reserveSubject(claim, reserve), user.id);

    return reserve;
  }

  private async recordMovement(
    manager: EntityManager,
    user: AuthenticatedUser,
    claim: InsuranceClaim,
    reserve: ClaimReserve,
  ) {
    const projected = await this.projection.recalculate(manager, claim.id);
    const type =
      reserve.reserve_type === 'DECREASE'
        ? ClaimReserveMovementType.DECREASE
        : MoneyUtil.compare(projected.gross_case_reserve, '0.00') === 0
          ? ClaimReserveMovementType.INITIAL
          : claim.status === ClaimStatus.REOPENED
            ? ClaimReserveMovementType.REOPEN
            : ClaimReserveMovementType.INCREASE;

    await this.reserveMovements.record(
      manager,
      reserve,
      type,
      reserve.amount,
      reserve.reason,
      `reserve-approved:${reserve.id}`,
      user.id,
    );
    await this.projection.recalculate(manager, claim.id);
    await this.stateMachine.recordEvent(manager, claim, {
      eventType: 'RESERVE_APPROVED',
      summary: `Reserve ${reserve.reserve_no} approved (${reserve.amount} ${reserve.currency}, ${type})`,
      actorId: user.id,
      subjectType: RESERVE_SUBJECT,
      subjectId: reserve.id,
      metadata: {
        previous_reserve: projected.gross_case_reserve,
        adjustment: reserve.amount,
        new_reserve: MoneyUtil.add(projected.gross_case_reserve, reserve.amount),
      },
    });
  }

  private reserveSubject(claim: InsuranceClaim, reserve: ClaimReserve) {
    return {
      claim,
      subjectType: RESERVE_SUBJECT,
      subjectId: reserve.id,
      approvalType: ClaimApprovalType.RESERVE,
      amount:
        MoneyUtil.compare(reserve.amount, '0.00') < 0
          ? MoneyUtil.subtract('0.00', reserve.amount)
          : reserve.amount,
      currencyCode: reserve.currency,
    };
  }

  private nextReserveNo(manager: EntityManager, claim: InsuranceClaim) {
    return this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_RESERVE',
      prefix: `RSV-${new Date().getFullYear()}-`,
      manager,
    });
  }

  /** TIRAMIS §10.1: assessor identity is mandatory for both options. */
  private validateAssessor(dto: CreateClaimIntimationDto) {
    if (![1, 2].includes(dto.loss_assessment_option)) {
      throw new BadRequestException('Loss assessment option must be 1 (in-house) or 2 (external)');
    }

    if (!dto.assessor_name?.trim() || !dto.assessor_id_number?.trim()) {
      throw new BadRequestException('Assessor name and identification number are required');
    }

    if (!Number.isInteger(dto.assessor_id_type) || dto.assessor_id_type < 1 || dto.assessor_id_type > 7) {
      throw new BadRequestException('Assessor identification type must be between 1 and 7');
    }
  }
}
