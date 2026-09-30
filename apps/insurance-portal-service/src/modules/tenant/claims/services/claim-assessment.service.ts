import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, EntityManager, In } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { Policy } from '../../policies/entities/policy.entity';
import { ClaimsService } from '../claims.service';
import {
  CreateClaimAssessmentDto,
  TiramisSubmitOptionsDto,
  UpdateClaimAssessmentDto,
} from '../dto/claim-workflow.dto';
import { ClaimAssessment } from '../entities/claim-assessment.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimRegulatoryOperation } from '../entities/claim-regulatory-operation.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
  ClaimAssessmentStatus,
  ClaimIntimationStatus,
  ClaimLiabilityStatus,
  ClaimRegulatoryStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimApprovalService } from './claim-approval.service';
import { ClaimIntimationService } from './claim-intimation.service';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';
import { ClaimTiramisService } from './claim-tiramis.service';

const ASSESSMENT_SUBJECT = 'ASSESSMENT';

/** Claim states from which a (re)assessment may be started. */
const ASSESSABLE_STATUSES = [
  ClaimStatus.INTIMATED,
  ClaimStatus.ASSESSMENT_PENDING,
  ClaimStatus.REASSESSMENT_REQUIRED,
  ClaimStatus.APPROVED,
  ClaimStatus.DISCHARGE_REJECTED,
  ClaimStatus.REOPENED,
];

/**
 * Claim assessment (TIRAMIS §11). Assessments are never overwritten: a
 * reassessment is a new record that supersedes the previous approved one
 * and is reported to TIRA with IsReAssessment = Y.
 */
@Injectable()
export class ClaimAssessmentService {
  private readonly logger = new Logger(ClaimAssessmentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: ClaimAccessService,
    private readonly claims: ClaimsService,
    private readonly referenceService: BusinessReferenceService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly approvals: ClaimApprovalService,
    private readonly intimations: ClaimIntimationService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
  ) {}

  async createAssessment(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimAssessmentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (!ASSESSABLE_STATUSES.includes(claim.status)) {
        throw new ConflictException(
          `An assessment cannot be recorded while the claim is ${claim.status}`,
        );
      }

      const draft = await manager.getRepository(ClaimAssessment).findOne({
        where: {
          claim_id: claim.id,
          status: In([
            ClaimAssessmentStatus.DRAFT,
            ClaimAssessmentStatus.SUBMITTED,
          ]),
        },
      });

      if (draft) {
        throw new ConflictException(
          `Assessment ${draft.claim_assessment_number} is still ${draft.status.toLowerCase()}`,
        );
      }

      const intimation = await this.acceptedIntimation(manager, claim);
      await this.validateAmounts(manager, claim, dto);

      const previous = await manager.getRepository(ClaimAssessment).findOne({
        where: { claim_id: claim.id, status: ClaimAssessmentStatus.APPROVED },
        order: { approved_at: 'DESC' },
      });
      const number = await this.referenceService.next({
        companyId: claim.company_id,
        documentType: 'CLAIM_ASSESSMENT',
        prefix: `ASM-${new Date().getFullYear()}-`,
        manager,
      });
      const assessment = await manager.getRepository(ClaimAssessment).save(
        manager.getRepository(ClaimAssessment).create({
          company_id: claim.company_id,
          branch_id: claim.branch_id,
          claim_id: claim.id,
          service_assignment_id: dto.service_assignment_id ?? null,
          supersedes_assessment_id: previous?.id ?? null,
          claim_assessment_number: number,
          claim_intimation_number: intimation.claim_intimation_number,
          claim_reference_number: claim.claim_reference_number,
          cover_note_reference_number: claim.cover_note_reference_number,
          assessment_received_date: new Date(dto.assessment_received_date),
          assessment_report_summary: dto.assessment_report_summary.trim(),
          currency_code: claim.currency_code,
          exchange_rate: claim.exchange_rate,
          ...this.amountColumns(dto),
          is_re_assessment: previous ? 'Y' : 'N',
          claimants: [],
          status: ClaimAssessmentStatus.DRAFT,
          created_by: user.id,
          tiramis_status: 'NOT_SUBMITTED',
        }),
      );

      if (
        [ClaimStatus.APPROVED, ClaimStatus.DISCHARGE_REJECTED].includes(
          claim.status,
        )
      ) {
        await this.stateMachine.transition(
          manager,
          claim,
          ClaimStatus.REASSESSMENT_REQUIRED,
          {
            eventType: 'REASSESSMENT_STARTED',
            summary: `Reassessment ${number} started`,
            actorId: user.id,
            subjectType: ASSESSMENT_SUBJECT,
            subjectId: assessment.id,
          },
        );
      }

      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.UNDER_ASSESSMENT,
        {
          eventType: previous ? 'REASSESSMENT_CREATED' : 'ASSESSMENT_CREATED',
          summary: `${previous ? 'Reassessment' : 'Assessment'} ${number} recorded (${dto.approved_claim_amount} ${claim.currency_code} recommended)`,
          actorId: user.id,
          subjectType: ASSESSMENT_SUBJECT,
          subjectId: assessment.id,
        },
      );

      return assessment;
    });
  }

  async updateAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
    dto: UpdateClaimAssessmentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimAssessment,
        assessmentId,
        'Claim assessment',
      );

      if (record.status !== ClaimAssessmentStatus.DRAFT) {
        throw new ConflictException('Only a draft assessment can be edited');
      }

      const merged = {
        assessment_amount: record.assessment_amount,
        approved_claim_amount: record.approved_claim_amount,
        ...dto,
      } as CreateClaimAssessmentDto;
      await this.validateAmounts(manager, claim, merged);

      if (dto.assessment_received_date) {
        record.assessment_received_date = new Date(
          dto.assessment_received_date,
        );
      }
      if (dto.assessment_report_summary !== undefined) {
        record.assessment_report_summary = dto.assessment_report_summary.trim();
      }
      if (dto.service_assignment_id !== undefined) {
        record.service_assignment_id = dto.service_assignment_id ?? null;
      }
      Object.assign(record, this.amountColumns(merged, record));

      const saved = await manager.getRepository(ClaimAssessment).save(record);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'ASSESSMENT_UPDATED',
        summary: `Assessment ${record.claim_assessment_number} updated`,
        actorId: user.id,
        subjectType: ASSESSMENT_SUBJECT,
        subjectId: record.id,
      });

      return saved;
    });
  }

  async submitAssessment(user: AuthenticatedUser, assessmentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimAssessment,
        assessmentId,
        'Claim assessment',
      );

      if (record.status !== ClaimAssessmentStatus.DRAFT) {
        throw new ConflictException('Only a draft assessment can be submitted');
      }

      await this.claims.assertMandatoryDocuments(claim, 'ASSESSMENT', manager);

      record.status = ClaimAssessmentStatus.SUBMITTED;
      record.submitted_by = user.id;
      record.submitted_at = new Date();
      await manager.getRepository(ClaimAssessment).save(record);

      await this.stateMachine.transition(manager, claim, ClaimStatus.ASSESSED, {
        eventType: 'ASSESSMENT_SUBMITTED',
        summary: `Assessment ${record.claim_assessment_number} submitted`,
        actorId: user.id,
        subjectType: ASSESSMENT_SUBJECT,
        subjectId: record.id,
      });
      await this.approvals.submit(
        manager,
        this.subject(claim, record),
        user.id,
      );
      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.PENDING_APPROVAL,
        {
          eventType: 'APPROVAL_PENDING',
          summary: `Assessment ${record.claim_assessment_number} awaiting approval`,
          actorId: user.id,
          subjectType: ASSESSMENT_SUBJECT,
          subjectId: record.id,
        },
      );

      return record;
    });
  }

  async approveAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
    comments?: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimAssessment,
        assessmentId,
        'Claim assessment',
      );

      if (record.status !== ClaimAssessmentStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted assessment can be approved',
        );
      }

      const outcome = await this.approvals.approve(
        manager,
        user,
        this.subject(claim, record),
        comments,
      );

      if (!outcome.completed) {
        return { assessment: record, completed: false, claim };
      }

      if (
        MoneyUtil.compare(record.approved_claim_amount, claim.paid_amount) < 0
      ) {
        throw new ConflictException(
          'The approved amount cannot be below what has already been paid',
        );
      }

      if (record.supersedes_assessment_id) {
        await manager
          .getRepository(ClaimAssessment)
          .update(
            { id: record.supersedes_assessment_id },
            { status: ClaimAssessmentStatus.SUPERSEDED },
          );
      }

      record.status = ClaimAssessmentStatus.APPROVED;
      record.approved_by = user.id;
      record.approved_at = new Date();
      record.claim_approval_date = record.approved_at;
      record.claim_approval_authority = outcome.authority ?? user.email;
      await manager.getRepository(ClaimAssessment).save(record);

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          approved_amount: record.approved_claim_amount,
          current_assessment_id: record.id,
          liability_status: ClaimLiabilityStatus.ADMITTED,
        },
      );
      claim.approved_amount = record.approved_claim_amount;

      await this.intimations.adjustReserveToAssessment(
        manager,
        user,
        claim,
        record.approved_claim_amount,
        record.claim_assessment_number,
      );

      const fresh = await manager
        .getRepository(InsuranceClaim)
        .findOneOrFail({ where: { id: claim.id } });
      await this.stateMachine.transition(manager, fresh, ClaimStatus.APPROVED, {
        eventType: 'CLAIM_APPROVED',
        summary: `Assessment ${record.claim_assessment_number} approved: ${record.approved_claim_amount} ${record.currency_code}`,
        actorId: user.id,
        subjectType: ASSESSMENT_SUBJECT,
        subjectId: record.id,
      });

      return { assessment: record, completed: true, claim: fresh };
    });

    if (result.completed) {
      // Reporting to TIRA is attempted immediately; a failure stays visible
      // on the TIRA tab and can be retried without affecting the approval.
      try {
        await this.submitAssessmentToTiramis(user, result.assessment.id);
      } catch (error: any) {
        this.logger.warn(
          `Assessment ${result.assessment.claim_assessment_number} not yet sent to TIRAMIS: ${error?.message}`,
        );
      }
    }

    return { assessment: result.assessment, completed: result.completed };
  }

  async declineAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
    comments: string,
    decision: 'REJECT' | 'RETURN' = 'REJECT',
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimAssessment,
        assessmentId,
        'Claim assessment',
      );

      if (record.status !== ClaimAssessmentStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted assessment can be declined',
        );
      }

      await this.approvals.decline(
        manager,
        user,
        this.subject(claim, record),
        decision === 'RETURN'
          ? ClaimApprovalStatus.RETURNED
          : ClaimApprovalStatus.REJECTED,
        comments,
      );

      record.status = ClaimAssessmentStatus.REJECTED;
      record.rejected_by = user.id;
      record.rejected_at = new Date();
      record.rejection_reason = comments.trim();
      await manager.getRepository(ClaimAssessment).save(record);

      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.REASSESSMENT_REQUIRED,
        {
          eventType:
            decision === 'RETURN'
              ? 'ASSESSMENT_RETURNED'
              : 'ASSESSMENT_REJECTED',
          summary: `Assessment ${record.claim_assessment_number} ${
            decision === 'RETURN' ? 'returned for rework' : 'declined'
          }: ${comments.trim()}`,
          actorId: user.id,
          subjectType: ASSESSMENT_SUBJECT,
          subjectId: record.id,
        },
      );

      return record;
    });
  }

  async submitAssessmentToTiramis(
    user: AuthenticatedUser,
    assessmentId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const { record, claim, payload } = await this.dataSource.transaction(
      async (manager) => {
        const { record, claim } = await this.access.getRecordForWrite(
          manager,
          user,
          ClaimAssessment,
          assessmentId,
          'Claim assessment',
        );

        if (
          ![
            ClaimAssessmentStatus.APPROVED,
            ClaimAssessmentStatus.SUPERSEDED,
          ].includes(record.status)
        ) {
          throw new ConflictException(
            'Only an approved assessment can be submitted to TIRAMIS',
          );
        }

        if (!claim.claim_reference_number) {
          throw new ConflictException(
            'The claim has no TIRA claim reference number',
          );
        }

        await this.assertIntimationAccepted(
          manager,
          claim,
          record.claim_intimation_number,
        );

        const claimants = await this.claims.activeClaimants(manager, claim.id);
        record.claimants = claimants.map((claimant) =>
          this.tiramisPayload.identityClaimant(claimant),
        ) as unknown as Record<string, unknown>[];
        await manager.getRepository(ClaimAssessment).save(record);

        return {
          record,
          claim,
          payload: this.tiramisPayload.assessment(claim, record, claimants),
        };
      },
    );

    return this.claimTiramis.submit({
      user,
      claim,
      operationType: ClaimRegulatoryOperationType.ASSESSMENT,
      sourceRecordId: record.id,
      sourceRecordNumber: record.claim_assessment_number,
      payload,
      retry: options.retry,
    });
  }

  private subject(claim: InsuranceClaim, assessment: ClaimAssessment) {
    return {
      claim,
      subjectType: ASSESSMENT_SUBJECT,
      subjectId: assessment.id,
      approvalType: ClaimApprovalType.ASSESSMENT,
      amount: assessment.approved_claim_amount,
      currencyCode: assessment.currency_code,
    };
  }

  private async acceptedIntimation(
    manager: EntityManager,
    claim: InsuranceClaim,
  ) {
    const intimation = await manager.getRepository(ClaimIntimation).findOne({
      where: { claim_id: claim.id, status: ClaimIntimationStatus.ACCEPTED },
      order: { created_at: 'DESC' },
    });

    if (!intimation) {
      throw new ConflictException(
        'TIRA must accept the claim intimation before the claim can be assessed',
      );
    }

    return intimation;
  }

  private async assertIntimationAccepted(
    manager: EntityManager,
    claim: InsuranceClaim,
    intimationNumber: string | null,
  ) {
    const accepted = await manager
      .getRepository(ClaimRegulatoryOperation)
      .count({
        where: {
          claim_id: claim.id,
          operation_type: ClaimRegulatoryOperationType.INTIMATION,
          source_record_number: intimationNumber ?? '',
          status: ClaimRegulatoryStatus.ACCEPTED,
        },
      });

    if (!accepted) {
      throw new ConflictException(
        'TIRA has not accepted the claim intimation this assessment refers to',
      );
    }
  }

  private async validateAmounts(
    manager: EntityManager,
    claim: InsuranceClaim,
    dto: Pick<
      CreateClaimAssessmentDto,
      'assessment_amount' | 'approved_claim_amount'
    > &
      Partial<CreateClaimAssessmentDto>,
  ) {
    if (
      MoneyUtil.compare(dto.approved_claim_amount, dto.assessment_amount) > 0
    ) {
      throw new BadRequestException(
        'The approved claim amount cannot exceed the assessed loss amount',
      );
    }

    const policy = await manager.getRepository(Policy).findOne({
      where: { id: claim.policy_id },
      select: ['id', 'sum_insured'],
    });

    if (
      policy &&
      MoneyUtil.compare(policy.sum_insured ?? '0.00', '0.00') > 0 &&
      MoneyUtil.compare(dto.approved_claim_amount, policy.sum_insured) > 0
    ) {
      throw new BadRequestException(
        `The approved claim amount exceeds the policy sum insured (${policy.sum_insured})`,
      );
    }
  }

  private amountColumns(
    dto: Partial<CreateClaimAssessmentDto>,
    current?: ClaimAssessment,
  ) {
    const pick = (
      key: keyof CreateClaimAssessmentDto & keyof ClaimAssessment,
    ) => dto[key] ?? (current?.[key] as string | undefined) ?? '0.00';

    return {
      assessment_amount: pick('assessment_amount'),
      approved_claim_amount: pick('approved_claim_amount'),
      recommended_amount: pick('recommended_amount'),
      deductible_amount: pick('deductible_amount'),
      salvage_amount: pick('salvage_amount'),
      contribution_amount: pick('contribution_amount'),
      betterment_amount: pick('betterment_amount'),
      recovery_amount: pick('recovery_amount'),
      assessor_name:
        dto.assessor_name?.trim() ?? current?.assessor_name ?? null,
      assessor_company:
        dto.assessor_company?.trim() ?? current?.assessor_company ?? null,
      inspection_date:
        dto.inspection_date?.slice(0, 10) ?? current?.inspection_date ?? null,
      remarks: dto.remarks?.trim() ?? current?.remarks ?? null,
    };
  }
}
