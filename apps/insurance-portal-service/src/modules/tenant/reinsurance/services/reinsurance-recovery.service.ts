import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource, Repository } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { PolicyCessionParticipant } from '../entities/policy-cession-participant.entity';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceClaimRecovery } from '../entities/reinsurance-claim-recovery.entity';
import {
  ReinsuranceCessionStatus,
  ReinsuranceRecoveryStatus,
} from '../enums/reinsurance.enums';

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
            (baseClaimAmount * Number(participant.premium_share)) / 100;
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

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }
}
