import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { ClaimRecoveryStatus } from '../enums/claim.enums';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimRecovery } from '../entities/claim-recovery.entity';
import { ClaimEvent } from '../entities/claim-event.entity';
import type { CreateClaimRecoveryDto } from '../dto/claim-recovery.dto';
import { ClaimFinancialProjectionService } from './claim-financial-projection.service';

/**
 * Builds out the previously-unwired recovery stub (§14.24) — the entity and
 * permission strings already existed, but no service ever touched them.
 */
@Injectable()
export class ClaimRecoveryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClaimRecovery)
    private readonly recoveryRepository: Repository<ClaimRecovery>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    private readonly referenceService: BusinessReferenceService,
    private readonly scopeService: DataAccessScopeService,
    private readonly financialProjectionService: ClaimFinancialProjectionService,
  ) {}

  async create(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimRecoveryDto,
  ) {
    const claim = await this.requireClaim(user, claimId);

    const expectedAmount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(dto.expected_amount),
    );
    if (MoneyUtil.compare(expectedAmount, '0') <= 0) {
      throw new ConflictException(
        'Expected recovery must be greater than zero',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const recoveryNo = await this.referenceService.next({
        companyId: claim.company_id,
        documentType: 'CLAIM_RECOVERY',
        prefix: `RCV-${new Date().getFullYear()}-`,
      });
      const recovery = await manager.getRepository(ClaimRecovery).save({
        company_id: claim.company_id,
        claim_id: claim.id,
        recovery_no: recoveryNo,
        recovery_type: dto.recovery_type,
        expected_amount: expectedAmount,
        received_amount: '0.00',
        status: ClaimRecoveryStatus.EXPECTED,
        notes: dto.notes?.trim() ?? null,
        created_by: user.id,
      });
      await this.recordEvent(
        manager,
        recovery,
        user.id,
        'RECOVERY_CREATED',
        null,
        recovery.status,
      );
      await this.financialProjectionService.recalculate(manager, claim.id);
      return recovery;
    });
  }

  async request(user: AuthenticatedUser, recoveryId: string) {
    return this.transition(
      user,
      recoveryId,
      'RECOVERY_REQUESTED',
      [ClaimRecoveryStatus.EXPECTED],
      ClaimRecoveryStatus.REQUESTED,
    );
  }

  /**
   * "Actual recovery receipts must be confirmed by Finance" — gated by the
   * `claim-recoveries:record-receipt` permission at the controller.
   */
  async recordReceipt(
    user: AuthenticatedUser,
    recoveryId: string,
    receivedAmount: string | number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const recovery = await manager
        .getRepository(ClaimRecovery)
        .createQueryBuilder('recovery')
        .setLock('pessimistic_write')
        .where('recovery.id = :id', { id: recoveryId })
        .andWhere('recovery.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!recovery) {
        throw new NotFoundException('Claim recovery not found');
      }

      if (
        ![
          ClaimRecoveryStatus.REQUESTED,
          ClaimRecoveryStatus.PARTIALLY_RECEIVED,
        ].includes(recovery.status)
      ) {
        throw new ConflictException(
          `Recovery receipt cannot be recorded from ${recovery.status}`,
        );
      }

      const amount = MoneyUtil.fromMinor(MoneyUtil.toMinor(receivedAmount));
      if (MoneyUtil.compare(amount, '0') <= 0) {
        throw new ConflictException(
          'Recovery receipt must be greater than zero',
        );
      }
      const outstanding = MoneyUtil.subtract(
        recovery.expected_amount,
        recovery.received_amount,
      );
      if (MoneyUtil.compare(amount, outstanding) > 0) {
        throw new ConflictException(
          'Recovery receipt cannot exceed the outstanding expected amount',
        );
      }
      const previousStatus = recovery.status;
      recovery.received_amount = MoneyUtil.add(
        recovery.received_amount,
        amount,
      );
      recovery.status =
        MoneyUtil.compare(recovery.received_amount, recovery.expected_amount) >=
        0
          ? ClaimRecoveryStatus.RECEIVED
          : ClaimRecoveryStatus.PARTIALLY_RECEIVED;

      await manager.getRepository(ClaimRecovery).save(recovery);
      await this.recordEvent(
        manager,
        recovery,
        user.id,
        'RECOVERY_RECEIPT_RECORDED',
        previousStatus,
        recovery.status,
        { received_amount: amount },
      );
      await this.financialProjectionService.recalculate(
        manager,
        recovery.claim_id,
      );

      return recovery;
    });
  }

  async writeOff(user: AuthenticatedUser, recoveryId: string, reason: string) {
    if (!reason.trim())
      throw new ConflictException('Write-off reason is required');
    return this.transition(
      user,
      recoveryId,
      'RECOVERY_WRITTEN_OFF',
      [ClaimRecoveryStatus.REQUESTED, ClaimRecoveryStatus.PARTIALLY_RECEIVED],
      ClaimRecoveryStatus.WRITTEN_OFF,
      reason.trim(),
    );
  }

  async cancel(user: AuthenticatedUser, recoveryId: string) {
    return this.transition(
      user,
      recoveryId,
      'RECOVERY_CANCELLED',
      [ClaimRecoveryStatus.EXPECTED, ClaimRecoveryStatus.REQUESTED],
      ClaimRecoveryStatus.CANCELLED,
    );
  }

  findAll(companyId: string, claimId: string) {
    return this.recoveryRepository.find({
      where: { company_id: companyId, claim_id: claimId },
      order: { created_at: 'DESC' },
    });
  }

  private async requireRecovery(companyId: string, id: string) {
    const recovery = await this.recoveryRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!recovery) {
      throw new NotFoundException('Claim recovery not found');
    }

    return recovery;
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

  private async transition(
    user: AuthenticatedUser,
    recoveryId: string,
    eventType: string,
    allowed: ClaimRecoveryStatus[],
    next: ClaimRecoveryStatus,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const recovery = await manager
        .getRepository(ClaimRecovery)
        .createQueryBuilder('recovery')
        .setLock('pessimistic_write')
        .where('recovery.id = :id', { id: recoveryId })
        .andWhere('recovery.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();
      if (!recovery) throw new NotFoundException('Claim recovery not found');
      const previousStatus = recovery.status;
      if (!allowed.includes(previousStatus)) {
        throw new ConflictException(
          `Recovery cannot transition from ${previousStatus} to ${next}`,
        );
      }
      recovery.status = next;
      if (reason)
        recovery.notes = [recovery.notes, `Written off: ${reason}`]
          .filter(Boolean)
          .join(' | ');
      const saved = await manager.getRepository(ClaimRecovery).save(recovery);
      await this.recordEvent(
        manager,
        saved,
        user.id,
        eventType,
        previousStatus,
        next,
        reason ? { reason } : undefined,
      );
      await this.financialProjectionService.recalculate(
        manager,
        recovery.claim_id,
      );
      return saved;
    });
  }

  private async recordEvent(
    manager: import('typeorm').EntityManager,
    recovery: ClaimRecovery,
    actorId: string,
    eventType: string,
    previousStatus: string | null,
    newStatus: string | null,
    metadata?: Record<string, unknown>,
  ) {
    await manager.getRepository(ClaimEvent).save({
      company_id: recovery.company_id,
      claim_id: recovery.claim_id,
      event_type: eventType,
      actor_id: actorId,
      previous_status: previousStatus,
      new_status: newStatus,
      subject_type: 'CLAIM_RECOVERY',
      subject_id: recovery.id,
      summary: `${eventType.replaceAll('_', ' ').toLowerCase()} (${recovery.recovery_no})`,
      metadata: metadata ?? null,
      source_event_id: null,
    });
  }
}
