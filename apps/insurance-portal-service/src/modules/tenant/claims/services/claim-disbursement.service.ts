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
import { ClaimStatusHistory } from '../entities/claim-status-history.entity';
import { ClaimFinancialProjectionService } from './claim-financial-projection.service';

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
      await manager.getRepository(ClaimPayment).save(payment);

      const oldStatus = claim.status;
      const newPaidAmount = MoneyUtil.add(
        claim.paid_amount,
        payment.paid_amount,
      );
      claim.paid_amount = newPaidAmount;

      const fullyPaid =
        MoneyUtil.compare(claim.paid_amount, claim.approved_amount) === 0;

      // Preserve the existing overloaded `status` transition exactly as
      // `markPaymentPaid` used to perform it (additive-scope decision),
      // while also driving the new `settlement_status` dimension.
      claim.status = fullyPaid ? ClaimStatus.PAID : ClaimStatus.PARTIALLY_PAID;
      claim.settlement_status = fullyPaid
        ? ClaimSettlementStatus.PAID
        : ClaimSettlementStatus.PARTIALLY_PAID;

      await manager.getRepository(InsuranceClaim).save(claim);
      await manager.getRepository(ClaimStatusHistory).save({
        claim_id: claim.id,
        old_status: oldStatus,
        new_status: claim.status,
        reason: `Claim payment ${payment.claim_payment_number} disbursement confirmed`,
        changed_by: user.id,
      });

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

      await this.financialProjectionService.recalculate(manager, claim.id);

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

      const claim = await manager.getRepository(InsuranceClaim).findOneOrFail({
        where: { id: disbursement.claim_id },
      });
      claim.paid_amount =
        MoneyUtil.compare(claim.paid_amount, payment.paid_amount) >= 0
          ? MoneyUtil.subtract(claim.paid_amount, payment.paid_amount)
          : '0.00';
      claim.settlement_status = ClaimSettlementStatus.REVERSED;
      await manager.getRepository(InsuranceClaim).save(claim);

      await manager.getRepository(ClaimStatusHistory).save({
        claim_id: claim.id,
        old_status: claim.status,
        new_status: claim.status,
        reason: `Disbursement reversed: ${reason}`,
        changed_by: user.id,
      });

      await this.financialProjectionService.recalculate(manager, claim.id);

      return disbursement;
    });
  }
}
