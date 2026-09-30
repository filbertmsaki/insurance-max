import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hasCompanyAdminRole } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { EntityManager, Repository } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { Policy } from '../../policies/entities/policy.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimApproval } from '../entities/claim-approval.entity';
import { ClaimApprovalLimit } from '../entities/claim-approval-limit.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
} from '../enums/claim.enums';
import { ClaimStateMachineService } from './claim-state-machine.service';

export interface ApprovalSubject {
  claim: InsuranceClaim;
  subjectType: string;
  subjectId: string;
  approvalType: ClaimApprovalType;
  amount: string;
  currencyCode: string;
}

export interface ApprovalOutcome {
  approval: ClaimApproval;
  /** True once the final required level has approved. */
  completed: boolean;
  /** Name/title of the final approver, for ClaimApprovalAuthority. */
  authority: string | null;
}

/**
 * Claims authority matrix (docs/claims-module-design.md §10).
 *
 * The levels a subject needs are the distinct levels that have an active
 * band starting at or below its amount, so higher amounts escalate through
 * every lower level. With nothing configured a single approval level applies
 * and any holder of the stage's approve permission may act, which preserves
 * the pre-matrix behaviour. Makers cannot approve their own subject and one
 * person cannot approve two levels of the same round; company
 * administrators keep the existing bypass, which is recorded and audited.
 */
@Injectable()
export class ClaimApprovalService {
  constructor(
    @InjectRepository(ClaimApproval)
    private readonly approvalRepository: Repository<ClaimApproval>,
    @InjectRepository(ClaimApprovalLimit)
    private readonly limitRepository: Repository<ClaimApprovalLimit>,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly auditService: AuditService,
  ) {}

  async submit(
    manager: EntityManager,
    subject: ApprovalSubject,
    submittedBy: string,
  ): Promise<ClaimApproval[]> {
    const repository = manager.getRepository(ClaimApproval);
    const limits = await this.matchingLimits(manager, subject);
    const amount = this.toBase(subject);
    const levels = [
      ...new Set(
        limits
          .filter((limit) => MoneyUtil.compare(limit.min_amount, amount) <= 0)
          .map((limit) => limit.level),
      ),
    ].sort((a, b) => a - b);
    const requiredLevels = levels.length ? levels : [1];

    const previous = await repository
      .createQueryBuilder('approval')
      .select('COALESCE(MAX(approval.round), 0)', 'round')
      .where('approval.subject_type = :type', { type: subject.subjectType })
      .andWhere('approval.subject_id = :id', { id: subject.subjectId })
      .getRawOne<{ round: string }>();
    const round = Number(previous?.round ?? 0) + 1;

    await repository.update(
      {
        subject_type: subject.subjectType,
        subject_id: subject.subjectId,
        status: ClaimApprovalStatus.PENDING,
      },
      { status: ClaimApprovalStatus.SUPERSEDED },
    );

    const now = new Date();
    const rows = requiredLevels.map((level) =>
      repository.create({
        company_id: subject.claim.company_id,
        claim_id: subject.claim.id,
        subject_type: subject.subjectType,
        subject_id: subject.subjectId,
        approval_type: subject.approvalType,
        round,
        level,
        required_levels: requiredLevels.length,
        amount: subject.amount,
        currency_code: subject.currencyCode,
        status: ClaimApprovalStatus.PENDING,
        submitted_by: submittedBy,
        submitted_at: now,
      }),
    );

    const saved = await repository.save(rows);

    await this.stateMachine.recordEvent(manager, subject.claim, {
      eventType: 'APPROVAL_REQUESTED',
      summary: `${this.humanize(subject.approvalType)} of ${MoneyUtil.fromMinor(
        MoneyUtil.toMinor(subject.amount),
      )} ${subject.currencyCode} submitted for ${requiredLevels.length} approval level(s)`,
      actorId: submittedBy,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      metadata: { round, levels: requiredLevels },
    });

    return saved;
  }

  async approve(
    manager: EntityManager,
    user: AuthenticatedUser,
    subject: ApprovalSubject,
    comments?: string | null,
  ): Promise<ApprovalOutcome> {
    const pending = await this.currentPending(manager, subject);
    const round = await this.roundRows(manager, subject, pending.round);
    const isAdmin = hasCompanyAdminRole(user);
    const selfApproval =
      pending.submitted_by === user.id ||
      round.some(
        (row) =>
          row.status === ClaimApprovalStatus.APPROVED && row.acted_by === user.id,
      );

    if (selfApproval && !isAdmin) {
      throw new ForbiddenException({
        code: 'CLAIM_APPROVAL_SEGREGATION_OF_DUTIES',
        message:
          'You submitted this item or already approved another level of it',
      });
    }

    const limit = await this.assertAuthority(manager, user, subject, pending);

    pending.status = ClaimApprovalStatus.APPROVED;
    pending.acted_by = user.id;
    pending.acted_at = new Date();
    pending.comments = comments?.trim() || null;
    pending.limit_id = limit?.id ?? null;
    pending.admin_override = selfApproval && isAdmin;

    await manager.getRepository(ClaimApproval).save(pending);

    const completed = pending.level === Math.max(...round.map((r) => r.level));

    await this.stateMachine.recordEvent(manager, subject.claim, {
      eventType: 'APPROVAL_GRANTED',
      summary: `Level ${pending.level}/${pending.required_levels} approval of ${this.humanize(
        subject.approvalType,
      )}`,
      actorId: user.id,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      metadata: {
        round: pending.round,
        level: pending.level,
        completed,
        admin_override: pending.admin_override,
      },
    });

    await this.auditService.logCritical(
      {
        userId: user.id,
        companyId: subject.claim.company_id,
        action: pending.admin_override
          ? 'claim.approval.admin_override'
          : 'claim.approval.granted',
        resource: subject.subjectType,
        resourceId: subject.subjectId,
        afterState: {
          level: pending.level,
          amount: pending.amount,
          completed,
        },
        metadata: { claim_id: subject.claim.id, comments: pending.comments },
      },
      manager,
    );

    return {
      approval: pending,
      completed,
      authority: completed ? await this.authorityName(manager, user) : null,
    };
  }

  /** Rejects (declines) or returns the subject for rework. */
  async decline(
    manager: EntityManager,
    user: AuthenticatedUser,
    subject: ApprovalSubject,
    decision: ClaimApprovalStatus.REJECTED | ClaimApprovalStatus.RETURNED,
    comments: string,
  ): Promise<ClaimApproval> {
    const pending = await this.currentPending(manager, subject);

    if (pending.submitted_by === user.id && !hasCompanyAdminRole(user)) {
      throw new ForbiddenException({
        code: 'CLAIM_APPROVAL_SEGREGATION_OF_DUTIES',
        message: 'You cannot decide on an item you submitted',
      });
    }

    await this.assertAuthority(manager, user, subject, pending);

    pending.status = decision;
    pending.acted_by = user.id;
    pending.acted_at = new Date();
    pending.comments = comments.trim();
    await manager.getRepository(ClaimApproval).save(pending);

    await manager.getRepository(ClaimApproval).update(
      {
        subject_type: subject.subjectType,
        subject_id: subject.subjectId,
        round: pending.round,
        status: ClaimApprovalStatus.PENDING,
      },
      { status: ClaimApprovalStatus.SUPERSEDED },
    );

    await this.stateMachine.recordEvent(manager, subject.claim, {
      eventType:
        decision === ClaimApprovalStatus.REJECTED
          ? 'APPROVAL_REJECTED'
          : 'APPROVAL_RETURNED',
      summary: `${this.humanize(subject.approvalType)} ${
        decision === ClaimApprovalStatus.REJECTED ? 'declined' : 'returned for rework'
      } at level ${pending.level}: ${pending.comments}`,
      actorId: user.id,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
    });

    await this.auditService.logCritical(
      {
        userId: user.id,
        companyId: subject.claim.company_id,
        action: `claim.approval.${decision.toLowerCase()}`,
        resource: subject.subjectType,
        resourceId: subject.subjectId,
        reason: pending.comments ?? undefined,
        metadata: { claim_id: subject.claim.id, level: pending.level },
      },
      manager,
    );

    return pending;
  }

  hasPending(manager: EntityManager, subjectType: string, subjectId: string) {
    return manager.getRepository(ClaimApproval).exists({
      where: {
        subject_type: subjectType,
        subject_id: subjectId,
        status: ClaimApprovalStatus.PENDING,
      },
    });
  }

  listForClaim(companyId: string, claimId: string) {
    return this.approvalRepository.find({
      where: { company_id: companyId, claim_id: claimId },
      order: { created_at: 'DESC', level: 'ASC' },
    });
  }

  listLimits(companyId: string) {
    return this.limitRepository.find({
      where: { company_id: companyId },
      order: { approval_type: 'ASC', level: 'ASC', min_amount: 'ASC' },
    });
  }

  async saveLimit(
    user: AuthenticatedUser,
    values: Partial<ClaimApprovalLimit> & { id?: string },
  ) {
    const companyId = user.companyId!;
    let limit: ClaimApprovalLimit;

    if (values.id) {
      const existing = await this.limitRepository.findOne({
        where: { id: values.id, company_id: companyId },
      });

      if (!existing) {
        throw new NotFoundException('Approval limit not found');
      }

      limit = Object.assign(existing, values, {
        company_id: companyId,
        updated_by: user.id,
      });
    } else {
      limit = this.limitRepository.create({
        ...values,
        company_id: companyId,
        created_by: user.id,
      });
    }

    if (!limit.role_id && !limit.user_id) {
      throw new ConflictException('An approval limit needs a role or a user');
    }

    if (
      limit.max_amount !== null &&
      limit.max_amount !== undefined &&
      MoneyUtil.compare(limit.max_amount, limit.min_amount ?? '0.00') < 0
    ) {
      throw new ConflictException(
        'Maximum amount must not be below the minimum amount',
      );
    }

    const saved = await this.limitRepository.save(limit);

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: values.id ? 'claim.approval_limit.updated' : 'claim.approval_limit.created',
      resource: 'claim_approval_limit',
      resourceId: saved.id,
      afterState: { ...saved } as Record<string, unknown>,
    });

    return saved;
  }

  async deactivateLimit(user: AuthenticatedUser, id: string) {
    const limit = await this.limitRepository.findOne({
      where: { id, company_id: user.companyId! },
    });

    if (!limit) {
      throw new NotFoundException('Approval limit not found');
    }

    limit.is_active = false;
    limit.updated_by = user.id;

    return this.limitRepository.save(limit);
  }

  private async currentPending(manager: EntityManager, subject: ApprovalSubject) {
    const pending = await manager
      .getRepository(ClaimApproval)
      .createQueryBuilder('approval')
      .setLock('pessimistic_write')
      .where('approval.subject_type = :type', { type: subject.subjectType })
      .andWhere('approval.subject_id = :id', { id: subject.subjectId })
      .andWhere('approval.status = :status', {
        status: ClaimApprovalStatus.PENDING,
      })
      .orderBy('approval.round', 'DESC')
      .addOrderBy('approval.level', 'ASC')
      .getOne();

    if (!pending) {
      throw new ConflictException({
        code: 'CLAIM_APPROVAL_NOT_PENDING',
        message: 'There is no pending approval for this item',
      });
    }

    return pending;
  }

  private roundRows(
    manager: EntityManager,
    subject: ApprovalSubject,
    round: number,
  ) {
    return manager.getRepository(ClaimApproval).find({
      where: {
        subject_type: subject.subjectType,
        subject_id: subject.subjectId,
        round,
      },
    });
  }

  /**
   * The approver must match a band at the pending level. At the final level
   * the band's ceiling must also cover the amount.
   */
  private async assertAuthority(
    manager: EntityManager,
    user: AuthenticatedUser,
    subject: ApprovalSubject,
    pending: ClaimApproval,
  ): Promise<ClaimApprovalLimit | null> {
    const limits = await this.matchingLimits(manager, subject);

    if (limits.length === 0) {
      return null;
    }

    const roleIds = await this.userRoleIds(manager, user);
    const amount = this.toBase(subject);
    const isFinal = !limits.some(
      (limit) =>
        limit.level > pending.level &&
        MoneyUtil.compare(limit.min_amount, amount) <= 0,
    );
    const eligible = limits.find(
      (limit) =>
        limit.level === pending.level &&
        (limit.user_id === user.id ||
          (!!limit.role_id && roleIds.includes(limit.role_id))) &&
        (!isFinal ||
          limit.max_amount === null ||
          MoneyUtil.compare(limit.max_amount, amount) >= 0),
    );

    if (!eligible) {
      if (hasCompanyAdminRole(user)) {
        pending.admin_override = true;
        return null;
      }

      throw new ForbiddenException({
        code: 'CLAIM_APPROVAL_LIMIT_EXCEEDED',
        message: `Your authority does not cover level ${pending.level} approval of ${amount} ${this.baseCurrency(limits)}`,
      });
    }

    return eligible;
  }

  private async matchingLimits(
    manager: EntityManager,
    subject: ApprovalSubject,
  ): Promise<ClaimApprovalLimit[]> {
    const policy = await manager.getRepository(Policy).findOne({
      where: { id: subject.claim.policy_id },
      select: ['id', 'product_id', 'category_id'],
    });
    const limits = await manager.getRepository(ClaimApprovalLimit).find({
      where: {
        company_id: subject.claim.company_id,
        approval_type: subject.approvalType,
        is_active: true,
      },
    });

    return limits.filter(
      (limit) =>
        (!limit.product_id || limit.product_id === policy?.product_id) &&
        (!limit.insurance_category_id ||
          limit.insurance_category_id === policy?.category_id) &&
        (!limit.branch_id || limit.branch_id === subject.claim.branch_id),
    );
  }

  /** Limits are configured in their own currency; convert claim amounts. */
  private toBase(subject: ApprovalSubject): string {
    const rate = Number(subject.claim.exchange_rate || 1);
    const amount = Number(subject.amount || 0) * (Number.isFinite(rate) && rate > 0 ? rate : 1);

    return amount.toFixed(2);
  }

  private baseCurrency(limits: ClaimApprovalLimit[]) {
    return limits[0]?.currency_code ?? 'TZS';
  }

  private async userRoleIds(
    manager: EntityManager,
    user: AuthenticatedUser,
  ): Promise<string[]> {
    if (!user.roles?.length) {
      return [];
    }

    const rows: Array<{ id: string }> = await manager.query(
      `SELECT id FROM roles
       WHERE name = ANY($1::text[])
         AND (company_id = $2 OR company_id IS NULL)`,
      [user.roles, user.companyId ?? null],
    );

    return rows.map((row) => row.id);
  }

  private async authorityName(manager: EntityManager, user: AuthenticatedUser) {
    const rows: Array<{ first_name: string; last_name: string; officer_title: string | null }> =
      await manager.query(
        `SELECT first_name, last_name, officer_title FROM users WHERE id = $1`,
        [user.id],
      );
    const row = rows[0];
    const name = row ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() : '';
    const title = row?.officer_title?.trim();

    return [title, name || user.email].filter(Boolean).join(' - ').slice(0, 180);
  }

  private humanize(type: ClaimApprovalType) {
    return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}

