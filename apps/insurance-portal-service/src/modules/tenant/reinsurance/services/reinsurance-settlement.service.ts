import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, DataSource, Repository } from 'typeorm';

import { FinanceJournalService } from '../../billing-commission/services/finance-journal.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import {
  CreateReinsuranceSettlementDto,
  type ReinsuranceListQueryDto,
} from '../dto/reinsurance.dto';
import { listOrPage } from '../utils/list-query.util';
import { ReinsuranceSettlement } from '../entities/reinsurance-settlement.entity';
import { ReinsuranceSettlementStatus } from '../enums/reinsurance.enums';

@Injectable()
export class ReinsuranceSettlementService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(ReinsuranceSettlement)
    private readonly settlementRepository: Repository<ReinsuranceSettlement>,

    private readonly scopeService: DataAccessScopeService,
    private readonly referenceService: BusinessReferenceService,
    private readonly financeJournalService: FinanceJournalService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(user: AuthenticatedUser, listQuery?: ReinsuranceListQueryDto) {
    const scope = this.scopeService.resolve(user);
    const qb = this.settlementRepository
      .createQueryBuilder('settlement')
      .where(
        new Brackets((party) =>
          party
            .where('settlement.company_id = :companyId', {
              companyId: scope.companyId,
            })
            .orWhere('settlement.counterparty_company_id = :companyId', {
              companyId: scope.companyId,
            }),
        ),
      )
      .andWhere('settlement.deleted_at IS NULL')
      .orderBy('settlement.created_at', 'DESC');

    return listOrPage(
      qb,
      listQuery,
      {
        sortable: {
          created_at: 'settlement.created_at',
          reference: 'settlement.settlement_no',
          status: 'settlement.status',
        },
        defaultSort: 'created_at',
        searchable: ['settlement.settlement_no', 'settlement.status'],
        tieBreaker: 'settlement.id',
        statusColumn: 'settlement.status',
      },
      (row) => row,
    );
  }

  async create(user: AuthenticatedUser, dto: CreateReinsuranceSettlementDto) {
    const scope = this.scopeService.resolve(user);

    const grossAmount = this.money(dto.gross_amount);
    const deductionAmount = this.money(dto.deduction_amount ?? 0);
    const netAmount = this.money(Number(grossAmount) - Number(deductionAmount));

    const settlementNo = await this.referenceService.next({
      companyId: scope.companyId,
      documentType: 'REINSURANCE_SETTLEMENT',
      prefix: `RIS-${new Date().getFullYear()}-`,
    });

    const settlement = await this.settlementRepository.save(
      this.settlementRepository.create({
        company_id: scope.companyId,
        branch_id: user.activeBranchId ?? null,
        counterparty_company_id: dto.counterparty_company_id,
        settlement_no: settlementNo,
        settlement_type:
          dto.settlement_type as ReinsuranceSettlement['settlement_type'],
        period_from: dto.period_from ?? null,
        period_to: dto.period_to ?? null,
        currency: dto.currency,
        gross_amount: grossAmount,
        deduction_amount: deductionAmount,
        net_amount: netAmount,
        paid_amount: '0.00',
        balance_amount: netAmount,
        status: ReinsuranceSettlementStatus.DRAFT,
        payment_method: dto.payment_method ?? null,
        created_by: user.id,
      }),
    );
    await this.auditTransition(
      user,
      settlement,
      'reinsurance.settlement.create',
    );
    return settlement;
  }

  async submit(user: AuthenticatedUser, settlementId: string) {
    const settlement = await this.getForWrite(user, settlementId);

    if (settlement.status !== ReinsuranceSettlementStatus.DRAFT) {
      throw new ConflictException('Only a draft settlement can be submitted');
    }

    settlement.status = ReinsuranceSettlementStatus.SUBMITTED;
    settlement.submitted_by = user.id;
    settlement.submitted_at = new Date();

    const saved = await this.settlementRepository.save(settlement);
    await this.auditTransition(user, saved, 'reinsurance.settlement.submit');
    return saved;
  }

  async approve(user: AuthenticatedUser, settlementId: string) {
    const settlement = await this.getForWrite(user, settlementId);

    if (settlement.status !== ReinsuranceSettlementStatus.SUBMITTED) {
      throw new ConflictException(
        'Only a submitted settlement can be approved',
      );
    }

    if (settlement.submitted_by === user.id) {
      throw new ForbiddenException(
        'The user who submitted a settlement cannot also approve it',
      );
    }

    settlement.status = ReinsuranceSettlementStatus.APPROVED;
    settlement.approved_by = user.id;
    settlement.approved_at = new Date();

    const saved = await this.settlementRepository.save(settlement);
    await this.auditTransition(user, saved, 'reinsurance.settlement.approve');
    return saved;
  }

  async reject(user: AuthenticatedUser, settlementId: string, reason?: string) {
    const settlement = await this.getForWrite(user, settlementId);

    if (
      ![
        ReinsuranceSettlementStatus.SUBMITTED,
        ReinsuranceSettlementStatus.APPROVED,
      ].includes(settlement.status)
    ) {
      throw new ConflictException(
        'Only a submitted or approved settlement can be rejected',
      );
    }

    settlement.status = ReinsuranceSettlementStatus.REJECTED;
    settlement.rejection_reason = reason ?? null;

    const saved = await this.settlementRepository.save(settlement);
    await this.auditTransition(user, saved, 'reinsurance.settlement.reject');
    return saved;
  }

  /**
   * Confirms payment and posts a finance journal entry. The approver
   * already had to be someone other than the submitter (see `approve`) —
   * this step additionally requires the confirming user not be the original
   * submitter, so a single user can never carry a settlement start-to-finish.
   */
  async confirmPayment(user: AuthenticatedUser, settlementId: string) {
    const settlement = await this.getForWrite(user, settlementId);

    if (settlement.status !== ReinsuranceSettlementStatus.APPROVED) {
      throw new ConflictException('Only an approved settlement can be paid');
    }

    if (settlement.submitted_by === user.id) {
      throw new ForbiddenException(
        'The user who submitted a settlement cannot also confirm its payment',
      );
    }

    const sourceEventId = `reinsurance-settlement:${settlement.id}`;

    return this.dataSource.transaction(async (manager) => {
      await this.financeJournalService.postReinsuranceSettlement(
        manager,
        {
          companyId: settlement.company_id,
          settlementId: settlement.id,
          settlementNo: settlement.settlement_no,
          counterpartyCompanyId: settlement.counterparty_company_id,
          settlementType: settlement.settlement_type,
          amount: settlement.net_amount,
          currencyCode: settlement.currency,
        },
        sourceEventId,
        user.id,
      );

      const repository = manager.getRepository(ReinsuranceSettlement);
      const updated = await repository.findOneOrFail({
        where: { id: settlement.id },
      });

      updated.status = ReinsuranceSettlementStatus.PAID;
      updated.paid_amount = updated.net_amount;
      updated.balance_amount = '0.00';
      updated.settled_by = user.id;
      updated.settled_at = new Date();
      updated.finance_event_id = sourceEventId;

      const saved = await repository.save(updated);
      await this.auditTransition(user, saved, 'reinsurance.settlement.pay');
      return saved;
    });
  }

  private async getForWrite(user: AuthenticatedUser, settlementId: string) {
    const scope = this.scopeService.resolve(user);
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId, company_id: scope.companyId },
    });

    if (!settlement) {
      throw new NotFoundException('Reinsurance settlement not found');
    }

    return settlement;
  }

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }

  private async auditTransition(
    user: AuthenticatedUser,
    settlement: ReinsuranceSettlement,
    action: string,
  ) {
    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId ?? settlement.company_id,
      action,
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_settlements',
      resourceId: settlement.id,
      afterState: {
        status: settlement.status,
        net_amount: settlement.net_amount,
        counterparty_company_id: settlement.counterparty_company_id,
      },
      metadata: { owner_company_id: settlement.company_id },
    });
  }
}
