import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import type { TenantDataScope } from '../../shared/authorization/interfaces/tenant-data-scope.interface';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import {
  AllocateReceiptDto,
  IssueInvoiceDto,
  PostReceiptDto,
  ReverseFinancialRecordDto,
  VoidInvoiceDto,
} from './dto/finance-operations.dto';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { FinancialReversal } from './entities/financial-reversal.entity';
import { Invoice } from './entities/invoice.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { ReceiptAllocation } from './entities/receipt-allocation.entity';
import { Receipt } from './entities/receipt.entity';
import {
  InvoiceLifecycleStatus,
  ReceiptAllocationStatus,
  ReceiptLifecycleStatus,
} from './enums/finance-status.enums';
import { MoneyUtil } from './utils/money.util';

@Injectable()
export class FinanceLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptAllocation)
    private readonly allocationRepository: Repository<ReceiptAllocation>,
    @InjectRepository(FinancialReversal)
    private readonly reversalRepository: Repository<FinancialReversal>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionRepository: Repository<CommissionTransaction>,
    @InjectRepository(CommissionPayment)
    private readonly commissionPaymentRepository:
      Repository<CommissionPayment>,
    @InjectRepository(CommissionPaymentItem)
    private readonly commissionPaymentItemRepository:
      Repository<CommissionPaymentItem>,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly referenceService: BusinessReferenceService,
    private readonly auditService: AuditService,
  ) {}

  async issueInvoice(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: IssueInvoiceDto,
  ): Promise<Invoice> {
    const result = await this.dataSource.transaction(async (manager) => {
      const invoice = await this.getInvoiceForUpdate(
        manager,
        user,
        invoiceId,
      );

      if (invoice.status !== InvoiceLifecycleStatus.DRAFT) {
        throw new ConflictException(
          'Only a draft invoice can be issued',
        );
      }

      if (MoneyUtil.compare(invoice.total_amount, '0.00') <= 0) {
        throw new BadRequestException(
          'Invoice total must be greater than zero',
        );
      }

      invoice.status = InvoiceLifecycleStatus.ISSUED;
      invoice.due_date = dto.due_date ?? invoice.due_date;
      invoice.posted_by = user.id;
      invoice.posted_at = new Date();
      invoice.updated_by = user.id;

      return manager.getRepository(Invoice).save(invoice);
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'invoice.issued',
      resource: 'invoice',
      resourceId: result.id,
      metadata: { due_date: result.due_date },
    });

    return result;
  }

  async voidInvoice(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: VoidInvoiceDto,
  ): Promise<Invoice> {
    const result = await this.dataSource.transaction(async (manager) => {
      const invoice = await this.getInvoiceForUpdate(
        manager,
        user,
        invoiceId,
      );

      if (invoice.status === InvoiceLifecycleStatus.PAID) {
        throw new ConflictException(
          'Paid invoices cannot be voided',
        );
      }

      const activeAllocationCount = await manager
        .getRepository(ReceiptAllocation)
        .count({
          where: {
            company_id: user.companyId!,
            invoice_id: invoice.id,
            status: ReceiptAllocationStatus.ACTIVE,
          },
        });

      if (activeAllocationCount > 0) {
        throw new ConflictException(
          'Invoices with active allocations cannot be voided',
        );
      }

      invoice.status = InvoiceLifecycleStatus.VOID;
      invoice.voided_by = user.id;
      invoice.voided_at = new Date();
      invoice.void_reason = dto.reason;
      invoice.updated_by = user.id;

      const saved = await manager.getRepository(Invoice).save(invoice);
      await this.createReversalRecord(manager, {
        companyId: user.companyId!,
        resourceType: 'invoice',
        resourceId: saved.id,
        originalAmount: saved.total_amount,
        reversalAmount: saved.balance_amount,
        currency: saved.currency,
        reason: dto.reason,
        userId: user.id,
      });

      return saved;
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'invoice.voided',
      resource: 'invoice',
      resourceId: result.id,
      metadata: { reason: dto.reason },
    });

    return result;
  }

  async postReceipt(
    user: AuthenticatedUser,
    receiptId: string,
    dto: PostReceiptDto,
  ): Promise<Receipt> {
    const result = await this.dataSource.transaction(async (manager) => {
      const receipt = await this.getReceiptForUpdate(
        manager,
        user,
        receiptId,
      );

      if (receipt.status !== ReceiptLifecycleStatus.RECEIVED) {
        throw new ConflictException(
          'Only received receipts can be posted',
        );
      }

      receipt.status = ReceiptLifecycleStatus.POSTED;
      receipt.posted_by = user.id;
      receipt.posted_at = new Date();
      receipt.unallocated_amount = receipt.amount;
      receipt.payment_reference =
        dto.posting_reference ?? receipt.payment_reference;

      return manager.getRepository(Receipt).save(receipt);
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'receipt.posted',
      resource: 'receipt',
      resourceId: result.id,
    });

    return result;
  }

  async allocateReceipt(
    user: AuthenticatedUser,
    receiptId: string,
    dto: AllocateReceiptDto,
  ): Promise<ReceiptAllocation> {
    const result = await this.dataSource.transaction(async (manager) => {
      const receipt = await this.getReceiptForUpdate(
        manager,
        user,
        receiptId,
      );
      const invoice = await this.getInvoiceForUpdate(
        manager,
        user,
        dto.invoice_id,
      );

      if (
        ![
          ReceiptLifecycleStatus.POSTED,
          ReceiptLifecycleStatus.PARTIALLY_ALLOCATED,
        ].includes(
          receipt.status as ReceiptLifecycleStatus,
        )
      ) {
        throw new ConflictException(
          'Receipts must be posted before allocation',
        );
      }

      if (
        ![
          InvoiceLifecycleStatus.ISSUED,
          InvoiceLifecycleStatus.PARTIALLY_PAID,
        ].includes(invoice.status as InvoiceLifecycleStatus)
      ) {
        throw new ConflictException(
          'Only issued invoices can receive allocations',
        );
      }

      if (invoice.customer_id !== receipt.customer_id) {
        throw new BadRequestException(
          'Receipt and invoice customers must match',
        );
      }

      if (invoice.currency !== receipt.currency) {
        throw new BadRequestException(
          'Receipt and invoice currencies must match',
        );
      }

      const amount = MoneyUtil.fromMinor(MoneyUtil.toMinor(dto.amount));

      if (MoneyUtil.compare(amount, '0.00') <= 0) {
        throw new BadRequestException(
          'Allocation amount must be greater than zero',
        );
      }

      if (
        MoneyUtil.compare(amount, receipt.unallocated_amount) > 0
      ) {
        throw new BadRequestException(
          'Allocation cannot exceed receipt unallocated amount',
        );
      }

      if (MoneyUtil.compare(amount, invoice.balance_amount) > 0) {
        throw new BadRequestException(
          'Allocation cannot exceed invoice balance',
        );
      }

      const existingActive = await manager
        .getRepository(ReceiptAllocation)
        .findOne({
          where: {
            company_id: user.companyId!,
            receipt_id: receipt.id,
            invoice_id: invoice.id,
            status: ReceiptAllocationStatus.ACTIVE,
          },
        });

      if (existingActive) {
        throw new ConflictException(
          'An active allocation already exists for this receipt and invoice',
        );
      }

      const allocation = await manager
        .getRepository(ReceiptAllocation)
        .save(
          manager.getRepository(ReceiptAllocation).create({
            company_id: user.companyId!,
            receipt_id: receipt.id,
            invoice_id: invoice.id,
            amount,
            currency: receipt.currency,
            status: ReceiptAllocationStatus.ACTIVE,
            allocated_by: user.id,
          }),
        );

      await this.recalculateInvoiceFromAllocations(
        manager,
        user.companyId!,
        invoice.id,
      );
      await this.recalculateReceiptAllocationState(
        manager,
        user.companyId!,
        receipt.id,
      );

      return allocation;
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'receipt.allocated',
      resource: 'receipt_allocation',
      resourceId: result.id,
      metadata: {
        receipt_id: receiptId,
        invoice_id: dto.invoice_id,
        amount: result.amount,
      },
    });

    return result;
  }

  async reverseAllocation(
    user: AuthenticatedUser,
    allocationId: string,
    dto: ReverseFinancialRecordDto,
  ): Promise<ReceiptAllocation> {
    const result = await this.dataSource.transaction(async (manager) => {
      const allocation = await manager
        .getRepository(ReceiptAllocation)
        .findOne({
          where: {
            id: allocationId,
            company_id: user.companyId!,
          },
        });

      if (!allocation) {
        throw new NotFoundException('Allocation not found');
      }

      if (allocation.status !== ReceiptAllocationStatus.ACTIVE) {
        throw new ConflictException(
          'Only active allocations can be reversed',
        );
      }

      const receipt = await this.getReceiptForUpdate(
        manager,
        user,
        allocation.receipt_id,
      );
      await this.getInvoiceForUpdate(
        manager,
        user,
        allocation.invoice_id,
      );

      allocation.status = ReceiptAllocationStatus.REVERSED;
      allocation.reversed_by = user.id;
      allocation.reversed_at = new Date();
      allocation.reversal_reason = dto.reason;

      const saved = await manager
        .getRepository(ReceiptAllocation)
        .save(allocation);

      await this.createReversalRecord(manager, {
        companyId: user.companyId!,
        resourceType: 'receipt_allocation',
        resourceId: saved.id,
        originalAmount: saved.amount,
        reversalAmount: saved.amount,
        currency: saved.currency,
        reason: dto.reason,
        userId: user.id,
      });

      await this.recalculateInvoiceFromAllocations(
        manager,
        user.companyId!,
        saved.invoice_id,
      );
      await this.recalculateReceiptAllocationState(
        manager,
        user.companyId!,
        receipt.id,
      );

      return saved;
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'receipt.allocation_reversed',
      resource: 'receipt_allocation',
      resourceId: result.id,
    });

    return result;
  }

  async reverseReceipt(
    user: AuthenticatedUser,
    receiptId: string,
    dto: ReverseFinancialRecordDto,
  ): Promise<Receipt> {
    const result = await this.dataSource.transaction(async (manager) => {
      const receipt = await this.getReceiptForUpdate(
        manager,
        user,
        receiptId,
      );

      const activeAllocationCount = await manager
        .getRepository(ReceiptAllocation)
        .count({
          where: {
            company_id: user.companyId!,
            receipt_id: receipt.id,
            status: ReceiptAllocationStatus.ACTIVE,
          },
        });

      if (activeAllocationCount > 0) {
        throw new ConflictException(
          'Receipt cannot be reversed while active allocations exist',
        );
      }

      if (receipt.status === ReceiptLifecycleStatus.REVERSED) {
        throw new ConflictException(
          'Receipt is already reversed',
        );
      }

      receipt.status = ReceiptLifecycleStatus.REVERSED;
      receipt.reversed_by = user.id;
      receipt.reversed_at = new Date();
      receipt.reversal_reason = dto.reason;
      receipt.unallocated_amount = '0.00';

      const saved = await manager.getRepository(Receipt).save(receipt);

      await this.createReversalRecord(manager, {
        companyId: user.companyId!,
        resourceType: 'receipt',
        resourceId: saved.id,
        originalAmount: saved.amount,
        reversalAmount: saved.amount,
        currency: saved.currency,
        reason: dto.reason,
        userId: user.id,
      });

      return saved;
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'receipt.reversed',
      resource: 'receipt',
      resourceId: result.id,
    });

    return result;
  }

  async markCommissionPaymentPaid(
    user: AuthenticatedUser,
    paymentId: string,
  ): Promise<CommissionPayment> {
    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(CommissionPayment)
        .findOne({
          where: {
            id: paymentId,
            company_id: user.companyId!,
          },
          relations: { items: true },
        });

      if (!payment) {
        throw new NotFoundException('Commission payment not found');
      }

      if (payment.status === 'PAID') {
        return payment;
      }

      const items = await manager
        .getRepository(CommissionPaymentItem)
        .find({
          where: { commission_payment_id: payment.id },
        });

      for (const item of items) {
        const transaction = await manager
          .getRepository(CommissionTransaction)
          .findOne({
            where: {
              id: item.commission_transaction_id,
              company_id: user.companyId!,
            },
          });

        if (!transaction) {
          throw new NotFoundException(
            'Commission transaction not found',
          );
        }

        if (
          MoneyUtil.compare(
            item.amount,
            transaction.balance_amount,
          ) > 0
        ) {
          throw new BadRequestException(
            'Commission payment cannot exceed commission balance',
          );
        }

        transaction.paid_amount = MoneyUtil.add(
          transaction.paid_amount,
          item.amount,
        );
        transaction.balance_amount = MoneyUtil.subtract(
          transaction.commission_amount,
          transaction.paid_amount,
        );
        transaction.paid_at = new Date();
        transaction.status =
          MoneyUtil.compare(transaction.balance_amount, '0.00') === 0
            ? 'PAID'
            : 'PARTIALLY_PAID';

        await manager
          .getRepository(CommissionTransaction)
          .save(transaction);
      }

      payment.status = 'PAID';
      payment.paid_by = user.id;
      payment.paid_at = new Date();

      return manager.getRepository(CommissionPayment).save(payment);
    });

    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'commission.payment_paid',
      resource: 'commission_payment',
      resourceId: result.id,
    });

    return result;
  }

  private async getInvoiceForUpdate(
    manager: EntityManager,
    user: AuthenticatedUser,
    invoiceId: string,
  ) {
    const invoice = await manager.getRepository(Invoice).findOne({
      where: {
        id: invoiceId,
        company_id: user.companyId!,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    this.assertFinanceRecordScope(
      this.dataAccessScopeService.resolve(user),
      invoice.branch_id,
      invoice.created_by,
    );

    return invoice;
  }

  private async getReceiptForUpdate(
    manager: EntityManager,
    user: AuthenticatedUser,
    receiptId: string,
  ) {
    const receipt = await manager.getRepository(Receipt).findOne({
      where: {
        id: receiptId,
        company_id: user.companyId!,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    this.assertFinanceRecordScope(
      this.dataAccessScopeService.resolve(user),
      receipt.branch_id,
      receipt.received_by,
    );

    return receipt;
  }

  private assertFinanceRecordScope(
    scope: TenantDataScope,
    branchId: string | null,
    fallbackUserId: string | null,
  ) {
    if (scope.canViewAllBranches) {
      return;
    }

    if (scope.ownRecordsOnly) {
      if (fallbackUserId !== scope.userId) {
        throw new ForbiddenException(
          'You are not allowed to access this record',
        );
      }
      return;
    }

    if (branchId && scope.allowedBranchIds.includes(branchId)) {
      return;
    }

    if (!branchId && fallbackUserId === scope.userId) {
      return;
    }

    throw new ForbiddenException(
      'You are not allowed to access this record',
    );
  }

  private async recalculateInvoiceFromAllocations(
    manager: EntityManager,
    companyId: string,
    invoiceId: string,
  ) {
    const invoice = await manager.getRepository(Invoice).findOne({
      where: {
        id: invoiceId,
        company_id: companyId,
      },
    });

    if (!invoice) {
      return;
    }

    const aggregate = await manager
      .getRepository(ReceiptAllocation)
      .createQueryBuilder('allocation')
      .select('COALESCE(SUM(allocation.amount), 0)', 'total')
      .where('allocation.company_id = :companyId', { companyId })
      .andWhere('allocation.invoice_id = :invoiceId', { invoiceId })
      .andWhere('allocation.status = :status', {
        status: ReceiptAllocationStatus.ACTIVE,
      })
      .getRawOne<{ total: string }>();

    invoice.paid_amount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(aggregate?.total ?? '0.00'),
    );
    invoice.balance_amount = MoneyUtil.subtract(
      invoice.total_amount,
      invoice.paid_amount,
    );

    if (
      invoice.status !== InvoiceLifecycleStatus.VOID &&
      invoice.status !== InvoiceLifecycleStatus.REVERSED
    ) {
      if (MoneyUtil.compare(invoice.paid_amount, '0.00') === 0) {
        invoice.status = InvoiceLifecycleStatus.ISSUED;
      } else if (
        MoneyUtil.compare(invoice.balance_amount, '0.00') === 0
      ) {
        invoice.status = InvoiceLifecycleStatus.PAID;
      } else {
        invoice.status = InvoiceLifecycleStatus.PARTIALLY_PAID;
      }
    }

    await manager.getRepository(Invoice).save(invoice);
  }

  private async recalculateReceiptAllocationState(
    manager: EntityManager,
    companyId: string,
    receiptId: string,
  ) {
    const receipt = await manager.getRepository(Receipt).findOne({
      where: {
        id: receiptId,
        company_id: companyId,
      },
    });

    if (!receipt || receipt.status === ReceiptLifecycleStatus.REVERSED) {
      return;
    }

    const aggregate = await manager
      .getRepository(ReceiptAllocation)
      .createQueryBuilder('allocation')
      .select('COALESCE(SUM(allocation.amount), 0)', 'total')
      .where('allocation.company_id = :companyId', { companyId })
      .andWhere('allocation.receipt_id = :receiptId', { receiptId })
      .andWhere('allocation.status = :status', {
        status: ReceiptAllocationStatus.ACTIVE,
      })
      .getRawOne<{ total: string }>();

    const allocatedAmount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(aggregate?.total ?? '0.00'),
    );
    receipt.unallocated_amount = MoneyUtil.subtract(
      receipt.amount,
      allocatedAmount,
    );

    if (
      MoneyUtil.compare(receipt.unallocated_amount, receipt.amount) === 0
    ) {
      receipt.status = ReceiptLifecycleStatus.POSTED;
    } else if (
      MoneyUtil.compare(receipt.unallocated_amount, '0.00') === 0
    ) {
      receipt.status = ReceiptLifecycleStatus.ALLOCATED;
    } else {
      receipt.status = ReceiptLifecycleStatus.PARTIALLY_ALLOCATED;
    }

    await manager.getRepository(Receipt).save(receipt);
  }

  private async createReversalRecord(
    manager: EntityManager,
    params: {
      companyId: string;
      resourceType: string;
      resourceId: string;
      originalAmount: string;
      reversalAmount: string;
      currency: string;
      reason: string;
      userId: string;
    },
  ) {
    const reversalNo = await this.referenceService.next({
      companyId: params.companyId,
      documentType: 'FINANCIAL_REVERSAL',
      prefix: `REV-${new Date().getFullYear()}-`,
      manager,
    });

    return manager.getRepository(FinancialReversal).save(
      manager.getRepository(FinancialReversal).create({
        company_id: params.companyId,
        reversal_no: reversalNo,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        original_amount: params.originalAmount,
        reversal_amount: params.reversalAmount,
        currency: params.currency,
        reason: params.reason,
        created_by: params.userId,
        approved_by: params.userId,
        approved_at: new Date(),
        metadata: null,
      }),
    );
  }
}
