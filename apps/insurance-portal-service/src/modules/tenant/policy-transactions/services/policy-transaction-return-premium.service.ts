import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  InvoiceSourceType,
  PolicyTransactionEventType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  ReceiptStatus,
  RefundStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceRefund } from '../../billing-commission/entities/finance-refund.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { ReceiptAllocation } from '../../billing-commission/entities/receipt-allocation.entity';
import { ReceiptAllocationStatus } from '../../billing-commission/enums/finance-status.enums';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';

@Injectable()
export class PolicyTransactionReturnPremiumService {
  constructor(
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async createRequests(
    manager: EntityManager,
    transaction: PolicyTransaction,
    policy: Policy,
    childResourceId: string,
    sourceType:
      | typeof InvoiceSourceType.ENDORSEMENT
      | typeof InvoiceSourceType.CANCELLATION,
  ): Promise<FinanceRefund[]> {
    if (transaction.stage !== PolicyTransactionStage.APPLIED) {
      return [];
    }

    if (
      transaction.premium_effect !== PolicyTransactionPremiumEffect.CREDIT ||
      DecimalUtil.value(transaction.return_premium).lessThanOrEqualTo(0)
    ) {
      return [];
    }

    const existing = await manager.getRepository(FinanceRefund).find({
      where: {
        company_id: transaction.company_id,
        source_type: sourceType,
        source_record_id: transaction.id,
      },
      order: { created_at: 'ASC' },
    });

    if (existing.length) {
      return existing;
    }

    const invoices = await manager
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice.company_id = :companyId', {
        companyId: transaction.company_id,
      })
      .andWhere('invoice.deleted_at IS NULL')
      .andWhere(
        `
        (
          invoice.policy_id = :policyId
          OR (
            invoice.source_type = :quotationSource
            AND invoice.source_record_id = :quotationId
          )
        )
        `,
        {
          policyId: policy.id,
          quotationSource: InvoiceSourceType.QUOTATION,
          quotationId:
            policy.quotation_id ?? '00000000-0000-0000-0000-000000000000',
        },
      )
      .getMany();

    if (!invoices.length) {
      throw new ConflictException({
        code: 'RETURN_PREMIUM_SOURCE_INVOICE_MISSING',
        message:
          'No paid policy premium invoice could be resolved for the return premium.',
      });
    }

    const allocations = await manager
      .getRepository(ReceiptAllocation)
      .createQueryBuilder('allocation')
      .leftJoinAndSelect('allocation.receipt', 'receipt')
      .where('allocation.company_id = :companyId', {
        companyId: transaction.company_id,
      })
      .andWhere('allocation.invoice_id IN (:...invoiceIds)', {
        invoiceIds: invoices.map((invoice) => invoice.id),
      })
      .andWhere('allocation.status = :allocationStatus', {
        allocationStatus: ReceiptAllocationStatus.ACTIVE,
      })
      .andWhere('receipt.status IN (:...receiptStatuses)', {
        receiptStatuses: [
          ReceiptStatus.POSTED,
          ReceiptStatus.PARTIALLY_ALLOCATED,
          ReceiptStatus.FULLY_ALLOCATED,
        ],
      })
      .orderBy('allocation.allocated_at', 'ASC')
      .getMany();

    let remaining = DecimalUtil.value(transaction.return_premium);
    const refundable: Array<{
      allocation: ReceiptAllocation;
      amount: string;
    }> = [];

    for (const allocation of allocations) {
      if (remaining.lessThanOrEqualTo(0)) {
        break;
      }

      const reserved = await manager
        .getRepository(FinanceRefund)
        .createQueryBuilder('refund')
        .select('COALESCE(SUM(refund.amount), 0)', 'amount')
        .where('refund.company_id = :companyId', {
          companyId: transaction.company_id,
        })
        .andWhere('refund.receipt_id = :receiptId', {
          receiptId: allocation.receipt_id,
        })
        .andWhere('refund.invoice_id = :invoiceId', {
          invoiceId: allocation.invoice_id,
        })
        .andWhere('refund.status IN (:...statuses)', {
          statuses: [
            RefundStatus.REQUESTED,
            RefundStatus.APPROVED,
            RefundStatus.PROCESSING,
            RefundStatus.PAID,
          ],
        })
        .getRawOne<{ amount: string }>();

      const available = DecimalUtil.value(allocation.amount).minus(
        DecimalUtil.value(reserved?.amount ?? 0),
      );

      if (available.lessThanOrEqualTo(0)) {
        continue;
      }

      const amount = available.lessThan(remaining) ? available : remaining;
      refundable.push({ allocation, amount: amount.toFixed(4) });
      remaining = remaining.minus(amount);
    }

    if (remaining.greaterThan(0)) {
      throw new ConflictException({
        code: 'RETURN_PREMIUM_INSUFFICIENT_REFUNDABLE_FUNDS',
        message: `Only part of the return premium can currently be traced to refundable receipts. Outstanding amount: ${remaining.toFixed(
          4,
        )}.`,
      });
    }

    const created: FinanceRefund[] = [];

    for (const item of refundable) {
      const receipt = item.allocation.receipt;
      const refundNo = await this.identifierService.generateRefundNumber(
        transaction.company_id,
        manager,
      );
      const source = {
        transactionId: transaction.id,
        transactionNo: transaction.transaction_no,
        policyId: policy.id,
        childResourceId,
        sourceType,
        receiptId: item.allocation.receipt_id,
        invoiceId: item.allocation.invoice_id,
        amount: item.amount,
        currency: transaction.currency_code,
      };

      const refund = await manager.getRepository(FinanceRefund).save({
        company_id: transaction.company_id,
        refund_no: refundNo,
        customer_id: receipt?.payer_customer_id ?? policy.customer_id,
        invoice_id: item.allocation.invoice_id,
        receipt_id: item.allocation.receipt_id,
        payment_transaction_id: receipt?.payment_transaction_id ?? null,
        status: RefundStatus.REQUESTED,
        payment_method: receipt?.payment_method ?? 'OTHER',
        amount: item.amount,
        currency_code: transaction.currency_code,
        reason: `Return premium for ${sourceType.toLowerCase()} ${transaction.transaction_no}`,
        requested_by: transaction.completed_by ?? transaction.requested_by,
        requested_at: new Date(),
        idempotency_key: [
          sourceType.toLowerCase(),
          transaction.id,
          'return-premium',
          item.allocation.receipt_id,
          item.allocation.invoice_id,
        ].join(':'),
        refund_hash: this.hashService.hashDefinition(source),
        source_type: sourceType,
        source_record_id: transaction.id,
        policy_id: policy.id,
        endorsement_id:
          sourceType === InvoiceSourceType.ENDORSEMENT ? childResourceId : null,
        cancellation_id:
          sourceType === InvoiceSourceType.CANCELLATION
            ? childResourceId
            : null,
      });

      created.push(refund);
    }

    transaction.active_refund_id = created[0]?.id ?? null;
    transaction.last_command = 'RETURN_PREMIUM_REQUESTED';
    await manager.getRepository(PolicyTransaction).save(transaction);

    await manager.getRepository(PolicyTransactionEvent).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      event_type: PolicyTransactionEventType.RETURN_PREMIUM_REQUESTED,
      actor_type: 'SYSTEM',
      actor_id: null,
      from_stage: transaction.stage,
      to_stage: transaction.stage,
      metadata: {
        amount: transaction.return_premium,
        currency: transaction.currency_code,
        refunds: created.map((refund) => ({
          id: refund.id,
          refundNo: refund.refund_no,
          amount: refund.amount,
        })),
      },
    });

    return created;
  }
}
