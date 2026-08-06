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
import type {
  CreateClaimRecoveryDto,
} from '../dto/claim-recovery.dto';
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

    const recoveryNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_RECOVERY',
      prefix: `RCV-${new Date().getFullYear()}-`,
    });

    const recovery = await this.recoveryRepository.save({
      company_id: claim.company_id,
      claim_id: claim.id,
      recovery_no: recoveryNo,
      recovery_type: dto.recovery_type,
      expected_amount: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.expected_amount),
      ),
      received_amount: '0.00',
      status: ClaimRecoveryStatus.EXPECTED,
      notes: dto.notes?.trim() ?? null,
      created_by: user.id,
    });

    await this.financialProjectionService.recalculate(
      this.dataSource.manager,
      claim.id,
    );

    return recovery;
  }

  async request(user: AuthenticatedUser, recoveryId: string) {
    const recovery = await this.requireRecovery(user.companyId!, recoveryId);

    if (recovery.status !== ClaimRecoveryStatus.EXPECTED) {
      throw new ConflictException(
        'Only an expected recovery can be requested',
      );
    }

    recovery.status = ClaimRecoveryStatus.REQUESTED;

    return this.recoveryRepository.save(recovery);
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
      await this.financialProjectionService.recalculate(
        manager,
        recovery.claim_id,
      );

      return recovery;
    });
  }

  async writeOff(user: AuthenticatedUser, recoveryId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const recovery = await this.requireRecovery(user.companyId!, recoveryId);
      recovery.status = ClaimRecoveryStatus.WRITTEN_OFF;
      recovery.notes = [recovery.notes, `Written off: ${reason}`]
        .filter(Boolean)
        .join(' | ');

      const saved = await manager.getRepository(ClaimRecovery).save(recovery);
      await this.financialProjectionService.recalculate(
        manager,
        recovery.claim_id,
      );

      return saved;
    });
  }

  async cancel(user: AuthenticatedUser, recoveryId: string) {
    return this.dataSource.transaction(async (manager) => {
      const recovery = await this.requireRecovery(user.companyId!, recoveryId);
      recovery.status = ClaimRecoveryStatus.CANCELLED;

      const saved = await manager.getRepository(ClaimRecovery).save(recovery);
      await this.financialProjectionService.recalculate(
        manager,
        recovery.claim_id,
      );

      return saved;
    });
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
}
