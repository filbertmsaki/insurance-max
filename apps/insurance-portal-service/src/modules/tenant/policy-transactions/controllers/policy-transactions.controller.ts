import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
  ) {}

  @Get()
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List policy transactions for the current company' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.transactionRepository.find({
      where: { company_id: user.companyId! },
      order: { created_at: 'DESC' },
    });
  }

  @Get(':id')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'Get a policy transaction by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionRepository.findOne({
      where: { id, company_id: user.companyId! },
    });
  }

  @Get(':id/changes')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List recorded changes for a policy transaction' })
  changes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.changeRepository.find({
      where: { policy_transaction_id: id, company_id: user.companyId! },
      order: { created_at: 'ASC' },
    });
  }

  @Get(':id/timeline')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List the append-only event timeline for a policy transaction' })
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventRepository.find({
      where: { policy_transaction_id: id, company_id: user.companyId! },
      order: { created_at: 'ASC' },
    });
  }

  @Get(':id/pricing')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'Get the pricing snapshot for a policy transaction' })
  async pricing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const transaction = await this.transactionRepository.findOne({
      where: { id, company_id: user.companyId! },
    });

    return transaction?.pricing_snapshot ?? null;
  }
}
