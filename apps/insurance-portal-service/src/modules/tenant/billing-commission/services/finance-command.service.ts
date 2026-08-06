import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CommissionAccrualStatus,
  CommissionPaymentStatus,
  InvoiceSourceType,
  InvoiceStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  ReceiptStatus,
  RefundStatus,
} from '@insurance-max/contracts';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import {
  ApproveCommissionAccrualDto,
  ApproveCommissionPaymentDto,
  ApproveRefundDto,
  AllocateReceiptDto,
  CancelRefundDto,
  CreateCommissionPaymentCommandDto,
  IssueInvoiceDto,
  PayCommissionPaymentDto,
  PayRefundDto,
  PostReceiptDto,
  RecordPaymentTransactionDto,
  RequestRefundDto,
  ReverseCommissionAccrualDto,
  ReverseCommissionPaymentDto,
  ReverseAllocationDto,
  ReverseReceiptDto,
  VoidInvoiceDto,
} from '../dto/finance-operations.dto';
import { CommissionPayment } from '../entities/commission-payment.entity';
import { CommissionPaymentItem } from '../entities/commission-payment-item.entity';
import { CommissionTransaction } from '../entities/commission-transaction.entity';
import { FinanceRefund } from '../entities/finance-refund.entity';
import { Invoice } from '../entities/invoice.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { ReceiptAllocation } from '../entities/receipt-allocation.entity';
import { Receipt } from '../entities/receipt.entity';
import { FinanceJournalService } from './finance-journal.service';
import { FinanceOutboxService } from './finance-outbox.service';
import { InvoiceBalanceService } from './invoice-balance.service';
import { QuotationPaymentProjectionService } from './quotation-payment-projection.service';
import { ReceiptBalanceService } from './receipt-balance.service';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';

@Injectable()
export class FinanceCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly invoiceBalanceService: InvoiceBalanceService,
    private readonly receiptBalanceService: ReceiptBalanceService,
    private readonly journalService: FinanceJournalService,
    private readonly outboxService: FinanceOutboxService,
    private readonly quotationPaymentProjectionService: QuotationPaymentProjectionService,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptAllocation)
    private readonly allocationRepository: Repository<ReceiptAllocation>,
    @InjectRepository(FinanceRefund)
    private readonly refundRepository: Repository<FinanceRefund>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionTransactionRepository: Repository<CommissionTransaction>,
    @InjectRepository(CommissionPayment)
    private readonly commissionPaymentRepository: Repository<CommissionPayment>,
    @InjectRepository(CommissionPaymentItem)
    private readonly commissionPaymentItemRepository: Repository<CommissionPaymentItem>,
  ) {}

  async issue(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: IssueInvoiceDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.getInvoiceForUpdate(
        manager,
        user.companyId!,
        invoiceId,
      );

      if (invoice.state_version !== dto.expected_state_version) {
        throw new ConflictException({
          code: 'INVOICE_VERSION_CONFLICT',
          message: 'The invoice changed before this operation was completed.',
        });
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException('Only a draft invoice can be issued.');
      }

      const items = await manager.getRepository(Invoice).findOne({
        where: { id: invoice.id },
        relations: { items: true },
      });
      const lineTotal = (items?.items ?? []).reduce(
        (total, item) => total.plus(DecimalUtil.value(item.total_amount)),
        DecimalUtil.value(0),
      );

      if (!lineTotal.equals(DecimalUtil.value(invoice.total_amount))) {
        throw new ConflictException({
          code: 'INVOICE_TOTAL_MISMATCH',
          message: 'Invoice line totals do not equal the invoice total.',
        });
      }

      invoice.status = InvoiceStatus.ISSUED;
      invoice.due_date = dto.due_date ?? invoice.due_date;
      invoice.notes = dto.notes ?? invoice.notes;
      invoice.issued_by = user.id;
      invoice.issued_at = new Date();
      invoice.state_version = Number(invoice.state_version ?? 0) + 1;
      invoice.balance_hash = this.invoiceBalanceService.calculateHash(invoice);
      invoice.updated_by = user.id;

      const saved = await manager.getRepository(Invoice).save(invoice);

      await this.journalService.postInvoice(
        manager,
        saved,
        dto.idempotency_key,
        user.id,
      );

      await this.outboxService.add(manager, {
        companyId: saved.company_id,
        aggregateType: 'INVOICE',
        aggregateId: saved.id,
        eventType: 'INVOICE_ISSUED',
        eventKey: `invoice:${saved.id}:issued`,
        payload: {
          invoiceId: saved.id,
          invoiceNumber: saved.invoice_no,
          sourceType: saved.source_type,
          sourceRecordId: saved.source_record_id,
          sourceRevision: saved.source_revision,
          amount: saved.total_amount,
          currencyCode: saved.currency,
        },
      });

      return saved;
    });
  }

  async voidInvoice(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: VoidInvoiceDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.getInvoiceForUpdate(
        manager,
        user.companyId!,
        invoiceId,
      );

      if (DecimalUtil.value(invoice.allocated_amount).greaterThan(0)) {
        throw new ConflictException(
          'An invoice with allocated payment cannot be voided.',
        );
      }

      if (
        invoice.status !== InvoiceStatus.DRAFT &&
        invoice.status !== InvoiceStatus.ISSUED
      ) {
        throw new ConflictException(
          'The invoice cannot be voided from its current status.',
        );
      }

      invoice.status = InvoiceStatus.VOIDED;
      invoice.voided_by = user.id;
      invoice.voided_at = new Date();
      invoice.void_reason = dto.reason.trim();
      invoice.balance_amount = '0.0000';
      invoice.state_version = Number(invoice.state_version ?? 0) + 1;
      invoice.updated_by = user.id;

      const saved = await manager.getRepository(Invoice).save(invoice);

      if (invoice.issued_at) {
        await this.journalService.reverseInvoice(
          manager,
          invoice,
          dto.idempotency_key,
          user.id,
          dto.reason,
        );
      }

      await this.outboxService.add(manager, {
        companyId: invoice.company_id,
        aggregateType: 'INVOICE',
        aggregateId: invoice.id,
        eventType: 'INVOICE_VOIDED',
        eventKey: `invoice:${invoice.id}:voided`,
        payload: {
          invoiceId: invoice.id,
          reason: dto.reason,
        },
      });

      return saved;
    });
  }

  async recordManualPayment(
    user: AuthenticatedUser,
    dto: RecordPaymentTransactionDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const requestHash = this.hashService.hashDefinition(
        dto as unknown as Record<string, unknown>,
      );

      const providerCode = dto.provider_code.trim().toUpperCase();
      const existing = await manager.getRepository(PaymentTransaction).findOne({
        where: {
          company_id: user.companyId!,
          provider_code: providerCode,
          idempotency_key: dto.idempotency_key,
        },
      });

      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new ConflictException({
            code: 'PAYMENT_IDEMPOTENCY_CONFLICT',
            message:
              'The idempotency key was already used for another payment.',
          });
        }
        return existing;
      }

      let invoice: Invoice | null = null;
      if (dto.invoice_id) {
        invoice = await manager.getRepository(Invoice).findOne({
          where: {
            id: dto.invoice_id,
            company_id: user.companyId!,
            status: In([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]),
          },
        });

        if (!invoice) {
          throw new BadRequestException(
            'An open issued invoice was not found.',
          );
        }

        if (invoice.currency !== dto.currency_code.trim().toUpperCase()) {
          throw new BadRequestException(
            'Payment currency does not match the invoice currency.',
          );
        }
      }

      const transactionNo =
        await this.identifierService.generatePaymentTransactionNumber(
          user.companyId!,
          manager,
        );

      return manager.getRepository(PaymentTransaction).save({
        company_id: user.companyId!,
        transaction_no: transactionNo,
        customer_id: dto.customer_id ?? invoice?.customer_id ?? null,
        invoice_id: invoice?.id ?? null,
        provider: providerCode,
        provider_code: providerCode,
        provider_reference: dto.payment_reference.trim(),
        provider_transaction_id: dto.provider_transaction_id?.trim() ?? null,
        provider_event_id: null,
        internal_reference: transactionNo,
        payment_method: dto.payment_method,
        status: PaymentTransactionStatus.SUCCESSFUL,
        amount: DecimalUtil.value(dto.amount).toFixed(4),
        currency: dto.currency_code.trim().toUpperCase(),
        provider_amount: null,
        provider_currency_code: null,
        exchange_rate: DecimalUtil.rate(dto.exchange_rate ?? 1),
        payer_name: dto.payer_name.trim(),
        payer_phone: dto.payer_phone?.trim() ?? null,
        payer_email: dto.payer_email?.trim().toLowerCase() ?? null,
        payment_reference: dto.payment_reference.trim(),
        idempotency_key: dto.idempotency_key,
        request_hash: requestHash,
        received_at: new Date(),
        settled_at: new Date(),
        created_by: user.id,
        updated_by: user.id,
      });
    });
  }

  async postReceipt(user: AuthenticatedUser, dto: PostReceiptDto) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(PaymentTransaction)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.id = :paymentId', {
          paymentId: dto.payment_transaction_id,
        })
        .andWhere('payment.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!payment || payment.status !== PaymentTransactionStatus.SUCCESSFUL) {
        throw new BadRequestException(
          'Only a successful payment transaction can produce a receipt.',
        );
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

      const receiptNumber = await this.identifierService.generateReceiptNumber(
        user.companyId!,
        manager,
      );

      const receiptUnsigned = {
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

      const resolvedCustomerId =
        payment.customer_id ??
        (payment.invoice_id
          ? ((
              await manager.getRepository(Invoice).findOne({
                where: { id: payment.invoice_id },
                select: { customer_id: true },
              })
            )?.customer_id ?? null)
          : null);

      if (!resolvedCustomerId) {
        throw new BadRequestException(
          'A customer-linked payment transaction is required to post a receipt.',
        );
      }

      const receipt = await manager.getRepository(Receipt).save(
        manager.getRepository(Receipt).create({
          company_id: user.companyId!,
          customer_id: resolvedCustomerId,
          receipt_no: receiptNumber,
          payment_transaction_id: payment.id,
          payer_customer_id: payment.customer_id,
          invoice_id: payment.invoice_id ?? dto.invoice_id ?? null,
          payer_name: payment.payer_name,
          payment_method: payment.payment_method ?? PaymentMethod.OTHER,
          payment_reference: payment.payment_reference,
          provider_reference: payment.provider_transaction_id,
          currency: payment.currency,
          amount: payment.amount,
          exchange_rate: payment.exchange_rate,
          allocated_amount: '0.0000',
          unallocated_amount: payment.amount,
          status: ReceiptStatus.POSTED,
          receipt_hash: this.hashService.hashDefinition(receiptUnsigned),
          posted_by: user.id,
          posted_at: new Date(),
          received_by: user.id,
          received_at: payment.received_at ?? new Date(),
          state_version: 1,
        }),
      );

      payment.receipt_id = receipt.id;
      payment.updated_by = user.id;
      await manager.getRepository(PaymentTransaction).save(payment);

      await this.journalService.postReceipt(
        manager,
        receipt,
        dto.idempotency_key,
        user.id,
      );

      if (dto.invoice_id) {
        await this.allocateWithManager(manager, user, {
          receiptId: receipt.id,
          invoiceId: dto.invoice_id,
          amount: DecimalUtil.value(dto.allocation_amount ?? payment.amount),
          idempotencyKey: `${dto.idempotency_key}:allocation`,
        });
      }

      return manager.getRepository(Receipt).findOneOrFail({
        where: { id: receipt.id },
      });
    });
  }

  async allocate(
    user: AuthenticatedUser,
    receiptId: string,
    dto: AllocateReceiptDto,
  ) {
    return this.dataSource.transaction((manager) =>
      this.allocateWithManager(manager, user, {
        receiptId,
        invoiceId: dto.invoice_id,
        amount: DecimalUtil.value(dto.amount),
        idempotencyKey: dto.idempotency_key,
      }),
    );
  }

  async allocateWithManager(
    manager: EntityManager,
    user: Pick<AuthenticatedUser, 'companyId'> & { id: string | null },
    params: {
      receiptId: string;
      invoiceId: string;
      amount: ReturnType<typeof DecimalUtil.value>;
      idempotencyKey: string;
    },
  ) {
    const receipt = await manager
      .getRepository(Receipt)
      .createQueryBuilder('receipt')
      .setLock('pessimistic_write')
      .where('receipt.id = :receiptId', { receiptId: params.receiptId })
      .andWhere('receipt.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .getOne();

    const invoice = await manager
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :invoiceId', { invoiceId: params.invoiceId })
      .andWhere('invoice.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .getOne();

    if (!receipt || !invoice) {
      throw new NotFoundException('Receipt or invoice was not found.');
    }

    if (
      receipt.status !== ReceiptStatus.POSTED &&
      receipt.status !== ReceiptStatus.PARTIALLY_ALLOCATED &&
      receipt.status !== ReceiptStatus.FULLY_ALLOCATED
    ) {
      throw new ConflictException('The receipt cannot be allocated.');
    }

    if (
      invoice.status !== InvoiceStatus.ISSUED &&
      invoice.status !== InvoiceStatus.PARTIALLY_PAID
    ) {
      throw new ConflictException('The invoice cannot receive payment.');
    }

    if (receipt.company_id !== invoice.company_id) {
      throw new ConflictException('Receipt and invoice company mismatch.');
    }

    if (receipt.currency !== invoice.currency) {
      throw new BadRequestException(
        'Receipt and invoice currencies do not match.',
      );
    }

    if (params.amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Allocation amount must be greater than zero.',
      );
    }

    const receiptAvailable = DecimalUtil.value(receipt.unallocated_amount);
    const invoiceBalance = DecimalUtil.value(invoice.balance_amount);
    if (params.amount.greaterThan(receiptAvailable)) {
      throw new BadRequestException(
        'Allocation exceeds the unallocated receipt amount.',
      );
    }

    if (params.amount.greaterThan(invoiceBalance)) {
      throw new BadRequestException('Allocation exceeds the invoice balance.');
    }

    const allocationUnsigned = {
      receiptId: receipt.id,
      invoiceId: invoice.id,
      amount: params.amount.toFixed(4),
      currencyCode: invoice.currency,
      idempotencyKey: params.idempotencyKey,
    };

    const allocationHash = this.hashService.hashDefinition(allocationUnsigned);
    const existing = await manager.getRepository(ReceiptAllocation).findOne({
      where: {
        allocation_hash: allocationHash,
        status: ReceiptAllocationStatus.ACTIVE,
      },
    });

    if (existing) {
      return existing;
    }

    const allocation = await manager.getRepository(ReceiptAllocation).save(
      manager.getRepository(ReceiptAllocation).create({
        company_id: user.companyId!,
        receipt_id: receipt.id,
        invoice_id: invoice.id,
        amount: params.amount.toFixed(4),
        currency: invoice.currency,
        status: ReceiptAllocationStatus.ACTIVE,
        allocation_hash: allocationHash,
        allocated_by: user.id ?? null,
        allocated_at: new Date(),
      }),
    );

    const savedInvoice = await this.invoiceBalanceService.recalculate(
      manager,
      invoice.id,
    );
    await this.receiptBalanceService.recalculate(manager, receipt.id);
    await this.quotationPaymentProjectionService.publishInvoiceBalance(
      manager,
      savedInvoice.id,
      allocation.id,
    );

    return allocation;
  }

  async reverseAllocation(
    user: AuthenticatedUser,
    allocationId: string,
    dto: ReverseAllocationDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const allocation = await manager
        .getRepository(ReceiptAllocation)
        .createQueryBuilder('allocation')
        .setLock('pessimistic_write')
        .where('allocation.id = :allocationId', { allocationId })
        .andWhere('allocation.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!allocation || allocation.status !== ReceiptAllocationStatus.ACTIVE) {
        throw new NotFoundException('Active allocation was not found.');
      }

      allocation.status = ReceiptAllocationStatus.REVERSED;
      allocation.reversed_by = user.id;
      allocation.reversed_at = new Date();
      allocation.reversal_reason = dto.reason.trim();
      await manager.getRepository(ReceiptAllocation).save(allocation);

      await this.invoiceBalanceService.recalculate(
        manager,
        allocation.invoice_id,
      );
      await this.receiptBalanceService.recalculate(
        manager,
        allocation.receipt_id,
      );
      await this.quotationPaymentProjectionService.publishInvoiceBalance(
        manager,
        allocation.invoice_id,
        allocation.id,
      );

      return allocation;
    });
  }

  async reverseReceipt(
    user: AuthenticatedUser,
    receiptId: string,
    dto: ReverseReceiptDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await manager
        .getRepository(Receipt)
        .createQueryBuilder('receipt')
        .setLock('pessimistic_write')
        .where('receipt.id = :receiptId', { receiptId })
        .andWhere('receipt.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!receipt) {
        throw new NotFoundException('Receipt was not found.');
      }

      if (receipt.status === ReceiptStatus.REVERSED) {
        return receipt;
      }

      if (receipt.status === ReceiptStatus.VOIDED) {
        throw new ConflictException('A voided receipt cannot be reversed.');
      }

      const allocations = await manager.getRepository(ReceiptAllocation).find({
        where: {
          receipt_id: receipt.id,
          status: ReceiptAllocationStatus.ACTIVE,
        },
      });

      const affectedInvoiceIds = new Set<string>();
      for (const allocation of allocations) {
        allocation.status = ReceiptAllocationStatus.REVERSED;
        allocation.reversed_by = user.id;
        allocation.reversed_at = new Date();
        allocation.reversal_reason = dto.reason.trim();
        affectedInvoiceIds.add(allocation.invoice_id);
      }
      await manager.getRepository(ReceiptAllocation).save(allocations);

      receipt.status = ReceiptStatus.REVERSED;
      receipt.reversed_by = user.id;
      receipt.reversed_at = new Date();
      receipt.reversal_reason = dto.reason.trim();
      receipt.allocated_amount = '0.0000';
      receipt.unallocated_amount = '0.0000';
      await manager.getRepository(Receipt).save(receipt);

      if (receipt.payment_transaction_id) {
        await manager
          .getRepository(PaymentTransaction)
          .update(receipt.payment_transaction_id, {
            status: PaymentTransactionStatus.REVERSED,
            updated_by: user.id,
          });
      }

      await this.journalService.reverseReceipt(
        manager,
        receipt,
        dto.idempotency_key,
        user.id,
        dto.reason,
      );

      for (const invoiceId of affectedInvoiceIds) {
        await this.invoiceBalanceService.recalculate(manager, invoiceId);
        await this.quotationPaymentProjectionService.publishInvoiceBalance(
          manager,
          invoiceId,
          receipt.id,
        );
      }

      return receipt;
    });
  }

  async requestRefund(user: AuthenticatedUser, dto: RequestRefundDto) {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await manager.getRepository(Receipt).findOne({
        where: {
          id: dto.receipt_id,
          company_id: user.companyId!,
          status: In([
            ReceiptStatus.POSTED,
            ReceiptStatus.PARTIALLY_ALLOCATED,
            ReceiptStatus.FULLY_ALLOCATED,
          ]),
        },
      });

      if (!receipt) {
        throw new NotFoundException('Posted receipt was not found.');
      }

      const previouslyRefunded = await manager
        .getRepository(FinanceRefund)
        .createQueryBuilder('refund')
        .select(`COALESCE(SUM(refund.amount), 0)`, 'amount')
        .where('refund.receipt_id = :receiptId', { receiptId: receipt.id })
        .andWhere('refund.status = :status', { status: RefundStatus.PAID })
        .getRawOne<{ amount: string }>();

      const available = DecimalUtil.value(receipt.amount).minus(
        DecimalUtil.value(previouslyRefunded?.amount ?? 0),
      );
      const requested = DecimalUtil.value(dto.amount);
      if (requested.greaterThan(available)) {
        throw new BadRequestException(
          'Refund exceeds the available refundable amount.',
        );
      }

      const refundNo = await this.identifierService.generateRefundNumber(
        user.companyId!,
        manager,
      );
      const unsigned = {
        refundNo,
        receiptId: receipt.id,
        invoiceId: dto.invoice_id ?? null,
        amount: requested.toFixed(4),
        currencyCode: receipt.currency,
        reason: dto.reason.trim(),
      };

      return manager.getRepository(FinanceRefund).save({
        company_id: user.companyId!,
        refund_no: refundNo,
        customer_id: receipt.payer_customer_id,
        invoice_id: dto.invoice_id ?? null,
        receipt_id: receipt.id,
        payment_transaction_id: receipt.payment_transaction_id,
        status: RefundStatus.REQUESTED,
        payment_method: receipt.payment_method,
        amount: requested.toFixed(4),
        currency_code: receipt.currency,
        reason: dto.reason.trim(),
        requested_by: user.id,
        requested_at: new Date(),
        idempotency_key: dto.idempotency_key,
        refund_hash: this.hashService.hashDefinition(unsigned),
      });
    });
  }

  async approveRefund(
    user: AuthenticatedUser,
    refundId: string,
    dto: ApproveRefundDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const refund = await manager
        .getRepository(FinanceRefund)
        .createQueryBuilder('refund')
        .setLock('pessimistic_write')
        .where('refund.id = :refundId', { refundId })
        .andWhere('refund.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!refund) {
        throw new NotFoundException('Refund was not found.');
      }

      if (refund.status === RefundStatus.APPROVED) {
        return refund;
      }

      if (refund.status !== RefundStatus.REQUESTED) {
        throw new ConflictException('Only a requested refund can be approved.');
      }

      if (refund.requested_by === user.id) {
        throw new ConflictException(
          'The requester cannot approve the same refund.',
        );
      }

      refund.status = RefundStatus.APPROVED;
      refund.approved_by = user.id;
      refund.approved_at = new Date();

      return manager.getRepository(FinanceRefund).save(refund);
    });
  }

  async payRefund(
    user: AuthenticatedUser,
    refundId: string,
    dto: PayRefundDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const refund = await manager
        .getRepository(FinanceRefund)
        .createQueryBuilder('refund')
        .setLock('pessimistic_write')
        .where('refund.id = :refundId', { refundId })
        .andWhere('refund.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!refund) {
        throw new NotFoundException('Refund was not found.');
      }

      if (refund.status === RefundStatus.PAID) {
        return refund;
      }

      if (refund.status !== RefundStatus.APPROVED) {
        throw new ConflictException('Only an approved refund can be paid.');
      }

      refund.status = RefundStatus.PAID;
      refund.provider_refund_id = dto.provider_refund_id?.trim() ?? null;
      refund.paid_by = user.id;
      refund.paid_at = new Date();
      refund.failure_message = dto.notes?.trim() ?? null;

      const saved = await manager.getRepository(FinanceRefund).save(refund);

      await this.journalService.postRefund(
        manager,
        saved,
        dto.idempotency_key,
        user.id,
      );

      if (saved.invoice_id) {
        await this.invoiceBalanceService.recalculate(manager, saved.invoice_id);
        await this.quotationPaymentProjectionService.publishInvoiceBalance(
          manager,
          saved.invoice_id,
          saved.id,
        );

        const invoice = await manager.getRepository(Invoice).findOne({
          where: { id: saved.invoice_id },
        });

        if (
          invoice &&
          invoice.source_type === InvoiceSourceType.QUOTATION &&
          invoice.source_record_id &&
          invoice.source_revision
        ) {
          await this.outboxService.add(manager, {
            companyId: invoice.company_id,
            aggregateType: 'REFUND',
            aggregateId: saved.id,
            eventType: 'QUOTATION_PAYMENT_EVENT',
            eventKey: `refund:${saved.id}:paid`,
            payload: {
              eventId: `refund:${saved.id}:paid`,
              companyId: invoice.company_id,
              quotationId: invoice.source_record_id,
              workflowRevision: invoice.source_revision,
              invoiceId: invoice.id,
              eventType: 'PAYMENT_REFUNDED',
              allocatedAmount: invoice.allocated_amount ?? '0.0000',
              totalAllocatedAmount: invoice.paid_amount ?? '0.0000',
              currencyCode: invoice.currency,
              receiptId: saved.receipt_id,
              refundId: saved.id,
              occurredAt: new Date().toISOString(),
            },
          });
        }
      }

      return saved;
    });
  }

  async cancelRefund(
    user: AuthenticatedUser,
    refundId: string,
    dto: CancelRefundDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const refund = await manager
        .getRepository(FinanceRefund)
        .createQueryBuilder('refund')
        .setLock('pessimistic_write')
        .where('refund.id = :refundId', { refundId })
        .andWhere('refund.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!refund) {
        throw new NotFoundException('Refund was not found.');
      }

      if (refund.status === RefundStatus.CANCELLED) {
        return refund;
      }

      if (
        refund.status !== RefundStatus.REQUESTED &&
        refund.status !== RefundStatus.APPROVED
      ) {
        throw new ConflictException(
          'Only a requested or approved refund can be cancelled.',
        );
      }

      refund.status = RefundStatus.CANCELLED;
      refund.failure_message = dto.reason.trim();

      return manager.getRepository(FinanceRefund).save(refund);
    });
  }

  async approveCommissionAccrual(
    user: AuthenticatedUser,
    accrualId: string,
    _dto: ApproveCommissionAccrualDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const accrual = await manager
        .getRepository(CommissionTransaction)
        .createQueryBuilder('accrual')
        .setLock('pessimistic_write')
        .where('accrual.id = :accrualId', { accrualId })
        .andWhere('accrual.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!accrual) {
        throw new NotFoundException('Commission accrual was not found.');
      }

      if (accrual.status === CommissionAccrualStatus.APPROVED) {
        return accrual;
      }

      if (
        accrual.status !== CommissionAccrualStatus.ACCRUED &&
        accrual.status !== CommissionAccrualStatus.DRAFT
      ) {
        throw new ConflictException(
          'Only a draft or accrued commission can be approved.',
        );
      }

      if (accrual.accrued_by && accrual.accrued_by === user.id) {
        throw new ConflictException(
          'The user who accrued the commission cannot approve it.',
        );
      }

      accrual.status = CommissionAccrualStatus.APPROVED;
      accrual.approved_by = user.id;
      accrual.approved_at = new Date();

      return manager.getRepository(CommissionTransaction).save(accrual);
    });
  }

  async reverseCommissionAccrual(
    user: AuthenticatedUser,
    accrualId: string,
    dto: ReverseCommissionAccrualDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const accrual = await manager
        .getRepository(CommissionTransaction)
        .createQueryBuilder('accrual')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('accrual.invoice', 'invoice')
        .where('accrual.id = :accrualId', { accrualId })
        .andWhere('accrual.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!accrual) {
        throw new NotFoundException('Commission accrual was not found.');
      }

      if (accrual.status === CommissionAccrualStatus.REVERSED) {
        return accrual;
      }

      if (DecimalUtil.value(accrual.paid_amount).greaterThan(0)) {
        throw new ConflictException(
          'A paid commission accrual cannot be reversed.',
        );
      }

      accrual.status = CommissionAccrualStatus.REVERSED;
      accrual.reversed_by = user.id;
      accrual.reversed_at = new Date();
      accrual.reversal_reason = dto.reason.trim();

      const saved = await manager
        .getRepository(CommissionTransaction)
        .save(accrual);

      await this.journalService.reverseCommissionAccrual(
        manager,
        saved,
        dto.idempotency_key,
        user.id,
        dto.reason.trim(),
      );

      return saved;
    });
  }

  async createCommissionPayment(
    user: AuthenticatedUser,
    dto: CreateCommissionPaymentCommandDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(CommissionPayment).findOne({
        where: {
          company_id: user.companyId!,
          idempotency_key: dto.idempotency_key,
        },
        relations: { items: true },
      });

      if (existing) {
        return existing;
      }

      const paymentAmount = DecimalUtil.value(dto.amount);
      const totalAllocations = dto.allocations.reduce(
        (total, allocation) => total.plus(DecimalUtil.value(allocation.amount)),
        DecimalUtil.value(0),
      );

      if (!totalAllocations.equals(paymentAmount)) {
        throw new BadRequestException(
          'The total commission allocations must equal the payment amount.',
        );
      }

      const accrualIds = [
        ...new Set(
          dto.allocations.map((item) => item.commission_transaction_id),
        ),
      ];
      const accruals = await manager
        .getRepository(CommissionTransaction)
        .createQueryBuilder('accrual')
        .setLock('pessimistic_write')
        .where('accrual.id IN (:...accrualIds)', { accrualIds })
        .andWhere('accrual.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getMany();

      if (accruals.length !== accrualIds.length) {
        throw new NotFoundException(
          'One or more commission accruals were not found.',
        );
      }

      for (const accrual of accruals) {
        if (accrual.intermediary_company_id !== dto.intermediary_company_id) {
          throw new ConflictException(
            'All commission accruals must belong to the same intermediary.',
          );
        }

        if (
          accrual.status !== CommissionAccrualStatus.APPROVED &&
          accrual.status !== CommissionAccrualStatus.PARTIALLY_PAID
        ) {
          throw new ConflictException(
            'Only approved commission accruals can be selected for payment.',
          );
        }
      }

      const paymentNo =
        await this.identifierService.generateCommissionPaymentNumber(
          user.companyId!,
          manager,
        );

      const payment = await manager.getRepository(CommissionPayment).save(
        manager.getRepository(CommissionPayment).create({
          company_id: user.companyId!,
          intermediary_company_id: dto.intermediary_company_id,
          payment_no: paymentNo,
          payment_method: dto.payment_method,
          payment_reference: dto.payment_reference.trim(),
          idempotency_key: dto.idempotency_key,
          total_amount: paymentAmount.toFixed(4),
          allocated_amount: totalAllocations.toFixed(4),
          unallocated_amount: '0.0000',
          currency: dto.currency_code.trim().toUpperCase(),
          status: CommissionPaymentStatus.DRAFT,
          submitted_by: user.id,
          submitted_at: new Date(),
        }),
      );

      const items = dto.allocations.map((allocation) =>
        manager.getRepository(CommissionPaymentItem).create({
          commission_payment_id: payment.id,
          commission_transaction_id: allocation.commission_transaction_id,
          amount: DecimalUtil.value(allocation.amount).toFixed(4),
          status: 'ACTIVE',
          allocated_by: user.id,
          allocated_at: new Date(),
        }),
      );

      await manager.getRepository(CommissionPaymentItem).save(items);

      return manager.getRepository(CommissionPayment).findOneOrFail({
        where: { id: payment.id },
        relations: { items: true },
      });
    });
  }

  async approveCommissionPayment(
    user: AuthenticatedUser,
    paymentId: string,
    _dto: ApproveCommissionPaymentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(CommissionPayment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.id = :paymentId', { paymentId })
        .andWhere('payment.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!payment) {
        throw new NotFoundException('Commission payment was not found.');
      }

      if (payment.status === CommissionPaymentStatus.APPROVED) {
        return payment;
      }

      if (payment.status !== CommissionPaymentStatus.DRAFT) {
        throw new ConflictException(
          'Only a draft commission payment can be approved.',
        );
      }

      if (payment.submitted_by === user.id) {
        throw new ConflictException(
          'The creator of the commission payment cannot approve it.',
        );
      }

      payment.status = CommissionPaymentStatus.APPROVED;
      payment.approved_by = user.id;
      payment.approved_at = new Date();

      return manager.getRepository(CommissionPayment).save(payment);
    });
  }

  async payCommissionPayment(
    user: AuthenticatedUser,
    paymentId: string,
    dto: PayCommissionPaymentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(CommissionPayment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('payment.items', 'items')
        .where('payment.id = :paymentId', { paymentId })
        .andWhere('payment.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!payment) {
        throw new NotFoundException('Commission payment was not found.');
      }

      if (payment.status === CommissionPaymentStatus.PAID) {
        return payment;
      }

      if (payment.status !== CommissionPaymentStatus.APPROVED) {
        throw new ConflictException(
          'Only an approved commission payment can be paid.',
        );
      }

      for (const item of payment.items ?? []) {
        if (item.status !== 'ACTIVE') {
          continue;
        }

        const accrual = await manager
          .getRepository(CommissionTransaction)
          .createQueryBuilder('accrual')
          .setLock('pessimistic_write')
          .where('accrual.id = :accrualId', {
            accrualId: item.commission_transaction_id,
          })
          .andWhere('accrual.company_id = :companyId', {
            companyId: user.companyId!,
          })
          .getOne();

        if (!accrual) {
          throw new NotFoundException('Commission accrual was not found.');
        }

        if (
          DecimalUtil.value(item.amount).greaterThan(
            DecimalUtil.value(accrual.balance_amount),
          )
        ) {
          throw new BadRequestException(
            'Payment allocation cannot exceed the commission accrual balance.',
          );
        }

        accrual.paid_amount = DecimalUtil.value(accrual.paid_amount)
          .plus(item.amount)
          .toFixed(4);
        accrual.balance_amount = DecimalUtil.value(accrual.commission_amount)
          .minus(accrual.paid_amount)
          .toFixed(4);
        accrual.status = DecimalUtil.value(
          accrual.balance_amount,
        ).lessThanOrEqualTo(0)
          ? CommissionAccrualStatus.PAID
          : CommissionAccrualStatus.PARTIALLY_PAID;
        accrual.paid_at = new Date();

        await manager.getRepository(CommissionTransaction).save(accrual);
      }

      payment.status = CommissionPaymentStatus.PAID;
      payment.paid_by = user.id;
      payment.paid_at = new Date();
      payment.rejection_reason = dto.notes?.trim() ?? payment.rejection_reason;

      const saved = await manager
        .getRepository(CommissionPayment)
        .save(payment);

      await this.journalService.postCommissionPayment(
        manager,
        saved,
        dto.idempotency_key,
        user.id,
      );

      return saved;
    });
  }

  async reverseCommissionPayment(
    user: AuthenticatedUser,
    paymentId: string,
    dto: ReverseCommissionPaymentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(CommissionPayment)
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('payment.items', 'items')
        .where('payment.id = :paymentId', { paymentId })
        .andWhere('payment.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!payment) {
        throw new NotFoundException('Commission payment was not found.');
      }

      if (payment.status === CommissionPaymentStatus.REVERSED) {
        return payment;
      }

      if (payment.status !== CommissionPaymentStatus.PAID) {
        throw new ConflictException(
          'Only a paid commission payment can be reversed.',
        );
      }

      for (const item of payment.items ?? []) {
        if (item.status !== 'ACTIVE') {
          continue;
        }

        const accrual = await manager
          .getRepository(CommissionTransaction)
          .createQueryBuilder('accrual')
          .setLock('pessimistic_write')
          .where('accrual.id = :accrualId', {
            accrualId: item.commission_transaction_id,
          })
          .andWhere('accrual.company_id = :companyId', {
            companyId: user.companyId!,
          })
          .getOne();

        if (!accrual) {
          throw new NotFoundException('Commission accrual was not found.');
        }

        accrual.paid_amount = DecimalUtil.value(accrual.paid_amount)
          .minus(item.amount)
          .toFixed(4);
        accrual.balance_amount = DecimalUtil.value(accrual.commission_amount)
          .minus(accrual.paid_amount)
          .toFixed(4);
        accrual.status = DecimalUtil.value(
          accrual.paid_amount,
        ).lessThanOrEqualTo(0)
          ? CommissionAccrualStatus.APPROVED
          : CommissionAccrualStatus.PARTIALLY_PAID;

        await manager.getRepository(CommissionTransaction).save(accrual);

        item.status = 'REVERSED';
        item.reversed_by = user.id;
        item.reversed_at = new Date();
        item.reversal_reason = dto.reason.trim();
        await manager.getRepository(CommissionPaymentItem).save(item);
      }

      payment.status = CommissionPaymentStatus.REVERSED;
      payment.reversed_by = user.id;
      payment.reversed_at = new Date();
      payment.reversal_reason = dto.reason.trim();

      const saved = await manager
        .getRepository(CommissionPayment)
        .save(payment);

      await this.journalService.reverseCommissionPayment(
        manager,
        saved,
        dto.idempotency_key,
        user.id,
        dto.reason.trim(),
      );

      return saved;
    });
  }

  private async getInvoiceForUpdate(
    manager: EntityManager,
    companyId: string,
    invoiceId: string,
  ) {
    const invoice = await manager
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :invoiceId', { invoiceId })
      .andWhere('invoice.company_id = :companyId', { companyId })
      .getOne();

    if (!invoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    return invoice;
  }
}
