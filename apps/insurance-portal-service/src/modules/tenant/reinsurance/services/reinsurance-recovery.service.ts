import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { ClaimRecovery } from '../../claims/entities/claim-recovery.entity';
import {
  ClaimRecoveryStatus,
  ClaimRecoveryType,
} from '../../claims/enums/claim.enums';
import { PolicyCessionParticipant } from '../entities/policy-cession-participant.entity';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceClaimRecovery } from '../entities/reinsurance-claim-recovery.entity';
import { ReinsuranceRecoveryReceipt } from '../entities/reinsurance-recovery-receipt.entity';
import {
  RecordRecoveryReceiptDto,
  type ReinsuranceListQueryDto,
} from '../dto/reinsurance.dto';
import { listOrPage } from '../utils/list-query.util';
import { ReinsuranceTreatySection } from '../entities/reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from '../entities/reinsurance-treaty.entity';
import {
  ReinsuranceCessionStatus,
  ReinsuranceRecoveryStatus,
  TreatyForm,
} from '../enums/reinsurance.enums';

const NON_PROPORTIONAL_FORMS: TreatyForm[] = [
  TreatyForm.EXCESS_OF_LOSS,
  TreatyForm.CATASTROPHE_EXCESS_OF_LOSS,
  TreatyForm.STOP_LOSS,
];

export function recoveryBalances(
  recovery: Pick<
    ReinsuranceClaimRecovery,
    'expected_recovery' | 'admitted_recovery' | 'received_recovery'
  >,
) {
  return {
    unadmitted_recovery: MoneyUtil.subtract(
      recovery.expected_recovery,
      recovery.admitted_recovery,
    ),
    uncollected_recovery: MoneyUtil.subtract(
      recovery.admitted_recovery,
      recovery.received_recovery,
    ),
  };
}

@Injectable()
export class ReinsuranceRecoveryService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,

    @InjectRepository(PolicyCession)
    private readonly cessionRepository: Repository<PolicyCession>,

    @InjectRepository(PolicyCessionParticipant)
    private readonly cessionParticipantRepository: Repository<PolicyCessionParticipant>,

    @InjectRepository(ReinsuranceClaimRecovery)
    private readonly recoveryRepository: Repository<ReinsuranceClaimRecovery>,

    @InjectRepository(ReinsuranceRecoveryReceipt)
    private readonly receiptRepository: Repository<ReinsuranceRecoveryReceipt>,

    @InjectRepository(ReinsuranceTreaty)
    private readonly treatyRepository: Repository<ReinsuranceTreaty>,

    @InjectRepository(ReinsuranceTreatySection)
    private readonly sectionRepository: Repository<ReinsuranceTreatySection>,

    private readonly referenceService: BusinessReferenceService,
    private readonly auditService: AuditService,
  ) {}

  async calculateRecoveries(user: AuthenticatedUser, claimId: string) {
    if (user.companyType !== CompanyType.INSURANCE_COMPANY) {
      throw new ForbiddenException(
        'Only the cedant insurer can calculate claim recoveries',
      );
    }
    let claim = await this.claimRepository.findOne({
      where: { id: claimId, company_id: user.companyId! },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const cessions = await this.cessionRepository.find({
      where: {
        policy_id: claim.policy_id,
        status: ReinsuranceCessionStatus.ACTIVE,
      },
    });

    if (!cessions.length) {
      throw new ConflictException(
        'There are no active cessions linked to this claim policy',
      );
    }

    const recoveries: ReinsuranceClaimRecovery[] = [];

    await this.dataSource.transaction(async (manager) => {
      const lockedClaim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :id AND claim.company_id = :companyId', {
          id: claimId,
          companyId: user.companyId,
        })
        .getOne();
      if (!lockedClaim) throw new NotFoundException('Claim not found');
      claim = lockedClaim;
      const baseClaimAmount =
        claim.approved_amount || claim.estimated_amount || '0';
      const legacyRecovery = await manager
        .getRepository(ClaimRecovery)
        .findOne({
          where: {
            company_id: claim.company_id,
            claim_id: claim.id,
            recovery_type: ClaimRecoveryType.REINSURANCE,
            status: Not(ClaimRecoveryStatus.CANCELLED),
          },
        });
      if (legacyRecovery) {
        throw new ConflictException(
          'A legacy claim reinsurance recovery requires reconciliation before ceded recovery calculation',
        );
      }
      for (const cession of cessions) {
        const participants = await manager
          .getRepository(PolicyCessionParticipant)
          .find({
            where: { cession_id: cession.id },
          });

        const cessionRecoveryAmount = await this.resolveCessionRecoveryAmount(
          manager,
          cession,
          baseClaimAmount,
        );

        for (const participant of participants) {
          const existing = await manager
            .getRepository(ReinsuranceClaimRecovery)
            .findOne({
              where: {
                claim_id: claim.id,
                cession_id: cession.id,
                cession_participant_id: participant.id,
              },
            });

          if (existing) {
            recoveries.push(existing);
            continue;
          }

          const expected = DecimalUtil.percentage(
            cessionRecoveryAmount,
            participant.premium_share,
          );
          const recoveryNo = await this.referenceService.next({
            companyId: user.companyId!,
            documentType: 'REINSURANCE_RECOVERY',
            prefix: `REC-${new Date().getFullYear()}-`,
            manager,
          });

          const recovery = await manager
            .getRepository(ReinsuranceClaimRecovery)
            .save(
              manager.getRepository(ReinsuranceClaimRecovery).create({
                company_id: claim.company_id,
                branch_id: claim.branch_id,
                claim_id: claim.id,
                cession_id: cession.id,
                cession_participant_id: participant.id,
                participant_company_id: participant.participant_company_id,
                recovery_no: recoveryNo,
                currency: claim.currency_code,
                gross_claim_amount: this.money(baseClaimAmount),
                participant_share_percent: participant.premium_share,
                expected_recovery: this.money(expected),
                admitted_recovery: '0.00',
                received_recovery: '0.00',
                outstanding_recovery: this.money(expected),
                status: ReinsuranceRecoveryStatus.EXPECTED,
                created_by: user.id,
                remarks: null,
              }),
            );

          recoveries.push(recovery);
        }
      }
    });

    for (const recovery of recoveries) {
      await this.auditService.log({
        userId: user.id,
        companyId: user.companyId,
        action: 'reinsurance.recovery.calculate',
        eventCategory: 'REINSURANCE',
        resource: 'reinsurance_claim_recoveries',
        resourceId: recovery.id,
        afterState: {
          status: recovery.status,
          expected_recovery: recovery.expected_recovery,
        },
        metadata: {
          claim_id: claim.id,
          participant_company_id: recovery.participant_company_id,
        },
      });
    }

    return recoveries;
  }

  async findRecoveries(
    user: AuthenticatedUser,
    listQuery?: ReinsuranceListQueryDto,
  ) {
    const qb = this.recoveryRepository
      .createQueryBuilder('recovery')
      .where(
        '(recovery.company_id = :companyId OR recovery.participant_company_id = :companyId)',
        { companyId: user.companyId! },
      )
      .orderBy('recovery.created_at', 'DESC');

    return listOrPage(
      qb,
      listQuery,
      {
        sortable: {
          created_at: 'recovery.created_at',
          reference: 'recovery.recovery_no',
          status: 'recovery.status',
        },
        defaultSort: 'created_at',
        searchable: ['recovery.recovery_no', 'recovery.status'],
        tieBreaker: 'recovery.id',
        statusColumn: 'recovery.status',
      },
      (row) => ({
        ...row,
        ...recoveryBalances(row),
      }),
    );
  }

  async admitRecovery(
    user: AuthenticatedUser,
    recoveryId: string,
    admittedAmount: string | number,
  ) {
    if (user.companyType !== CompanyType.REINSURANCE_COMPANY) {
      throw new ForbiddenException(
        'Only the participating reinsurer can admit its recovery share',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ReinsuranceClaimRecovery);
      const recovery = await repository
        .createQueryBuilder('recovery')
        .setLock('pessimistic_write')
        .where('recovery.id = :id', { id: recoveryId })
        .andWhere('recovery.participant_company_id = :companyId', {
          companyId: user.companyId,
        })
        .andWhere('recovery.deleted_at IS NULL')
        .getOne();

      if (!recovery) {
        throw new NotFoundException('Reinsurance recovery not found');
      }

      const admitted = this.money(admittedAmount);
      if (
        MoneyUtil.compare(admitted, '0') < 0 ||
        MoneyUtil.compare(admitted, recovery.expected_recovery) > 0 ||
        MoneyUtil.compare(admitted, recovery.received_recovery) < 0
      ) {
        throw new BadRequestException(
          'Admitted recovery must be between received and expected amounts',
        );
      }
      recovery.admitted_recovery = admitted;
      recovery.outstanding_recovery = MoneyUtil.subtract(
        recovery.admitted_recovery,
        recovery.received_recovery,
      );
      recovery.admitted_by = user.id;
      recovery.admitted_at = new Date();
      recovery.status =
        MoneyUtil.compare(recovery.received_recovery, '0') > 0
          ? MoneyUtil.compare(recovery.outstanding_recovery, '0') === 0
            ? ReinsuranceRecoveryStatus.RECEIVED
            : ReinsuranceRecoveryStatus.PARTIALLY_RECEIVED
          : ReinsuranceRecoveryStatus.ADMITTED;

      const saved = await repository.save(recovery);
      await this.auditService.log(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'reinsurance.recovery.admit',
          eventCategory: 'REINSURANCE',
          resource: 'reinsurance_claim_recoveries',
          resourceId: saved.id,
          afterState: {
            status: saved.status,
            admitted_recovery: saved.admitted_recovery,
          },
          metadata: { cedant_company_id: saved.company_id },
        },
        manager,
      );
      return saved;
    });
  }

  async recordReceipt(
    user: AuthenticatedUser,
    recoveryId: string,
    dto: RecordRecoveryReceiptDto,
  ) {
    if (user.companyType !== CompanyType.INSURANCE_COMPANY) {
      throw new ForbiddenException(
        'Only the cedant insurer can record recovery receipts',
      );
    }
    const amount = this.money(dto.amount);
    if (MoneyUtil.compare(amount, '0') <= 0) {
      throw new BadRequestException('Receipt amount must be greater than zero');
    }
    return this.dataSource.transaction(async (manager) => {
      const recoveryRepository = manager.getRepository(
        ReinsuranceClaimRecovery,
      );
      const recovery = await recoveryRepository
        .createQueryBuilder('recovery')
        .setLock('pessimistic_write')
        .where('recovery.id = :recoveryId', { recoveryId })
        .andWhere('recovery.company_id = :companyId', {
          companyId: user.companyId,
        })
        .andWhere('recovery.deleted_at IS NULL')
        .getOne();
      if (!recovery) {
        throw new NotFoundException('Reinsurance recovery not found');
      }
      if (MoneyUtil.compare(recovery.admitted_recovery, '0') <= 0) {
        throw new ConflictException(
          'The reinsurer must admit a recovery before the cedant can record receipt',
        );
      }
      const newReceivedTotal = MoneyUtil.add(
        recovery.received_recovery,
        amount,
      );
      if (MoneyUtil.compare(newReceivedTotal, recovery.admitted_recovery) > 0) {
        throw new ConflictException(
          'Receipt total cannot exceed the amount admitted by the reinsurer',
        );
      }
      const receipt = await manager
        .getRepository(ReinsuranceRecoveryReceipt)
        .save(
          manager.getRepository(ReinsuranceRecoveryReceipt).create({
            company_id: recovery.company_id,
            claim_recovery_id: recovery.id,
            amount,
            currency_code: recovery.currency,
            received_at: dto.received_at
              ? new Date(dto.received_at)
              : new Date(),
            reference: dto.reference?.trim() || null,
            recorded_by: user.id,
            recorded_at: new Date(),
          }),
        );
      recovery.received_recovery = newReceivedTotal;
      recovery.outstanding_recovery = MoneyUtil.subtract(
        recovery.admitted_recovery,
        newReceivedTotal,
      );
      recovery.status =
        MoneyUtil.compare(newReceivedTotal, recovery.admitted_recovery) >= 0
          ? ReinsuranceRecoveryStatus.RECEIVED
          : ReinsuranceRecoveryStatus.PARTIALLY_RECEIVED;
      await recoveryRepository.save(recovery);
      await this.auditService.log(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'reinsurance.recovery.receipt.record',
          eventCategory: 'REINSURANCE',
          resource: 'reinsurance_recovery_receipts',
          resourceId: receipt.id,
          afterState: {
            amount: receipt.amount,
            received_total: recovery.received_recovery,
          },
          metadata: {
            recovery_id: recovery.id,
            participant_company_id: recovery.participant_company_id,
          },
        },
        manager,
      );
      return { receipt, recovery };
    });
  }

  async findReceipts(user: AuthenticatedUser, recoveryId: string) {
    const recovery = await this.recoveryRepository.findOne({
      where: [
        { id: recoveryId, company_id: user.companyId! },
        { id: recoveryId, participant_company_id: user.companyId! },
      ],
    });
    if (!recovery) {
      throw new NotFoundException('Reinsurance recovery not found');
    }
    return this.receiptRepository.find({
      where: { claim_recovery_id: recovery.id },
      order: { received_at: 'ASC' },
    });
  }

  /**
   * Proportional treaties (quota-share/surplus) recover a straight
   * percentage of the claim. Non-proportional forms (XOL/CAT-XOL/stop-loss)
   * only respond above the layer's attachment point, capped at the layer
   * limit — apportioning the raw claim amount by premium share (the old
   * behaviour) would badly overstate recovery for those forms.
   */
  private async resolveCessionRecoveryAmount(
    manager: EntityManager,
    cession: PolicyCession,
    baseClaimAmount: string,
  ): Promise<string> {
    if (!cession.treaty_id) {
      return baseClaimAmount;
    }

    const treaty = await manager
      .getRepository(ReinsuranceTreaty)
      .findOne({ where: { id: cession.treaty_id } });

    if (!treaty || !NON_PROPORTIONAL_FORMS.includes(treaty.treaty_form)) {
      return baseClaimAmount;
    }

    const section = cession.treaty_section_id
      ? await manager
          .getRepository(ReinsuranceTreatySection)
          .findOne({ where: { id: cession.treaty_section_id } })
      : null;

    const attachmentPoint = DecimalUtil.value(
      section?.retention_amount ?? treaty.company_retention ?? 0,
    );
    const layerLimit = DecimalUtil.value(
      section?.treaty_limit ?? treaty.total_capacity ?? 0,
    );
    const excess = DecimalUtil.value(baseClaimAmount).minus(attachmentPoint);
    if (excess.isNegative()) return '0.00';
    return (excess.lessThan(layerLimit) ? excess : layerLimit).toFixed(2);
  }

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }
}
