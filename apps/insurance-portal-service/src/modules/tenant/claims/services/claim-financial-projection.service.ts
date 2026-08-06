import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimReserveMovement } from '../entities/claim-reserve-movement.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import { ClaimRecovery } from '../entities/claim-recovery.entity';
import { ClaimPaymentStatus, ClaimRecoveryStatus } from '../enums/claim.enums';

/**
 * Derives the claim's financial rollups from the reserve-movement ledger,
 * payments and recoveries (§14.16) — additive to, not a replacement for,
 * `ClaimsService.recalculateClaimReserve()` which keeps deriving
 * `outstanding_reserve` from live `APPROVED` reserves exactly as before.
 */
@Injectable()
export class ClaimFinancialProjectionService {
  async recalculate(manager: EntityManager, claimId: string) {
    const claim = await manager
      .getRepository(InsuranceClaim)
      .createQueryBuilder('claim')
      .setLock('pessimistic_write')
      .where('claim.id = :claimId', { claimId })
      .getOneOrFail();

    const reserveTotal = await this.sumReserveMovements(manager, claimId);
    const paid = await this.sumPaidPayments(manager, claimId);
    const expensePaid = await this.sumPaidExpensePayments(manager, claimId);
    const recoveryExpected = await this.sumExpectedRecoveries(manager, claimId);
    const recoveryReceived = await this.sumReceivedRecoveries(manager, claimId);

    const indemnityPaid =
      MoneyUtil.compare(paid, expensePaid) >= 0
        ? MoneyUtil.subtract(paid, expensePaid)
        : '0.00';

    const outstandingReserve =
      MoneyUtil.compare(reserveTotal, paid) >= 0
        ? MoneyUtil.subtract(reserveTotal, paid)
        : '0.00';

    const grossIncurred = MoneyUtil.add(paid, outstandingReserve);

    const netIncurred =
      MoneyUtil.compare(grossIncurred, recoveryExpected) >= 0
        ? MoneyUtil.subtract(grossIncurred, recoveryExpected)
        : '0.00';

    claim.gross_case_reserve = reserveTotal;
    claim.gross_incurred_amount = grossIncurred;
    claim.expense_paid_amount = expensePaid;
    claim.indemnity_paid_amount = indemnityPaid;
    claim.total_recovery_expected = recoveryExpected;
    claim.total_recovery_received = recoveryReceived;
    claim.net_incurred_amount = netIncurred;

    await manager.getRepository(InsuranceClaim).save(claim);

    return claim;
  }

  private async sumReserveMovements(manager: EntityManager, claimId: string) {
    const row = await manager
      .getRepository(ClaimReserveMovement)
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.signed_amount), 0)', 'total')
      .where('movement.claim_id = :claimId', { claimId })
      .getRawOne<{ total: string }>();

    return row?.total ?? '0.00';
  }

  private async sumPaidPayments(manager: EntityManager, claimId: string) {
    const row = await manager
      .getRepository(ClaimPayment)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.paid_amount), 0)', 'total')
      .where('payment.claim_id = :claimId', { claimId })
      .andWhere('payment.status = :status', {
        status: ClaimPaymentStatus.PAID,
      })
      .getRawOne<{ total: string }>();

    return row?.total ?? '0.00';
  }

  private async sumPaidExpensePayments(manager: EntityManager, claimId: string) {
    const row = await manager
      .getRepository(ClaimPayment)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.paid_amount), 0)', 'total')
      .where('payment.claim_id = :claimId', { claimId })
      .andWhere('payment.status = :status', {
        status: ClaimPaymentStatus.PAID,
      })
      .andWhere("payment.payment_type <> 'INDEMNITY'")
      .getRawOne<{ total: string }>();

    return row?.total ?? '0.00';
  }

  private async sumExpectedRecoveries(manager: EntityManager, claimId: string) {
    const row = await manager
      .getRepository(ClaimRecovery)
      .createQueryBuilder('recovery')
      .select('COALESCE(SUM(recovery.expected_amount), 0)', 'total')
      .where('recovery.claim_id = :claimId', { claimId })
      .andWhere('recovery.status <> :cancelled', {
        cancelled: ClaimRecoveryStatus.CANCELLED,
      })
      .getRawOne<{ total: string }>();

    return row?.total ?? '0.00';
  }

  private async sumReceivedRecoveries(manager: EntityManager, claimId: string) {
    const row = await manager
      .getRepository(ClaimRecovery)
      .createQueryBuilder('recovery')
      .select('COALESCE(SUM(recovery.received_amount), 0)', 'total')
      .where('recovery.claim_id = :claimId', { claimId })
      .getRawOne<{ total: string }>();

    return row?.total ?? '0.00';
  }
}
