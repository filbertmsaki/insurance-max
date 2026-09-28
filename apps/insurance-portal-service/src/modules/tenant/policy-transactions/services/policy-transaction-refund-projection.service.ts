import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  InvoiceSourceType,
  PolicyTransactionEventType,
  RefundStatus,
} from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { FinanceRefund } from '../../billing-commission/entities/finance-refund.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';

// Return premiums are created for both endorsement credits and policy
// cancellations; both reference the policy transaction via source_record_id.
const RETURN_PREMIUM_SOURCE_TYPES: string[] = [
  InvoiceSourceType.ENDORSEMENT,
  InvoiceSourceType.CANCELLATION,
];

@Injectable()
export class PolicyTransactionRefundProjectionService {
  async publish(manager: EntityManager, refundId: string) {
    const refund = await manager.getRepository(FinanceRefund).findOne({
      where: { id: refundId },
    });

    if (
      !refund ||
      !refund.source_type ||
      !RETURN_PREMIUM_SOURCE_TYPES.includes(refund.source_type) ||
      !refund.source_record_id
    ) {
      return;
    }

    const transaction = await manager.getRepository(PolicyTransaction).findOne({
      where: {
        id: refund.source_record_id,
        company_id: refund.company_id,
      },
    });

    if (!transaction) {
      return;
    }

    const paidTotal = await manager
      .getRepository(FinanceRefund)
      .createQueryBuilder('refund')
      .select('COALESCE(SUM(refund.amount), 0)', 'amount')
      .where('refund.company_id = :companyId', {
        companyId: refund.company_id,
      })
      .andWhere('refund.source_type = :sourceType', {
        sourceType: refund.source_type,
      })
      .andWhere('refund.source_record_id = :sourceRecordId', {
        sourceRecordId: refund.source_record_id,
      })
      .andWhere('refund.status = :status', { status: RefundStatus.PAID })
      .getRawOne<{ amount: string }>();

    if (
      DecimalUtil.value(paidTotal?.amount ?? 0).lessThan(
        DecimalUtil.value(transaction.return_premium),
      )
    ) {
      return;
    }

    const alreadyRecorded = await manager
      .getRepository(PolicyTransactionEvent)
      .findOne({
        where: {
          company_id: transaction.company_id,
          policy_transaction_id: transaction.id,
          event_type: PolicyTransactionEventType.RETURN_PREMIUM_PAID,
        },
      });

    if (alreadyRecorded) {
      return;
    }

    transaction.last_command = 'RETURN_PREMIUM_PAID';
    await manager.getRepository(PolicyTransaction).save(transaction);
    await manager.getRepository(PolicyTransactionEvent).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      event_type: PolicyTransactionEventType.RETURN_PREMIUM_PAID,
      actor_type: 'SYSTEM',
      actor_id: null,
      from_stage: transaction.stage,
      to_stage: transaction.stage,
      metadata: {
        refundId: refund.id,
        paidAmount: paidTotal?.amount ?? '0',
        returnPremium: transaction.return_premium,
      },
    });
  }
}
