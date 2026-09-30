import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { FinanceJournalService } from '../../billing-commission/services/finance-journal.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import {
  ClaimDisbursementStatus,
  ClaimPaymentStatus,
  ClaimSettlementStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import { ClaimDisbursement } from '../entities/claim-disbursement.entity';
import { ClaimFinancialProjectionService } from './claim-financial-projection.service';
import { ClaimStateMachineService } from './claim-state-machine.service';

/**
 * "Finance is the only authority that confirms an actual disbursement"
 * (§14.9/14.20/14.21). Claims raises a request; only a holder of the
 * confirm-disbursement permission can mark it paid — replaces
 * `ClaimsService.markPaymentPaid()`.
 */
@Injectable()
export class ClaimDisbursementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly referenceService: BusinessReferenceService,
    private readonly financeJournalService: FinanceJournalService,
    private readonly financialProjectionService: ClaimFinancialProjectionService,
    private readonly stateMachine: ClaimStateMachineService,
  ) {}

  async requestDisbursement(
    user: AuthenticatedUser,
    paymentId: string,
    idempotencyKey: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(ClaimPayment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.id = :id', { id: paymentId })
        .andWhere('payment.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!payment) {
        throw new NotFoundException('Claim payment not found');
      }

      if (payment.status !== ClaimPaymentStatus.APPROVED) {
        throw new ConflictException(
          'Claim payment must be approved before a disbursement can be requested',
        );
      }

      const existing = await manager.getRepository(ClaimDisbursement).findOne({
        where: {
          company_id: user.companyId!,
          idempotency_key: idempotencyKey,
        },
      });

      if (existing) {
        return existing;
      }

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: payment.claim_id })
        .getOneOrFail();

      const available = MoneyUtil.subtract(
        claim.approved_amount,
        claim.paid_amount,
      );

      if (MoneyUtil.compare(payment.paid_amount, available) > 0) {
        throw new BadRequestException(
          'Claim payment exceeds the remaining admitted amount',
        );
      }

      const disbursementNo = await this.referenceService.next({
        companyId: claim.company_id,
        documentType: 'CLAIM_DISBURSEMENT',
        prefix: `DSB-${new Date().getFullYear()}-`,
        manager,
      });

      const disbursement = await manager.getRepository(ClaimDisbursement).save({
        company_id: claim.company_id,
        claim_id: claim.id,
        claim_payment_id: payment.id,
        disbursement_no: disbursementNo,
        status: ClaimDisbursementStatus.REQUESTED,
        amount: payment.paid_amount,
        currency_code: payment.currency_code,
        payee_snapshot: payment.payee_snapshot ?? null,
        requested_by: user.id,
        idempotency_key: idempotencyKey,
      });

      payment.finance_disbursement_id = disbursement.id;
      payment.finance_status = 'REQUESTED';
      payment.status = ClaimPaymentStatus.PROCESSING;
      await manager.getRepository(ClaimPayment).save(payment);

      return disbursement;
    });
  }

  async confirmDisbursement(
    user: AuthenticatedUser,
    disbursementId: string,
    paymentMethod: string,
    providerReference: string | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const disbursement = await manager
        .getRepository(ClaimDisbursement)
        .createQueryBuilder('disbursement')
        .setLock('pessimistic_write')
        .where('disbursement.id = :id', { id: disbursementId })
        .andWhere('disbursement.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!disbursement) {
        throw new NotFoundException('Claim disbursement not found');
      }

      if (disbursement.status === ClaimDisbursementStatus.PAID) {
        return disbursement;
      }

      if (disbursement.status !== ClaimDisbursementStatus.REQUESTED) {
        throw new ConflictException(
          `Disbursement cannot be confirmed from ${disbursement.status}`,
        );
      }

      const payment = await manager
        .getRepository(ClaimPayment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.id = :id', { id: disbursement.claim_payment_id })
        .getOneOrFail();

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: disbursement.claim_id })
        .getOneOrFail();

      disbursement.status = ClaimDisbursementStatus.PAID;
      disbursement.payment_method = paymentMethod;
      disbursement.provider_reference = providerReference;
      disbursement.confirmed_by = user.id;
      disbursement.confirmed_at = new Date();
      await manager.getRepository(ClaimDisbursement).save(disbursement);

      payment.status = ClaimPaymentStatus.PAID;
      payment.finance_status = 'PAID';
      payment.finance_event_id = `disbursement-paid:${disbursement.id}`;
      payment.payment_method = paymentMethod;
      payment.payment_reference =
        providerReference ?? disbursement.disbursement_no;
      payment.paid_by = user.id;
      payment.paid_at = new Date();
      payment.parties_notified = 'Y';

      payment.payment_date = payment.paid_at;
      await manager.getRepository(ClaimPayment).save(payment);

      // paid_amount is derived from PAID payments by the projection.
      const projected = await this.financialProjectionService.recalculate(
        manager,
        claim.id,
      );
      const fullyPaid =
        MoneyUtil.compare(projected.paid_amount, projected.approved_amount) >=
        0;

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          settlement_status: fullyPaid
            ? ClaimSettlementStatus.PAID
            : ClaimSettlementStatus.PARTIALLY_PAID,
        },
      );

      const current = await manager
        .getRepository(InsuranceClaim)
        .findOneOrFail({ where: { id: claim.id } });
      const target = fullyPaid ? ClaimStatus.PAID : ClaimStatus.PARTIALLY_PAID;

      if (current.status !== target) {
        await this.stateMachine.transition(manager, current, target, {
          eventType: 'PAYMENT_CONFIRMED',
          summary: `Claim payment ${payment.claim_payment_number} disbursed (${disbursement.amount} ${disbursement.currency_code})`,
          actorId: user.id,
          subjectType: 'PAYMENT',
          subjectId: payment.id,
        });
      } else {
        await this.stateMachine.recordEvent(manager, current, {
          eventType: 'PAYMENT_CONFIRMED',
          summary: `Claim payment ${payment.claim_payment_number} disbursed (${disbursement.amount} ${disbursement.currency_code})`,
          actorId: user.id,
          subjectType: 'PAYMENT',
          subjectId: payment.id,
        });
      }

      await this.financeJournalService.postClaimDisbursement(
        manager,
        {
          companyId: claim.company_id,
          disbursementId: disbursement.id,
          disbursementNo: disbursement.disbursement_no,
          customerId: claim.customer_id,
          amount: disbursement.amount,
          currencyCode: disbursement.currency_code,
        },
        `disbursement-paid:${disbursement.id}`,
        user.id,
      );

      return disbursement;
    });
  }

  async failDisbursement(
    user: AuthenticatedUser,
    disbursementId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const disbursement = await manager
        .getRepository(ClaimDisbursement)
        .createQueryBuilder('disbursement')
        .setLock('pessimistic_write')
        .where('disbursement.id = :id', { id: disbursementId })
        .andWhere('disbursement.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!disbursement) {
        throw new NotFoundException('Claim disbursement not found');
      }

      if (disbursement.status !== ClaimDisbursementStatus.REQUESTED) {
        throw new ConflictException(
          `Disbursement cannot fail from ${disbursement.status}`,
        );
      }

      disbursement.status = ClaimDisbursementStatus.FAILED;
      disbursement.failed_at = new Date();
      disbursement.failure_message = reason;
      await manager.getRepository(ClaimDisbursement).save(disbursement);

      const payment = await manager.getRepository(ClaimPayment).findOneOrFail({
        where: { id: disbursement.claim_payment_id },
      });
      payment.finance_status = 'FAILED';
      payment.status = ClaimPaymentStatus.APPROVED;
      await manager.getRepository(ClaimPayment).save(payment);

      return disbursement;
    });
  }

  async reverseDisbursement(
    user: AuthenticatedUser,
    disbursementId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const disbursement = await manager
        .getRepository(ClaimDisbursement)
        .createQueryBuilder('disbursement')
        .setLock('pessimistic_write')
        .where('disbursement.id = :id', { id: disbursementId })
        .andWhere('disbursement.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!disbursement) {
        throw new NotFoundException('Claim disbursement not found');
      }

      if (disbursement.status !== ClaimDisbursementStatus.PAID) {
        throw new ConflictException('Only a paid disbursement can be reversed');
      }

      disbursement.status = ClaimDisbursementStatus.REVERSED;
      await manager.getRepository(ClaimDisbursement).save(disbursement);

      const payment = await manager.getRepository(ClaimPayment).findOneOrFail({
        where: { id: disbursement.claim_payment_id },
      });
      payment.status = ClaimPaymentStatus.REVERSED;
      payment.finance_status = 'REVERSED';
      await manager.getRepository(ClaimPayment).save(payment);

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: disbursement.claim_id })
        .getOneOrFail();

      await this.financeJournalService.reverseClaimDisbursement(
        manager,
        {
          companyId: claim.company_id,
          disbursementId: disbursement.id,
          disbursementNo: disbursement.disbursement_no,
          customerId: claim.customer_id,
          amount: disbursement.amount,
          currencyCode: disbursement.currency_code,
          reason,
        },
        `disbursement-reversed:${disbursement.id}`,
        user.id,
      );

      const projected = await this.financialProjectionService.recalculate(
        manager,
        claim.id,
      );
      await manager
        .getRepository(InsuranceClaim)
        .update(
          { id: claim.id },
          { settlement_status: ClaimSettlementStatus.REVERSED },
        );

      const current = await manager
        .getRepository(InsuranceClaim)
        .findOneOrFail({ where: { id: claim.id } });
      const target =
        MoneyUtil.compare(projected.paid_amount, '0.00') > 0
          ? ClaimStatus.PARTIALLY_PAID
          : ClaimStatus.PAYMENT_PENDING;
      const input = {
        eventType: 'PAYMENT_REVERSED',
        summary: `Claim payment ${payment.claim_payment_number} reversed: ${reason}`,
        actorId: user.id,
        subjectType: 'PAYMENT',
        subjectId: payment.id,
      };

      if (current.status !== target && this.canMove(current.status, target)) {
        await this.stateMachine.transition(manager, current, target, input);
      } else {
        await this.stateMachine.recordEvent(manager, current, input);
      }

      return disbursement;
    });
  }

  private canMove(from: ClaimStatus, to: ClaimStatus) {
    return (
      (from === ClaimStatus.PAID &&
        [ClaimStatus.PARTIALLY_PAID].includes(to)) ||
      (from === ClaimStatus.PARTIALLY_PAID &&
        [ClaimStatus.PAYMENT_PENDING].includes(to))
    );
  }
}
