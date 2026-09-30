import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import {
  REJECTABLE_STATUSES,
  canTransition,
  deriveClaimStage,
} from '../claim-lifecycle';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimEvent } from '../entities/claim-event.entity';
import { ClaimStatusHistory } from '../entities/claim-status-history.entity';
import { ClaimEventActorType, ClaimStatus } from '../enums/claim.enums';

export interface ClaimEventInput {
  eventType: string;
  summary: string;
  actorType?: ClaimEventActorType;
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Makes the event idempotent: a repeated id is silently ignored. */
  sourceEventId?: string | null;
}

export interface ClaimTransitionInput extends Omit<
  ClaimEventInput,
  'eventType'
> {
  eventType?: string;
}

/**
 * The only writer of `claims.status`. Every change is validated against
 * CLAIM_STATUS_TRANSITIONS, applied with an optimistic check on
 * `state_version`, and recorded in status history, the claim timeline and
 * the audit log.
 */
@Injectable()
export class ClaimStateMachineService {
  private readonly logger = new Logger(ClaimStateMachineService.name);

  constructor(private readonly auditService: AuditService) {}

  assertCanTransition(claim: InsuranceClaim, to: ClaimStatus): void {
    if (!canTransition(claim.status, to)) {
      throw new ConflictException({
        code: 'CLAIM_INVALID_TRANSITION',
        message: `Claim ${claim.claim_no} cannot move from ${claim.status} to ${to}`,
        from: claim.status,
        to,
      });
    }
  }

  async transition(
    manager: EntityManager,
    claim: InsuranceClaim,
    to: ClaimStatus,
    input: ClaimTransitionInput,
  ): Promise<InsuranceClaim> {
    this.assertCanTransition(claim, to);

    return this.apply(manager, claim, to, input);
  }

  /**
   * Returns a claim to the status it held before a rejection was proposed,
   * when that rejection is declined. Restricted to statuses that could have
   * led to REJECTION_PENDING in the first place.
   */
  async revertPendingRejection(
    manager: EntityManager,
    claim: InsuranceClaim,
    previous: ClaimStatus,
    input: ClaimTransitionInput,
  ): Promise<InsuranceClaim> {
    if (
      claim.status !== ClaimStatus.REJECTION_PENDING ||
      !REJECTABLE_STATUSES.includes(previous)
    ) {
      throw new ConflictException({
        code: 'CLAIM_INVALID_TRANSITION',
        message: `Claim ${claim.claim_no} cannot return to ${previous}`,
      });
    }

    return this.apply(manager, claim, previous, input);
  }

  /**
   * Moves the claim only when it is currently in `from`; used by callback
   * handlers where a replay must be a no-op rather than an error.
   */
  async transitionIfIn(
    manager: EntityManager,
    claim: InsuranceClaim,
    from: readonly ClaimStatus[],
    to: ClaimStatus,
    input: ClaimTransitionInput,
  ): Promise<boolean> {
    if (!from.includes(claim.status) || !canTransition(claim.status, to)) {
      return false;
    }

    await this.apply(manager, claim, to, input);

    return true;
  }

  async recordEvent(
    manager: EntityManager,
    claim: Pick<InsuranceClaim, 'id' | 'company_id'>,
    input: ClaimEventInput & {
      previousStatus?: string | null;
      newStatus?: string | null;
    },
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ClaimEvent)
      .values({
        company_id: claim.company_id,
        claim_id: claim.id,
        event_type: input.eventType,
        actor_type: input.actorType ?? ClaimEventActorType.USER,
        actor_id: input.actorId ?? null,
        previous_status: input.previousStatus ?? null,
        new_status: input.newStatus ?? null,
        subject_type: input.subjectType ?? null,
        subject_id: input.subjectId ?? null,
        summary: input.summary,
        // jsonb column; TypeORM cannot type a free-form object here.
        metadata: (input.metadata ?? null) as never,
        source_event_id: input.sourceEventId ?? null,
      })
      .orIgnore()
      .execute();
  }

  private async apply(
    manager: EntityManager,
    claim: InsuranceClaim,
    to: ClaimStatus,
    input: ClaimTransitionInput,
  ): Promise<InsuranceClaim> {
    const from = claim.status;
    const result = await manager
      .createQueryBuilder()
      .update(InsuranceClaim)
      .set({
        status: to,
        claim_stage: deriveClaimStage(to),
        state_version: () => 'state_version + 1',
      })
      .where('id = :id', { id: claim.id })
      .andWhere('status = :from', { from })
      .andWhere('state_version = :version', { version: claim.state_version })
      .execute();

    if (!result.affected) {
      throw new ConflictException({
        code: 'CLAIM_CONCURRENT_MODIFICATION',
        message: `Claim ${claim.claim_no} was changed by another action; reload and try again`,
      });
    }

    claim.status = to;
    claim.claim_stage = deriveClaimStage(to);
    claim.state_version += 1;

    await manager.getRepository(ClaimStatusHistory).save({
      claim_id: claim.id,
      old_status: from,
      new_status: to,
      reason: input.summary,
      changed_by: input.actorId ?? null,
      changed_at: new Date(),
      metadata: input.metadata ?? null,
    });

    await this.recordEvent(manager, claim, {
      ...input,
      eventType: input.eventType ?? 'STATUS_CHANGED',
      previousStatus: from,
      newStatus: to,
    });

    await this.auditService.log(
      {
        userId: input.actorId ?? undefined,
        companyId: claim.company_id,
        actorType:
          input.actorType === ClaimEventActorType.USER || !input.actorType
            ? 'user'
            : 'system',
        action: 'claim.status_changed',
        resource: 'claim',
        resourceId: claim.id,
        beforeState: { status: from },
        afterState: { status: to },
        reason: input.summary,
        metadata: { claim_no: claim.claim_no, ...(input.metadata ?? {}) },
      },
      manager,
    );

    return claim;
  }
}
