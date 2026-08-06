import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { PolicyCessionParticipant } from '../entities/policy-cession-participant.entity';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceClaimRecovery } from '../entities/reinsurance-claim-recovery.entity';
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

    @InjectRepository(ReinsuranceTreaty)
    private readonly treatyRepository: Repository<ReinsuranceTreaty>,

    @InjectRepository(ReinsuranceTreatySection)
    private readonly sectionRepository: Repository<ReinsuranceTreatySection>,

    private readonly referenceService: BusinessReferenceService,
  ) {}

  async calculateRecoveries(user: AuthenticatedUser, claimId: string) {
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

    return recoveries;
  }

  async admitRecovery(
    user: AuthenticatedUser,
    recoveryId: string,
    admittedAmount: string | number,
  ) {
    const recovery = await this.recoveryRepository.findOne({
      where: { id: recoveryId, company_id: user.companyId! },
    });

    if (!recovery) {
      throw new NotFoundException('Reinsurance recovery not found');
    }

    recovery.admitted_recovery = this.money(admittedAmount);
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

    return this.recoveryRepository.save(recovery);
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
