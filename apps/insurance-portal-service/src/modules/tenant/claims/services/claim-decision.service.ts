import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { hasCompanyAdminRole } from '@insurance-max/portal-shared';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { ClaimDecisionType } from '@insurance-max/contracts';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import {
  ClaimDecisionStatus,
  ClaimSettlementStatus,
  ClaimStage,
} from '../enums/claim.enums';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimDecision } from '../entities/claim-decision.entity';
import type { CreateClaimDecisionDto } from '../dto/claim-decision.dto';

/**
 * Liability authority, separate from assessment approval (§14.8/14.17/14.18).
 * `ClaimAssessment.approveAssessment()` in `ClaimsService` keeps its
 * existing direct effects on the claim for backward compatibility — this
 * is an additional, independently-invokable path.
 */
@Injectable()
export class ClaimDecisionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClaimDecision)
    private readonly decisionRepository: Repository<ClaimDecision>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    private readonly referenceService: BusinessReferenceService,
    private readonly scopeService: DataAccessScopeService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async create(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimDecisionDto,
  ) {
    const claim = await this.requireClaim(user, claimId);

    const decisionNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_DECISION',
      prefix: `DEC-${new Date().getFullYear()}-`,
    });

    const decisionSnapshot = {
      claimId: claim.id,
      assessmentId: dto.assessment_id ?? null,
      decisionType: dto.decision_type,
      liabilityStatus: dto.liability_status,
      amountClaimed: MoneyUtil.fromMinor(MoneyUtil.toMinor(dto.amount_claimed)),
      amountAdmitted: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.amount_admitted),
      ),
      amountDeclined: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.amount_declined),
      ),
      reason: dto.reason.trim(),
    };

    return this.decisionRepository.save({
      company_id: claim.company_id,
      claim_id: claim.id,
      assessment_id: dto.assessment_id ?? null,
      decision_no: decisionNo,
      decision_type: dto.decision_type,
      liability_status: dto.liability_status,
      amount_claimed: decisionSnapshot.amountClaimed,
      amount_admitted: decisionSnapshot.amountAdmitted,
      amount_declined: decisionSnapshot.amountDeclined,
      currency_code: claim.currency_code,
      reason: dto.reason.trim(),
      decision_snapshot: decisionSnapshot,
      decision_snapshot_hash: this.hashService.hashDefinition(decisionSnapshot),
      status: ClaimDecisionStatus.DRAFT,
      created_by: user.id,
    });
  }

  async submit(user: AuthenticatedUser, decisionId: string) {
    const decision = await this.requireDecision(user.companyId!, decisionId);

    if (decision.status !== ClaimDecisionStatus.DRAFT) {
      throw new ConflictException('Only a draft decision can be submitted');
    }

    decision.status = ClaimDecisionStatus.SUBMITTED;
    decision.submitted_by = user.id;
    decision.submitted_at = new Date();

    return this.decisionRepository.save(decision);
  }

  async approve(user: AuthenticatedUser, decisionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const decision = await manager
        .getRepository(ClaimDecision)
        .createQueryBuilder('decision')
        .setLock('pessimistic_write')
        .where('decision.id = :id', { id: decisionId })
        .andWhere('decision.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!decision) {
        throw new NotFoundException('Claim decision not found');
      }

      if (decision.status !== ClaimDecisionStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted claim decision can be approved',
        );
      }

      if (
        [decision.created_by, decision.submitted_by].includes(user.id) &&
        !hasCompanyAdminRole(user)
      ) {
        throw new ForbiddenException({
          code: 'CLAIM_DECISION_MAKER_CHECKER_VIOLATION',
          message: 'The decision creator or submitter cannot approve it',
        });
      }

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: decision.claim_id })
        .getOneOrFail();

      decision.status = ClaimDecisionStatus.APPROVED;
      decision.approved_by = user.id;
      decision.approved_at = new Date();

      claim.liability_status = decision.liability_status;
      claim.approved_amount = decision.amount_admitted;
      claim.claim_stage = ClaimStage.DECISION;
      claim.settlement_status =
        decision.decision_type === ClaimDecisionType.DENY
          ? ClaimSettlementStatus.NO_PAYMENT_REQUIRED
          : ClaimSettlementStatus.DISCHARGE_PENDING;
      claim.state_version = Number(claim.state_version || 1) + 1;

      await manager.getRepository(ClaimDecision).save(decision);
      await manager.getRepository(InsuranceClaim).save(claim);

      return { decision, claim };
    });
  }

  async reject(user: AuthenticatedUser, decisionId: string, reason: string) {
    const decision = await this.requireDecision(user.companyId!, decisionId);

    if (decision.status !== ClaimDecisionStatus.SUBMITTED) {
      throw new ConflictException(
        'Only a submitted claim decision can be rejected',
      );
    }

    decision.status = ClaimDecisionStatus.REJECTED;
    decision.rejected_by = user.id;
    decision.rejected_at = new Date();
    decision.reason = reason.trim();

    return this.decisionRepository.save(decision);
  }

  findAll(companyId: string, claimId: string) {
    return this.decisionRepository.find({
      where: { company_id: companyId, claim_id: claimId },
      order: { created_at: 'DESC' },
    });
  }

  private async requireDecision(companyId: string, id: string) {
    const decision = await this.decisionRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!decision) {
      throw new NotFoundException('Claim decision not found');
    }

    return decision;
  }

  private async requireClaim(user: AuthenticatedUser, claimId: string) {
    this.scopeService.resolve(user);

    const claim = await this.claimRepository.findOne({
      where: { id: claimId, company_id: user.companyId! },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }
}
