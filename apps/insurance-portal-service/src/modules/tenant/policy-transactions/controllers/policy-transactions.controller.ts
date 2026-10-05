import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';

@ApiTags('policy-transactions')
@ApiBearerAuth()
@Controller('tenant/policy-transactions')
@TenantScoped()
export class PolicyTransactionsController {
  constructor(
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyTransactionChange)
    private readonly changeRepository: Repository<PolicyTransactionChange>,
    @InjectRepository(PolicyTransactionEvent)
    private readonly eventRepository: Repository<PolicyTransactionEvent>,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  @Get()
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List policy transactions for the current company' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.createScopedTransactionQuery(user)
      .orderBy('transaction.created_at', 'DESC')
      .getMany();
  }

  @Get(':id')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'Get a policy transaction by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.createScopedTransactionQuery(user)
      .andWhere('transaction.id = :id', { id })
      .getOne();
  }

  @Get(':id/changes')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List recorded changes for a policy transaction' })
  changes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.createScopedChildQuery(this.changeRepository, 'change', user)
      .andWhere('change.policy_transaction_id = :id', { id })
      .orderBy('change.created_at', 'ASC')
      .getMany();
  }

  @Get(':id/timeline')
  @Permissions('policy-transactions:read')
  @ApiOperation({
    summary: 'List the append-only event timeline for a policy transaction',
  })
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.createScopedChildQuery(this.eventRepository, 'event', user)
      .andWhere('event.policy_transaction_id = :id', { id })
      .orderBy('event.created_at', 'ASC')
      .getMany();
  }

  @Get(':id/pricing')
  @Permissions('policy-transactions:read')
  @ApiOperation({
    summary: 'Get the pricing snapshot for a policy transaction',
  })
  async pricing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const transaction = await this.createScopedTransactionQuery(user)
      .andWhere('transaction.id = :id', { id })
      .getOne();

    return transaction?.pricing_snapshot ?? null;
  }

  private createScopedTransactionQuery(user: AuthenticatedUser) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .andWhere('transaction.company_id = :transactionCompanyId', {
        transactionCompanyId: user.companyId!,
      });

    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user, 'policy-transactions:read'),
    );

    return query;
  }

  private createScopedChildQuery<
    T extends PolicyTransactionChange | PolicyTransactionEvent,
  >(
    repository: Repository<T>,
    alias: string,
    user: AuthenticatedUser,
  ): SelectQueryBuilder<T> {
    const query = repository
      .createQueryBuilder(alias)
      .innerJoin(
        PolicyTransaction,
        'transaction',
        `transaction.id = ${alias}.policy_transaction_id
          AND transaction.company_id = ${alias}.company_id`,
      )
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .andWhere(`${alias}.company_id = :childCompanyId`, {
        childCompanyId: user.companyId!,
      });

    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user, 'policy-transactions:read'),
    );

    return query;
  }
}
