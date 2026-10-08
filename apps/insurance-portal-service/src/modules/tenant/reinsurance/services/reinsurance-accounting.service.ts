import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, Repository } from 'typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import {
  GenerateReinsuranceBordereauDto,
  GenerateReinsurancePremiumAccountDto,
  RespondReinsurancePremiumAccountDto,
} from '../dto/reinsurance.dto';
import { PolicyCessionParticipant } from '../entities/policy-cession-participant.entity';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceBordereauItem } from '../entities/reinsurance-bordereau-item.entity';
import { ReinsuranceBordereau } from '../entities/reinsurance-bordereau.entity';
import { ReinsurancePremiumAccountItem } from '../entities/reinsurance-premium-account-item.entity';
import { ReinsurancePremiumAccount } from '../entities/reinsurance-premium-account.entity';
import {
  ReinsuranceAccountStatus,
  ReinsuranceBordereauStatus,
  ReinsuranceCessionStatus,
} from '../enums/reinsurance.enums';

const SOURCE_CESSION_STATUSES = [
  ReinsuranceCessionStatus.ACTIVE,
  ReinsuranceCessionStatus.DECLARED,
];

interface CessionParticipantRow {
  cession_id: string;
  participant_id: string;
  policy_id: string;
  cession_no: string;
  treaty_id: string | null;
  branch_id: string | null;
  participant_company_id: string;
  reinsurance_broker_company_id: string | null;
  currency: string;
  gross_sum_insured: string;
  ceded_sum_insured: string;
  gross_premium: string;
  ceded_premium_share: string;
  reinsurance_commission: string;
  brokerage_commission: string;
}

@Injectable()
export class ReinsuranceAccountingService {
  constructor(
    @InjectRepository(ReinsuranceBordereau)
    private readonly bordereauRepository: Repository<ReinsuranceBordereau>,

    @InjectRepository(ReinsuranceBordereauItem)
    private readonly bordereauItemRepository: Repository<ReinsuranceBordereauItem>,

    @InjectRepository(ReinsurancePremiumAccount)
    private readonly premiumAccountRepository: Repository<ReinsurancePremiumAccount>,

    @InjectRepository(ReinsurancePremiumAccountItem)
    private readonly premiumAccountItemRepository: Repository<ReinsurancePremiumAccountItem>,

    @InjectRepository(PolicyCessionParticipant)
    private readonly cessionParticipantRepository: Repository<PolicyCessionParticipant>,

    private readonly scopeService: DataAccessScopeService,
    private readonly referenceService: BusinessReferenceService,
    private readonly auditService: AuditService,
  ) {}

  async findBordereaux(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);
    return this.bordereauRepository
      .createQueryBuilder('bordereau')
      .leftJoinAndSelect('bordereau.items', 'items')
      .where(
        new Brackets((party) =>
          party
            .where('bordereau.company_id = :companyId', {
              companyId: scope.companyId,
            })
            .orWhere('bordereau.participant_company_id = :companyId', {
              companyId: scope.companyId,
            }),
        ),
      )
      .andWhere('bordereau.deleted_at IS NULL')
      .orderBy('bordereau.created_at', 'DESC')
      .getMany();
  }

  async generateBordereau(
    user: AuthenticatedUser,
    dto: GenerateReinsuranceBordereauDto,
  ) {
    const scope = this.scopeService.resolve(user);
    this.assertValidPeriod(dto.period_from, dto.period_to);

    const rows = await this.findSourceRows(scope.companyId, {
      treatyId: dto.treaty_id ?? null,
      participantCompanyId: dto.participant_company_id ?? null,
      periodFrom: dto.period_from,
      periodTo: dto.period_to,
      currency: dto.currency,
    });

    if (!rows.length) {
      throw new ConflictException(
        'No active reinsurance cessions are available for this bordereau period',
      );
    }

    const totals = this.totalRows(rows);
    const bordereauNo = await this.referenceService.next({
      companyId: scope.companyId,
      documentType: 'REINSURANCE_BORDEREAU',
      prefix: `RIB-${new Date().getFullYear()}-`,
    });

    const bordereau = await this.bordereauRepository.save(
      this.bordereauRepository.create({
        company_id: scope.companyId,
        branch_id: user.activeBranchId ?? null,
        treaty_id: dto.treaty_id ?? null,
        participant_company_id: dto.participant_company_id ?? null,
        bordereau_no: bordereauNo,
        bordereau_type: dto.bordereau_type,
        period_from: dto.period_from,
        period_to: dto.period_to,
        currency: dto.currency.trim().toUpperCase(),
        gross_sum_insured: this.money(totals.grossSumInsured),
        ceded_sum_insured: this.money(totals.cededSumInsured),
        gross_premium: this.money(totals.grossPremium),
        ceded_premium: this.money(totals.cededPremium),
        commission_amount: this.money(totals.reinsuranceCommission),
        brokerage_amount: this.money(totals.brokerageCommission),
        claim_amount: '0.00',
        status: ReinsuranceBordereauStatus.GENERATED,
        created_by: user.id,
      }),
    );

    await this.bordereauItemRepository.save(
      rows.map((row) =>
        this.bordereauItemRepository.create({
          bordereau_id: bordereau.id,
          cession_id: row.cession_id,
          cession_participant_id: row.participant_id,
          policy_id: row.policy_id,
          claim_id: null,
          claim_recovery_id: null,
          reference_number: row.cession_no,
          gross_sum_insured: this.money(row.gross_sum_insured),
          ceded_sum_insured: this.money(row.ceded_sum_insured),
          gross_premium: this.money(row.gross_premium),
          ceded_premium: this.money(row.ceded_premium_share),
          commission_amount: this.money(
            this.percentOf(row.ceded_premium_share, row.reinsurance_commission),
          ),
          brokerage_amount: this.money(
            this.percentOf(row.ceded_premium_share, row.brokerage_commission),
          ),
          claim_amount: '0.00',
          recovery_amount: '0.00',
        }),
      ),
    );

    const saved = await this.getBordereau(scope.companyId, bordereau.id);
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: 'reinsurance.bordereau.generate',
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_bordereaux',
      resourceId: saved.id,
      afterState: {
        status: saved.status,
        participant_company_id: saved.participant_company_id,
        ceded_premium: saved.ceded_premium,
      },
    });
    return saved;
  }

  async submitBordereau(user: AuthenticatedUser, bordereauId: string) {
    const scope = this.scopeService.resolve(user);
    const bordereau = await this.getBordereau(scope.companyId, bordereauId);

    if (bordereau.status !== ReinsuranceBordereauStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated bordereau can be submitted',
      );
    }

    bordereau.status = ReinsuranceBordereauStatus.SUBMITTED;
    const saved = await this.bordereauRepository.save(bordereau);
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: 'reinsurance.bordereau.submit',
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_bordereaux',
      resourceId: saved.id,
      afterState: { status: saved.status },
    });
    return saved;
  }

  async approveBordereau(user: AuthenticatedUser, bordereauId: string) {
    const scope = this.scopeService.resolve(user);
    const bordereau = await this.getBordereau(scope.companyId, bordereauId);

    if (bordereau.status !== ReinsuranceBordereauStatus.SUBMITTED) {
      throw new ConflictException('Only a submitted bordereau can be approved');
    }

    bordereau.status = ReinsuranceBordereauStatus.APPROVED;
    const saved = await this.bordereauRepository.save(bordereau);
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: 'reinsurance.bordereau.approve',
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_bordereaux',
      resourceId: saved.id,
      afterState: { status: saved.status },
    });
    return saved;
  }

  async findPremiumAccounts(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);
    return this.premiumAccountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.items', 'items')
      .where(
        new Brackets((party) =>
          party
            .where('account.company_id = :companyId', {
              companyId: scope.companyId,
            })
            .orWhere('account.participant_company_id = :companyId', {
              companyId: scope.companyId,
            })
            .orWhere('account.reinsurance_broker_company_id = :companyId', {
              companyId: scope.companyId,
            }),
        ),
      )
      .andWhere('account.deleted_at IS NULL')
      .orderBy('account.created_at', 'DESC')
      .getMany();
  }

  async generatePremiumAccount(
    user: AuthenticatedUser,
    dto: GenerateReinsurancePremiumAccountDto,
  ) {
    const scope = this.scopeService.resolve(user);
    this.assertValidPeriod(dto.period_from, dto.period_to);

    const rows = await this.findSourceRows(scope.companyId, {
      treatyId: dto.treaty_id ?? null,
      participantCompanyId: dto.participant_company_id,
      periodFrom: dto.period_from,
      periodTo: dto.period_to,
      currency: dto.currency,
    });

    if (!rows.length) {
      throw new ConflictException(
        'No active reinsurance cessions are available for this premium account period',
      );
    }

    const totals = this.totalRows(rows);
    const taxAmount = Number(this.money(dto.tax_amount ?? 0));
    const otherAdjustments = Number(this.money(dto.other_adjustments ?? 0));
    const netPremiumDue =
      totals.cededPremium -
      totals.reinsuranceCommission -
      totals.brokerageCommission +
      taxAmount +
      otherAdjustments;
    const accountNo = await this.referenceService.next({
      companyId: scope.companyId,
      documentType: 'REINSURANCE_PREMIUM_ACCOUNT',
      prefix: `RIA-${new Date().getFullYear()}-`,
    });

    const account = await this.premiumAccountRepository.save(
      this.premiumAccountRepository.create({
        company_id: scope.companyId,
        branch_id: user.activeBranchId ?? null,
        treaty_id: dto.treaty_id ?? null,
        participant_company_id: dto.participant_company_id,
        reinsurance_broker_company_id:
          dto.reinsurance_broker_company_id ??
          rows[0]?.reinsurance_broker_company_id ??
          null,
        account_no: accountNo,
        period_from: dto.period_from,
        period_to: dto.period_to,
        currency: dto.currency.trim().toUpperCase(),
        gross_ceded_premium: this.money(totals.cededPremium),
        reinsurance_commission: this.money(totals.reinsuranceCommission),
        brokerage_commission: this.money(totals.brokerageCommission),
        tax_amount: this.money(taxAmount),
        other_adjustments: this.money(otherAdjustments),
        net_premium_due: this.money(netPremiumDue),
        paid_amount: '0.00',
        outstanding_amount: this.money(netPremiumDue),
        status: ReinsuranceAccountStatus.GENERATED,
        created_by: user.id,
      }),
    );
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: 'reinsurance.premium-account.generate',
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_premium_accounts',
      resourceId: account.id,
      afterState: {
        status: account.status,
        participant_company_id: account.participant_company_id,
        net_premium_due: account.net_premium_due,
      },
    });

    await this.premiumAccountItemRepository.save(
      rows.map((row) => {
        const reinsuranceCommission = this.percentOf(
          row.ceded_premium_share,
          row.reinsurance_commission,
        );
        const brokerageCommission = this.percentOf(
          row.ceded_premium_share,
          row.brokerage_commission,
        );
        const netPremium =
          Number(row.ceded_premium_share) -
          reinsuranceCommission -
          brokerageCommission;

        return this.premiumAccountItemRepository.create({
          premium_account_id: account.id,
          cession_id: row.cession_id,
          cession_participant_id: row.participant_id,
          policy_id: row.policy_id,
          gross_ceded_premium: this.money(row.ceded_premium_share),
          reinsurance_commission: this.money(reinsuranceCommission),
          brokerage_commission: this.money(brokerageCommission),
          tax_amount: '0.00',
          net_premium_due: this.money(netPremium),
        });
      }),
    );

    return this.getPremiumAccount(scope.companyId, account.id);
  }

  async submitPremiumAccount(user: AuthenticatedUser, accountId: string) {
    const scope = this.scopeService.resolve(user);
    const account = await this.getPremiumAccount(scope.companyId, accountId);

    if (account.status !== ReinsuranceAccountStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated premium account can be submitted',
      );
    }

    account.status = ReinsuranceAccountStatus.SUBMITTED;
    const saved = await this.premiumAccountRepository.save(account);
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: 'reinsurance.premium-account.submit',
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_premium_accounts',
      resourceId: saved.id,
      afterState: { status: saved.status },
    });
    return saved;
  }

  async confirmPremiumAccount(user: AuthenticatedUser, accountId: string) {
    return this.respondPremiumAccount(user, accountId, { decision: 'CONFIRM' });
  }

  async respondPremiumAccount(
    user: AuthenticatedUser,
    accountId: string,
    dto: RespondReinsurancePremiumAccountDto,
  ) {
    const scope = this.scopeService.resolve(user);
    if (user.companyType !== CompanyType.REINSURANCE_COMPANY) {
      throw new ForbiddenException(
        'Only the participating reinsurer can confirm or dispute a premium account',
      );
    }
    const account = await this.premiumAccountRepository.findOne({
      where: { id: accountId, participant_company_id: scope.companyId },
      relations: { items: true },
    });
    if (!account)
      throw new NotFoundException('Reinsurance premium account not found');

    if (account.status !== ReinsuranceAccountStatus.SUBMITTED) {
      throw new ConflictException(
        'Only a submitted premium account can receive a counterparty response',
      );
    }

    if (dto.decision === 'DISPUTE' && !dto.note?.trim()) {
      throw new BadRequestException('A dispute reason is required');
    }
    account.status =
      dto.decision === 'CONFIRM'
        ? ReinsuranceAccountStatus.CONFIRMED
        : ReinsuranceAccountStatus.DISPUTED;
    account.confirmed_by = user.id;
    account.confirmed_at = new Date();
    account.response_note = dto.note?.trim() ?? null;
    const saved = await this.premiumAccountRepository.save(account);
    await this.auditService.log({
      userId: user.id,
      companyId: scope.companyId,
      action: `reinsurance.premium-account.${dto.decision.toLowerCase()}`,
      eventCategory: 'REINSURANCE',
      resource: 'reinsurance_premium_accounts',
      resourceId: saved.id,
      afterState: { status: saved.status, response_note: saved.response_note },
      metadata: { cedant_company_id: saved.company_id },
    });
    return saved;
  }

  private async findSourceRows(
    companyId: string,
    params: {
      treatyId: string | null;
      participantCompanyId: string | null;
      periodFrom: string;
      periodTo: string;
      currency: string;
    },
  ): Promise<CessionParticipantRow[]> {
    const query = this.cessionParticipantRepository
      .createQueryBuilder('participant')
      .innerJoin(
        PolicyCession,
        'cession',
        'cession.id = participant.cession_id',
      )
      .select('cession.id', 'cession_id')
      .addSelect('participant.id', 'participant_id')
      .addSelect('cession.policy_id', 'policy_id')
      .addSelect('cession.cession_no', 'cession_no')
      .addSelect('cession.treaty_id', 'treaty_id')
      .addSelect('cession.branch_id', 'branch_id')
      .addSelect('participant.participant_company_id', 'participant_company_id')
      .addSelect(
        'participant.reinsurance_broker_company_id',
        'reinsurance_broker_company_id',
      )
      .addSelect('cession.currency', 'currency')
      .addSelect('cession.gross_sum_insured', 'gross_sum_insured')
      .addSelect('participant.sum_insured_share', 'ceded_sum_insured')
      .addSelect('cession.gross_premium', 'gross_premium')
      .addSelect('participant.ceded_premium_share', 'ceded_premium_share')
      .addSelect('participant.reinsurance_commission', 'reinsurance_commission')
      .addSelect('participant.brokerage_commission', 'brokerage_commission')
      .where('cession.company_id = :companyId', { companyId })
      .andWhere('cession.status IN (:...statuses)', {
        statuses: SOURCE_CESSION_STATUSES,
      })
      .andWhere('cession.effective_from <= :periodTo', {
        periodTo: params.periodTo,
      })
      .andWhere('cession.effective_to >= :periodFrom', {
        periodFrom: params.periodFrom,
      })
      .andWhere('UPPER(cession.currency) = :currency', {
        currency: params.currency.trim().toUpperCase(),
      })
      .andWhere('cession.deleted_at IS NULL');

    if (params.treatyId) {
      query.andWhere('cession.treaty_id = :treatyId', {
        treatyId: params.treatyId,
      });
    }

    if (params.participantCompanyId) {
      query.andWhere(
        'participant.participant_company_id = :participantCompanyId',
        {
          participantCompanyId: params.participantCompanyId,
        },
      );
    }

    return query.getRawMany<CessionParticipantRow>();
  }

  private totalRows(rows: CessionParticipantRow[]) {
    return rows.reduce(
      (totals, row) => {
        const reinsuranceCommission = this.percentOf(
          row.ceded_premium_share,
          row.reinsurance_commission,
        );
        const brokerageCommission = this.percentOf(
          row.ceded_premium_share,
          row.brokerage_commission,
        );

        totals.grossSumInsured += Number(row.gross_sum_insured);
        totals.cededSumInsured += Number(row.ceded_sum_insured);
        totals.grossPremium += Number(row.gross_premium);
        totals.cededPremium += Number(row.ceded_premium_share);
        totals.reinsuranceCommission += reinsuranceCommission;
        totals.brokerageCommission += brokerageCommission;
        return totals;
      },
      {
        grossSumInsured: 0,
        cededSumInsured: 0,
        grossPremium: 0,
        cededPremium: 0,
        reinsuranceCommission: 0,
        brokerageCommission: 0,
      },
    );
  }

  private async getBordereau(companyId: string, bordereauId: string) {
    const bordereau = await this.bordereauRepository.findOne({
      where: { id: bordereauId, company_id: companyId },
      relations: { items: true },
    });

    if (!bordereau) {
      throw new NotFoundException('Reinsurance bordereau not found');
    }

    return bordereau;
  }

  private async getPremiumAccount(companyId: string, accountId: string) {
    const account = await this.premiumAccountRepository.findOne({
      where: { id: accountId, company_id: companyId },
      relations: { items: true },
    });

    if (!account) {
      throw new NotFoundException('Reinsurance premium account not found');
    }

    return account;
  }

  private assertValidPeriod(periodFrom: string, periodTo: string) {
    if (new Date(periodFrom) > new Date(periodTo)) {
      throw new BadRequestException(
        'Reinsurance accounting period end date must be on or after the start date',
      );
    }
  }

  private percentOf(amount: string | number, rate: string | number) {
    return (Number(amount ?? 0) * Number(rate ?? 0)) / 100;
  }

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }
}
