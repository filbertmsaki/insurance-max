import { Injectable } from '@nestjs/common';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, In } from 'typeorm';

import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import { ClaimRegulatoryOperation } from '../entities/claim-regulatory-operation.entity';
import {
  ClaimEventActorType,
  ClaimPaymentStatus,
  ClaimRegulatoryStatus,
  ClaimSettlementStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimStateMachineService } from './claim-state-machine.service';

const OPEN_PAYMENT_STATUSES = [
  ClaimPaymentStatus.DRAFT,
  ClaimPaymentStatus.SUBMITTED,
  ClaimPaymentStatus.APPROVED,
  ClaimPaymentStatus.PROCESSING,
];

/**
 * A claim is SETTLED only when the approved amount is fully paid, no payment
 * is still in flight and TIRA has accepted every completed payment (§11).
 * Creating a payment record never settles a claim on its own.
 */
@Injectable()
export class ClaimSettlementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stateMachine: ClaimStateMachineService,
  ) {}

  async settleIfComplete(claimId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId })
        .getOneOrFail();

      if (claim.status !== ClaimStatus.PAID) {
        return false;
      }

      if (MoneyUtil.compare(claim.paid_amount, claim.approved_amount) < 0) {
        return false;
      }

      const openPayments = await manager.getRepository(ClaimPayment).count({
        where: { claim_id: claim.id, status: In(OPEN_PAYMENT_STATUSES) },
      });

      if (openPayments > 0) {
        return false;
      }

      const paidPayments = await manager.getRepository(ClaimPayment).find({
        where: { claim_id: claim.id, status: ClaimPaymentStatus.PAID },
        select: ['id'],
      });
      const accepted = paidPayments.length
        ? await manager.getRepository(ClaimRegulatoryOperation).count({
            where: {
              claim_id: claim.id,
              operation_type: ClaimRegulatoryOperationType.PAYMENT,
              status: ClaimRegulatoryStatus.ACCEPTED,
              source_record_id: In(paidPayments.map((payment) => payment.id)),
            },
          })
        : 0;

      if (accepted < paidPayments.length) {
        return false;
      }

      await this.stateMachine.transition(manager, claim, ClaimStatus.SETTLED, {
        eventType: 'CLAIM_SETTLED',
        summary: 'Claim fully paid and every payment accepted by TIRA',
        actorType: ClaimEventActorType.SYSTEM,
        sourceEventId: `claim-settled:${claim.id}:${claim.state_version}`,
      });
      await manager
        .getRepository(InsuranceClaim)
        .update(
          { id: claim.id },
          { settlement_status: ClaimSettlementStatus.PAID },
        );

      return true;
    });
  }
}
