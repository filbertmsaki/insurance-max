import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  EntityManager,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { InsuranceClaim } from '../entities/claim.entity';

/**
 * Single place where claim tenant/branch/department/user scope is applied.
 * Every stage record is resolved through its claim, so a user can never act
 * on a stage record of a claim outside their scope.
 */
@Injectable()
export class ClaimAccessService {
  constructor(
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    private readonly scopeService: DataAccessScopeService,
  ) {}

  resolveScope(user: AuthenticatedUser) {
    return this.scopeService.resolve(user);
  }

  /** Applies the claim read scope to any query joining claims as alias. */
  applyReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    user: AuthenticatedUser,
  ) {
    this.scopeService.applyClaimReadScope(
      queryBuilder,
      alias,
      this.scopeService.resolve(user),
    );
  }

  async getForRead(user: AuthenticatedUser, claimId: string) {
    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .where('claim.id = :claimId', { claimId })
      .andWhere('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(
      queryBuilder,
      'claim',
      this.scopeService.resolve(user),
    );

    const claim = await queryBuilder.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  /**
   * Resolves the claim within the caller's write scope; with a manager the
   * row is locked for the rest of the transaction.
   */
  async getForWrite(
    user: AuthenticatedUser,
    claimId: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(InsuranceClaim)
      : this.claimRepository;
    const queryBuilder = repository
      .createQueryBuilder('claim')
      .where('claim.id = :claimId', { claimId })
      .andWhere('claim.deleted_at IS NULL');

    this.scopeService.applyClaimWriteScope(
      queryBuilder,
      'claim',
      this.scopeService.resolve(user),
    );

    if (manager) {
      queryBuilder.setLock('pessimistic_write');
    }

    const claim = await queryBuilder.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  /** Loads a stage record of the caller's company, then scope-checks its claim. */
  async getRecordForWrite<T extends ObjectLiteral & { claim_id: string }>(
    manager: EntityManager,
    user: AuthenticatedUser,
    entity: new () => T,
    id: string,
    label: string,
  ): Promise<{ record: T; claim: InsuranceClaim }> {
    const record = await manager
      .getRepository(entity)
      .createQueryBuilder('record')
      .setLock('pessimistic_write')
      .where('record.id = :id', { id })
      .andWhere('record.company_id = :companyId', {
        companyId: user.companyId,
      })
      .getOne();

    if (!record) {
      throw new NotFoundException(`${label} not found`);
    }

    const claim = await this.getForWrite(user, record.claim_id, manager);

    return { record, claim };
  }

  async getRecordForRead<T extends ObjectLiteral & { claim_id: string }>(
    user: AuthenticatedUser,
    repository: Repository<T>,
    id: string,
    label: string,
  ): Promise<{ record: T; claim: InsuranceClaim }> {
    const record = await repository
      .createQueryBuilder('record')
      .where('record.id = :id', { id })
      .andWhere('record.company_id = :companyId', {
        companyId: user.companyId,
      })
      .getOne();

    if (!record) {
      throw new NotFoundException(`${label} not found`);
    }

    const claim = await this.getForRead(user, record.claim_id);

    return { record, claim };
  }
}
