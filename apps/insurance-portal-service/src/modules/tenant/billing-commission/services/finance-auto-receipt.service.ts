import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentTransactionStatus,
  ReceiptStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager, In } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceJournalService } from './finance-journal.service';
import { FinanceCommandService } from './finance-command.service';
import { Invoice } from '../entities/invoice.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { Receipt } from '../entities/receipt.entity';

@Injectable()
export class FinanceAutoReceiptService {
  constructor(
    private readonly configService: ConfigService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly journalService: FinanceJournalService,
    private readonly financeCommandService: FinanceCommandService,
  ) {}

  async postWhenEligible(
    manager: EntityManager,
    payment: PaymentTransaction,
  ): Promise<Receipt | null> {
    const enabled = this.configService.get<boolean>(
      'FINANCE_AUTO_RECEIPT_PROVIDER_PAYMENTS',
      true,
    );

    if (!enabled || payment.status !== PaymentTransactionStatus.SUCCESSFUL) {
      return null;
    }

    const existing = await manager.getRepository(Receipt).findOne({
      where: {
        payment_transaction_id: payment.id,
        status: In([
          ReceiptStatus.POSTED,
          ReceiptStatus.PARTIALLY_ALLOCATED,
          ReceiptStatus.FULLY_ALLOCATED,
        ]),
      },
    });

    if (existing) {
      return existing;
    }

    const invoice =
      payment.invoice_id === null
        ? await this.resolveExactInvoice(manager, payment)
        : await manager.getRepository(Invoice).findOne({
            where: { id: payment.invoice_id },
          });

    if (invoice && !payment.invoice_id) {
      payment.invoice_id = invoice.id;
      await manager.getRepository(PaymentTransaction).save(payment);
    }

    const customerId = payment.customer_id ?? invoice?.customer_id ?? null;

    if (!customerId) {
      return null;
    }

    const receiptNumber = await this.identifierService.generateReceiptNumber(
      payment.company_id,
      manager,
    );

    const unsigned = {
      paymentTransactionId: payment.id,
      transactionNumber: payment.transaction_no,
      receiptNumber,
      payerCustomerId: payment.customer_id,
      payerName: payment.payer_name,
      paymentMethod: payment.payment_method,
      paymentReference: payment.payment_reference,
      providerReference: payment.provider_transaction_id,
      currencyCode: payment.currency,
      exchangeRate: payment.exchange_rate,
      receiptAmount: payment.amount,
      postedAt: new Date().toISOString(),
    };

    const receipt = await manager.getRepository(Receipt).save(
      manager.getRepository(Receipt).create({
        company_id: payment.company_id,
        customer_id: customerId,
        payment_transaction_id: payment.id,
        payer_customer_id: payment.customer_id,
        invoice_id: invoice?.id ?? null,
        receipt_no: receiptNumber,
        payment_method: payment.payment_method ?? 'OTHER',
        payer_name: payment.payer_name,
        amount: payment.amount,
        currency: payment.currency,
        exchange_rate: payment.exchange_rate,
        allocated_amount: '0.0000',
        unallocated_amount: payment.amount,
        payment_reference: payment.payment_reference,
        provider_reference: payment.provider_transaction_id,
        receipt_hash: this.hashService.hashDefinition(unsigned),
        status: ReceiptStatus.POSTED,
        received_by: payment.updated_by ?? payment.created_by ?? null,
        received_at: payment.received_at ?? new Date(),
        posted_by: payment.updated_by ?? payment.created_by ?? null,
        posted_at: new Date(),
        state_version: 1,
      }),
    );

    payment.receipt_id = receipt.id;
    await manager.getRepository(PaymentTransaction).save(payment);

    await this.journalService.postReceipt(
      manager,
      receipt,
      `provider-receipt:${payment.id}:${payment.provider_event_id ?? payment.provider_transaction_id ?? payment.transaction_no ?? 'event'}`,
      payment.updated_by ?? payment.created_by ?? null,
    );

    const autoAllocate = this.configService.get<boolean>(
      'FINANCE_AUTO_ALLOCATE_EXACT_INVOICE_REFERENCE',
      true,
    );

    if (autoAllocate && invoice) {
      const paymentAmount = DecimalUtil.value(payment.amount);
      const invoiceBalance = DecimalUtil.value(invoice.balance_amount);
      const amount = paymentAmount.greaterThan(invoiceBalance)
        ? invoiceBalance
        : paymentAmount;

      if (amount.greaterThan(0)) {
        await this.financeCommandService.allocateWithManager(
          manager,
          {
            id: payment.updated_by ?? payment.created_by ?? null,
            companyId: payment.company_id,
          },
          {
            receiptId: receipt.id,
            invoiceId: invoice.id,
            amount,
            idempotencyKey: `provider-allocation:${payment.id}:${invoice.id}`,
          },
        );
      }
    }

    return receipt;
  }

  private async resolveExactInvoice(
    manager: EntityManager,
    payment: PaymentTransaction,
  ): Promise<Invoice | null> {
    const reference = payment.payment_reference?.trim();

    if (!reference) {
      return null;
    }

    const matches = await manager.getRepository(Invoice).find({
      where: {
        company_id: payment.company_id,
        invoice_no: reference,
      },
      take: 2,
    });

    return matches.length === 1 ? matches[0] : null;
  }
}
