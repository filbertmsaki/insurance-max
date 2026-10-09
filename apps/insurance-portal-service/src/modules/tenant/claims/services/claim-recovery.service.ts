import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { FinanceJournalService } from '../../billing-commission/services/finance-journal.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { ClaimRecoveryStatus, ClaimStatus } from '../enums/claim.enums';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimRecovery } from '../entities/claim-recovery.entity';
import { ClaimEvent } from '../entities/claim-event.entity';
import type { CreateClaimRecoveryDto } from '../dto/claim-recovery.dto';
import { ClaimAccessService } from './claim-access.service';
import { ClaimFinancialProjectionService } from './claim-financial-projection.service';

/**
 * Claims that never became (or no longer are) a live loss cannot carry a
 * recovery. Closed and settled claims stay open to recoveries because
 * salvage and subrogation routinely arrive after settlement.
 */
const RECOVERY_BLOCKED_CLAIM_STATUSES: ClaimStatus[] = [
  ClaimStatus.DRAFT,
  ClaimStatus.REJECTED,
  ClaimStatus.CANCELLED,
];

/**
 * Builds out the previously-unwired recovery stub (§14.24) — the entity and
 * permission strings already existed, but no service ever touched them.
 * Every recovery is resolved through its claim's scope, so a branch-limited
 * user cannot act on another branch's recovery by id.
 */
@Injectable()
export class ClaimRecoveryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClaimRecovery)
    private readonly recoveryRepository: Repository<ClaimRecovery>,
    private readonly referenceService: BusinessReferenceService,
    private readonly claimAccess: ClaimAccessService,
    private readonly financeJournalService: FinanceJournalService,
    private readonly financialProjectionService: ClaimFinancialProjectionService,
  ) {}

  async create(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimRecoveryDto,
  ) {
    const expectedAmount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(dto.expected_amount),
    );
    if (MoneyUtil.compare(expectedAmount, '0') <= 0) {
      throw new ConflictException(
        'Expected recovery must be greater than zero',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const claim = await this.claimAccess.getForWrite(user, claimId, manager);
      if (RECOVERY_BLOCKED_CLAIM_STATUSES.includes(claim.status)) {
        throw new ConflictException(
          `Recoveries cannot be added to a ${claim.status} claim`,
        );
      }

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
        notes: dto.notes?.trim() || null,
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
   * `claim-recoveries:record-receipt` permission at the controller. Each
   * receipt posts its own cash journal, keyed by the receipt event.
   */
  async recordReceipt(
    user: AuthenticatedUser,
    recoveryId: string,
    receivedAmount: string | number,
    notes?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record: recovery, claim } = await this.lockRecovery(
        manager,
        user,
        recoveryId,
      );

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
      const receiptNotes = notes?.trim() || null;
      recovery.received_amount = MoneyUtil.add(
        recovery.received_amount,
        amount,
      );
      recovery.status =
        MoneyUtil.compare(recovery.received_amount, recovery.expected_amount) >=
        0
          ? ClaimRecoveryStatus.RECEIVED
          : ClaimRecoveryStatus.PARTIALLY_RECEIVED;
      if (receiptNotes) {
        recovery.notes = this.appendNote(
          recovery.notes,
          `Receipt ${amount}: ${receiptNotes}`,
        );
      }

      await manager.getRepository(ClaimRecovery).save(recovery);
      const event = await this.recordEvent(
        manager,
        recovery,
        user.id,
        'RECOVERY_RECEIPT_RECORDED',
        previousStatus,
        recovery.status,
        { received_amount: amount, notes: receiptNotes },
      );
      await this.financeJournalService.postClaimRecoveryReceipt(
        manager,
        {
          companyId: recovery.company_id,
          recoveryId: recovery.id,
          recoveryNo: recovery.recovery_no,
          recoveryType: recovery.recovery_type,
          amount,
          currencyCode: claim.currency_code,
        },
        `recovery-receipt:${event.id}`,
        user.id,
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

  async findAll(user: AuthenticatedUser, claimId: string) {
    const claim = await this.claimAccess.getForRead(user, claimId);
    return this.recoveryRepository.find({
      where: { company_id: claim.company_id, claim_id: claim.id },
      order: { created_at: 'DESC' },
    });
  }

  private lockRecovery(
    manager: EntityManager,
    user: AuthenticatedUser,
    recoveryId: string,
  ): Promise<{ record: ClaimRecovery; claim: InsuranceClaim }> {
    return this.claimAccess.getRecordForWrite(
      manager,
      user,
      ClaimRecovery,
      recoveryId,
      'Claim recovery',
    );
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
      const { record: recovery } = await this.lockRecovery(
        manager,
        user,
        recoveryId,
      );
      const previousStatus = recovery.status;
      if (!allowed.includes(previousStatus)) {
        throw new ConflictException(
          `Recovery cannot transition from ${previousStatus} to ${next}`,
        );
      }
      recovery.status = next;
      if (reason)
        recovery.notes = this.appendNote(
          recovery.notes,
          `Written off: ${reason}`,
        );
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

  private appendNote(existing: string | null, note: string) {
    return [existing, note].filter(Boolean).join(' | ');
  }

  private recordEvent(
    manager: EntityManager,
    recovery: ClaimRecovery,
    actorId: string,
    eventType: string,
    previousStatus: string | null,
    newStatus: string | null,
    metadata?: Record<string, unknown>,
  ) {
    return manager.getRepository(ClaimEvent).save({
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
