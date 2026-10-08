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
import { DataSource, EntityManager, Repository } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { PolicyCessionParticipant } from '../entities/policy-cession-participant.entity';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceClaimRecovery } from '../entities/reinsurance-claim-recovery.entity';
import { ReinsuranceRecoveryReceipt } from '../entities/reinsurance-recovery-receipt.entity';
import { RecordRecoveryReceiptDto } from '../dto/reinsurance.dto';
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
    const claim = await this.claimRepository.findOne({
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

    const baseClaimAmount = Number(
      claim.approved_amount || claim.estimated_amount || 0,
    );
    const recoveries: ReinsuranceClaimRecovery[] = [];

    await this.dataSource.transaction(async (manager) => {
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

          const expected =
            (cessionRecoveryAmount * Number(participant.premium_share)) / 100;
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

  async findRecoveries(user: AuthenticatedUser) {
    return this.recoveryRepository.find({
      where: [
        { company_id: user.companyId! },
        { participant_company_id: user.companyId! },
      ],
      order: { created_at: 'DESC' },
    });
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
    const recovery = await this.recoveryRepository.findOne({
      where: { id: recoveryId, participant_company_id: user.companyId! },
    });

    if (!recovery) {
      throw new NotFoundException('Reinsurance recovery not found');
    }

    const admitted = Number(this.money(admittedAmount));
    if (
      !Number.isFinite(admitted) ||
      admitted < 0 ||
      admitted > Number(recovery.expected_recovery)
    ) {
      throw new BadRequestException(
        'Admitted recovery must be between zero and the expected recovery amount',
      );
    }
    recovery.admitted_recovery = this.money(admitted);
    recovery.outstanding_recovery = this.money(
      Math.max(
        0,
        Number(recovery.expected_recovery) - Number(recovery.admitted_recovery),
      ),
    );
    recovery.admitted_by = user.id;
    recovery.admitted_at = new Date();
    recovery.status =
      Number(recovery.admitted_recovery) >= Number(recovery.expected_recovery)
        ? ReinsuranceRecoveryStatus.ADMITTED
        : ReinsuranceRecoveryStatus.PARTIALLY_RECEIVED;

    const saved = await this.recoveryRepository.save(recovery);
    await this.auditService.log({
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
    });
    return saved;
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
    const amount = Number(this.money(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
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
      if (Number(recovery.admitted_recovery) <= 0) {
        throw new ConflictException(
          'The reinsurer must admit a recovery before the cedant can record receipt',
        );
      }
      const newReceivedTotal = Number(recovery.received_recovery) + amount;
      if (newReceivedTotal > Number(recovery.admitted_recovery) + 0.000001) {
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
            amount: this.money(amount),
            currency_code: recovery.currency,
            received_at: dto.received_at
              ? new Date(dto.received_at)
              : new Date(),
            reference: dto.reference?.trim() || null,
            recorded_by: user.id,
            recorded_at: new Date(),
          }),
        );
      recovery.received_recovery = this.money(newReceivedTotal);
      recovery.outstanding_recovery = this.money(
        Math.max(0, Number(recovery.admitted_recovery) - newReceivedTotal),
      );
      recovery.status =
        newReceivedTotal >= Number(recovery.expected_recovery)
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
    baseClaimAmount: number,
  ): Promise<number> {
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

    const attachmentPoint = Number(
      section?.retention_amount ?? treaty.company_retention ?? 0,
    );
    const layerLimit = Number(
      section?.treaty_limit ?? treaty.total_capacity ?? 0,
    );

    return Math.min(layerLimit, Math.max(0, baseClaimAmount - attachmentPoint));
  }

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }
}
