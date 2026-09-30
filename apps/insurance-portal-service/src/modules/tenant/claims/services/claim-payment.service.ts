import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, EntityManager, In } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { Policy } from '../../policies/entities/policy.entity';
import { ClaimsService } from '../claims.service';
import {
  CreateClaimPaymentDto,
  TiramisSubmitOptionsDto,
} from '../dto/claim-workflow.dto';
import { ClaimDischargeVoucher } from '../entities/claim-discharge-voucher.entity';
import { ClaimDisbursement } from '../entities/claim-disbursement.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimPayment } from '../entities/claim-payment.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
  ClaimDischargeStatus,
  ClaimIntimationStatus,
  ClaimPaymentStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimApprovalService } from './claim-approval.service';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';
import { ClaimTiramisService } from './claim-tiramis.service';

const PAYMENT_SUBJECT = 'PAYMENT';

/** Payments that still draw on the approved amount. */
const COMMITTED_PAYMENT_STATUSES = [
  ClaimPaymentStatus.DRAFT,
  ClaimPaymentStatus.SUBMITTED,
  ClaimPaymentStatus.APPROVED,
  ClaimPaymentStatus.PROCESSING,
  ClaimPaymentStatus.PAID,
];

/**
 * Claim payments (TIRAMIS §13). A payment is an instruction; money moves
 * only through ClaimDisbursementService, and only a confirmed (PAID)
 * payment is reported to TIRA and counts towards settlement.
 */
@Injectable()
export class ClaimPaymentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: ClaimAccessService,
    private readonly claims: ClaimsService,
    private readonly referenceService: BusinessReferenceService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly approvals: ClaimApprovalService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
  ) {}

  async create(user: AuthenticatedUser, claimId: string, dto: CreateClaimPaymentDto) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (
        ![
          ClaimStatus.DISCHARGE_ACCEPTED,
          ClaimStatus.PAYMENT_PENDING,
          ClaimStatus.PARTIALLY_PAID,
        ].includes(claim.status)
      ) {
        throw new ConflictException(
          'Payments need a claim whose discharge voucher the claimant accepted',
        );
      }

      const voucher = await this.acceptedVoucher(manager, claim, dto.discharge_voucher_id);
      const amount = dto.paid_amount;

      if (MoneyUtil.compare(amount, '0.00') <= 0) {
        throw new BadRequestException('The payment amount must be greater than zero');
      }

      const available = await this.availableAmount(manager, claim, voucher);

      if (MoneyUtil.compare(amount, available) > 0) {
        throw new BadRequestException(
          `The payment exceeds the amount still payable on this claim (${available} ${claim.currency_code})`,
        );
      }

      if (dto.claim_resulted_litigation && !dto.litigation_reason?.trim()) {
        throw new BadRequestException('Give the litigation reason');
      }

      const claimants = await this.claims.activeClaimants(manager, claim.id);
      const payee = dto.claimant_id
        ? claimants.find((claimant) => claimant.id === dto.claimant_id)
        : claimants.find((claimant) => claimant.is_primary);

      if (dto.claimant_id && !payee) {
        throw new BadRequestException('The selected claimant does not belong to this claim');
      }

      const intimation = await manager.getRepository(ClaimIntimation).findOne({
        where: { claim_id: claim.id, status: ClaimIntimationStatus.ACCEPTED },
        order: { created_at: 'DESC' },
      });
      const payment = await manager.getRepository(ClaimPayment).save(
        manager.getRepository(ClaimPayment).create({
          company_id: claim.company_id,
          branch_id: claim.branch_id,
          sale_point_id: claim.sale_point_id,
          claim_id: claim.id,
          claimant_id: payee?.id ?? null,
          discharge_voucher_id: voucher.id,
          claim_payment_number: await this.referenceService.next({
            companyId: claim.company_id,
            documentType: 'CLAIM_PAYMENT',
            prefix: `CP-${new Date().getFullYear()}-`,
            manager,
          }),
          claim_reference_number: claim.claim_reference_number,
          claim_intimation_number: intimation?.claim_intimation_number ?? null,
          cover_note_reference_number: claim.cover_note_reference_number,
          payment_date: null,
          paid_amount: amount,
          payment_mode: dto.payment_mode,
          payment_method: dto.payment_method?.trim() ?? null,
          payment_reference: dto.payment_reference?.trim() ?? null,
          parties_notified: dto.parties_notified ?? 'N',
          net_premium_earned: await this.netPremiumEarned(manager, claim),
          claim_resulted_litigation: dto.claim_resulted_litigation ? 'Y' : 'N',
          litigation_reason: dto.litigation_reason?.trim() ?? null,
          currency_code: claim.currency_code,
          exchange_rate: claim.exchange_rate,
          payee_type: dto.payee_type ?? 'CLAIMANT',
          payee_id: payee?.id ?? null,
          payee_snapshot: {
            name: dto.payee_name?.trim() || payee?.full_name || null,
            phone: payee?.phone ?? null,
            email: payee?.email ?? null,
          },
          payee_bank_details: dto.payee_bank_details ?? null,
          claimants: (payee ? [payee] : claimants).map((claimant) =>
            this.tiramisPayload.identityClaimant(claimant),
          ) as unknown as Record<string, unknown>[],
          status: ClaimPaymentStatus.DRAFT,
          created_by: user.id,
          tiramis_status: 'NOT_SUBMITTED',
        }),
      );

      const summary = `Claim payment ${payment.claim_payment_number} of ${amount} ${claim.currency_code} prepared`;

      if (claim.status === ClaimStatus.DISCHARGE_ACCEPTED) {
        await this.stateMachine.transition(manager, claim, ClaimStatus.PAYMENT_PENDING, {
          eventType: 'PAYMENT_CREATED',
          summary,
          actorId: user.id,
          subjectType: PAYMENT_SUBJECT,
          subjectId: payment.id,
        });
      } else {
        await this.stateMachine.recordEvent(manager, claim, {
          eventType: 'PAYMENT_CREATED',
          summary,
          actorId: user.id,
          subjectType: PAYMENT_SUBJECT,
          subjectId: payment.id,
        });
      }

      return payment;
    });
  }

  async submit(user: AuthenticatedUser, paymentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, paymentId);

      if (record.status !== ClaimPaymentStatus.DRAFT) {
        throw new ConflictException('Only a draft payment can be submitted');
      }

      await this.claims.assertMandatoryDocuments(claim, 'PAYMENT', manager);

      record.status = ClaimPaymentStatus.SUBMITTED;
      record.submitted_by = user.id;
      record.submitted_at = new Date();
      await manager.getRepository(ClaimPayment).save(record);
      await this.approvals.submit(manager, this.subject(claim, record), user.id);

      return record;
    });
  }

  async approve(user: AuthenticatedUser, paymentId: string, comments?: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, paymentId);

      if (record.status !== ClaimPaymentStatus.SUBMITTED) {
        throw new ConflictException('Only a submitted payment can be approved');
      }

      const outcome = await this.approvals.approve(manager, user, this.subject(claim, record), comments);

      if (!outcome.completed) {
        return { payment: record, completed: false };
      }

      // Re-check headroom: other payments may have been approved meanwhile.
      const voucher = await this.acceptedVoucher(manager, claim, record.discharge_voucher_id);
      const available = MoneyUtil.add(
        await this.availableAmount(manager, claim, voucher),
        record.paid_amount,
      );

      if (MoneyUtil.compare(record.paid_amount, available) > 0) {
        throw new ConflictException('Approving this payment would overpay the claim');
      }

      record.status = ClaimPaymentStatus.APPROVED;
      record.approved_by = user.id;
      record.approved_at = new Date();
      await manager.getRepository(ClaimPayment).save(record);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'PAYMENT_APPROVED',
        summary: `Claim payment ${record.claim_payment_number} approved for disbursement`,
        actorId: user.id,
        subjectType: PAYMENT_SUBJECT,
        subjectId: record.id,
      });

      return { payment: record, completed: true };
    });
  }

  async decline(
    user: AuthenticatedUser,
    paymentId: string,
    comments: string,
    decision: 'REJECT' | 'RETURN' = 'REJECT',
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, paymentId);

      if (record.status !== ClaimPaymentStatus.SUBMITTED) {
        throw new ConflictException('Only a submitted payment can be declined');
      }

      await this.approvals.decline(
        manager,
        user,
        this.subject(claim, record),
        decision === 'RETURN' ? ClaimApprovalStatus.RETURNED : ClaimApprovalStatus.REJECTED,
        comments,
      );

      record.status = decision === 'RETURN' ? ClaimPaymentStatus.DRAFT : ClaimPaymentStatus.CANCELLED;
      record.rejection_reason = comments.trim();
      await manager.getRepository(ClaimPayment).save(record);

      if (decision === 'REJECT') {
        await this.releasePaymentPending(manager, user, claim, record);
      }

      return record;
    });
  }

  /** Draft payments may be cancelled by their maker; nothing else is deleted. */
  async cancel(user: AuthenticatedUser, paymentId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, paymentId);

      if (record.status !== ClaimPaymentStatus.DRAFT) {
        throw new ConflictException('Only a draft payment can be cancelled');
      }

      record.status = ClaimPaymentStatus.CANCELLED;
      record.rejection_reason = reason.trim();
      await manager.getRepository(ClaimPayment).save(record);
      await this.releasePaymentPending(manager, user, claim, record);

      return record;
    });
  }

  async submitToTiramis(
    user: AuthenticatedUser,
    paymentId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const { record, claim } = await this.dataSource.transaction((manager) =>
      this.lock(manager, user, paymentId),
    );

    if (record.status !== ClaimPaymentStatus.PAID) {
      throw new ConflictException('Only a confirmed (paid) payment is reported to TIRAMIS');
    }

    if (!claim.claim_reference_number || !record.claim_intimation_number) {
      throw new ConflictException(
        'The claim needs a TIRA claim reference and an accepted intimation',
      );
    }

    return this.claimTiramis.submit({
      user,
      claim,
      operationType: ClaimRegulatoryOperationType.PAYMENT,
      sourceRecordId: record.id,
      sourceRecordNumber: record.claim_payment_number,
      payload: this.tiramisPayload.payment(claim, record),
      retry: options.retry,
    });
  }

  /** Scope check for the finance disbursement routes. */
  async assertPaymentAccess(user: AuthenticatedUser, paymentId: string) {
    await this.dataSource.transaction((manager) => this.lock(manager, user, paymentId));
  }

  async assertDisbursementAccess(user: AuthenticatedUser, disbursementId: string) {
    await this.dataSource.transaction(async (manager) => {
      const { record } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimDisbursement,
        disbursementId,
        'Claim disbursement',
      );

      return record;
    });
  }

  async paymentIdForDisbursement(disbursementId: string) {
    const disbursement = await this.dataSource
      .getRepository(ClaimDisbursement)
      .findOne({ where: { id: disbursementId }, select: ['id', 'claim_payment_id'] });

    return disbursement?.claim_payment_id ?? null;
  }

  private async releasePaymentPending(
    manager: EntityManager,
    user: AuthenticatedUser,
    claim: InsuranceClaim,
    payment: ClaimPayment,
  ) {
    const open = await manager.getRepository(ClaimPayment).count({
      where: {
        claim_id: claim.id,
        status: In([
          ClaimPaymentStatus.DRAFT,
          ClaimPaymentStatus.SUBMITTED,
          ClaimPaymentStatus.APPROVED,
          ClaimPaymentStatus.PROCESSING,
          ClaimPaymentStatus.PAID,
        ]),
      },
    });
    const input = {
      eventType: 'PAYMENT_CANCELLED',
      summary: `Claim payment ${payment.claim_payment_number} cancelled: ${payment.rejection_reason}`,
      actorId: user.id,
      subjectType: PAYMENT_SUBJECT,
      subjectId: payment.id,
    };

    if (open === 0 && claim.status === ClaimStatus.PAYMENT_PENDING) {
      await this.stateMachine.transition(manager, claim, ClaimStatus.DISCHARGE_ACCEPTED, input);
    } else {
      await this.stateMachine.recordEvent(manager, claim, input);
    }
  }

  private async acceptedVoucher(
    manager: EntityManager,
    claim: InsuranceClaim,
    voucherId?: string | null,
  ) {
    const voucher = await manager.getRepository(ClaimDischargeVoucher).findOne({
      where: voucherId
        ? { id: voucherId, claim_id: claim.id, status: ClaimDischargeStatus.ACCEPTED }
        : { claim_id: claim.id, status: ClaimDischargeStatus.ACCEPTED },
      order: { version: 'DESC' },
    });

    if (!voucher) {
      throw new BadRequestException('No accepted discharge voucher was found for this claim');
    }

    return voucher;
  }

  /**
   * Remaining payable = min(approved amount, accepted voucher amount) less
   * every payment already committed (drafts included), so concurrent
   * payments can never add up to an overpayment.
   */
  private async availableAmount(
    manager: EntityManager,
    claim: InsuranceClaim,
    voucher: ClaimDischargeVoucher,
  ) {
    const voucherAmount = voucher.reconciled_amount ?? voucher.claim_offer_amount;
    const ceiling =
      MoneyUtil.compare(voucherAmount, claim.approved_amount) < 0
        ? voucherAmount
        : claim.approved_amount;
    const committed = await manager
      .getRepository(ClaimPayment)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.paid_amount), 0)', 'total')
      .where('payment.claim_id = :claimId', { claimId: claim.id })
      .andWhere('payment.status IN (:...statuses)', { statuses: COMMITTED_PAYMENT_STATUSES })
      .getRawOne<{ total: string }>();
    const remaining = MoneyUtil.subtract(ceiling, MoneyUtil.fromMinor(MoneyUtil.toMinor(committed?.total ?? 0)));

    return MoneyUtil.compare(remaining, '0.00') > 0 ? remaining : '0.00';
  }

  /** Pro-rata earned net premium at today's date (TIRA NetPremiumEarned). */
  private async netPremiumEarned(manager: EntityManager, claim: InsuranceClaim) {
    const policy = await manager.getRepository(Policy).findOne({
      where: { id: claim.policy_id },
      select: ['id', 'net_premium', 'start_date', 'end_date'],
    });

    if (!policy) {
      return '0.00';
    }

    const start = new Date(`${policy.start_date}T00:00:00+03:00`).getTime();
    const end = new Date(`${policy.end_date}T23:59:59+03:00`).getTime();
    const ratio = end > start ? Math.min(Math.max((Date.now() - start) / (end - start), 0), 1) : 1;

    return (Number(policy.net_premium ?? 0) * ratio).toFixed(2);
  }

  private lock(manager: EntityManager, user: AuthenticatedUser, paymentId: string) {
    return this.access.getRecordForWrite(manager, user, ClaimPayment, paymentId, 'Claim payment');
  }

  private subject(claim: InsuranceClaim, payment: ClaimPayment) {
    return {
      claim,
      subjectType: PAYMENT_SUBJECT,
      subjectId: payment.id,
      approvalType: ClaimApprovalType.PAYMENT,
      amount: payment.paid_amount,
      currencyCode: payment.currency_code,
    };
  }
}
