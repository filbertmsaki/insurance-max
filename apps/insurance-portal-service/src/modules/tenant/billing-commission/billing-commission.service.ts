import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  paginateQueryBuilder,
  type ListQueryOptions,
} from '@insurance-max/portal-shared/utils/paginate-query.util';
import {
  normalizeMoneyForStorage,
  normalizeRateForStorage,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Policy } from '../policies/entities/policy.entity';
import { ProductCommissionRule } from '../product-distribution/entities/product-commission-rule.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommissionPaymentDto } from './dto/create-commission-payment.dto';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import type { FinanceListQuery } from './dto/find-finance-records-query.dto';
import { UpdateCommissionPaymentDto } from './dto/update-commission-payment.dto';
import { UpdateCommissionTransactionDto } from './dto/update-commission-transaction.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { FinanceRefund } from './entities/finance-refund.entity';
import { FinanceJournalEntry } from './entities/finance-journal-entry.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { ReceiptAllocation } from './entities/receipt-allocation.entity';
import { Receipt } from './entities/receipt.entity';
import {
  InvoiceLifecycleStatus,
  ReceiptAllocationStatus,
  ReceiptLifecycleStatus,
} from './enums/finance-status.enums';

type NumericLike = number | string | null | undefined;

@Injectable()
export class BillingCommissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionTransactionRepository: Repository<CommissionTransaction>,
    @InjectRepository(CommissionPayment)
    private readonly commissionPaymentRepository: Repository<CommissionPayment>,
    @InjectRepository(CommissionPaymentItem)
    private readonly commissionPaymentItemRepository: Repository<CommissionPaymentItem>,
    @InjectRepository(FinanceRefund)
    private readonly financeRefundRepository: Repository<FinanceRefund>,
    @InjectRepository(FinanceJournalEntry)
    private readonly financeJournalEntryRepository: Repository<FinanceJournalEntry>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(ProductCommissionRule)
    private readonly commissionRuleRepository: Repository<ProductCommissionRule>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized.length ? normalized : null;
  }

  private normalizeMoney(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid numeric value');
    }
    return normalizeMoneyForStorage(num);
  }

  private normalizeRate(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid rate value');
    }
    return normalizeRateForStorage(num);
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date.toISOString();
  }

  private normalizeDateOnly(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date.toISOString().slice(0, 10);
  }

  private async ensureExists<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: Record<string, unknown>,
    message: string,
  ): Promise<T> {
    const entity = await repository.findOne({ where: where as any });
    if (!entity) {
      throw new BadRequestException(message);
    }
    return entity;
  }

  /** Status filter applied before paging so records and count share it. */
  private applyStatusFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    query: FinanceListQuery,
  ) {
    const status = query.status?.trim();
    if (status) {
      qb.andWhere(`UPPER(${alias}.status) = :status`, {
        status: status.toUpperCase(),
      });
    }
  }

  /**
   * Company scope must already be on qb. Returns the table contract
   * (pagination) plus the legacy meta block for older consumers.
   */
  private async paginateFinanceList<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: FinanceListQuery,
    options: ListQueryOptions,
  ) {
    const result = await paginateQueryBuilder(qb, query, options);
    const { page, limit, total, totalPages, hasNextPage, hasPreviousPage } =
      result.pagination;
    return {
      ...result,
      meta: {
        totalItems: total,
        itemCount: result.data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  private async nextSequence(
    repository: Repository<any>,
    companyId: string,
    column: string,
    prefix: string,
  ): Promise<string> {
    const last = await repository
      .createQueryBuilder('entity')
      .where(`entity.company_id = :companyId`, { companyId })
      .andWhere(`entity.${column} LIKE :prefix`, { prefix: `${prefix}%` })
      .orderBy(`entity.${column}`, 'DESC')
      .limit(1)
      .getOne();

    const current = last ? String(last[column] ?? '') : '';
    const next = current ? Number(current.substring(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async ensureInvoice(companyId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        company: true,
        insurer_company: true,
        intermediary_company: true,
        customer: true,
        quotation: true,
        policy: true,
        creator: true,
        updater: true,
        items: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async ensureReceipt(companyId: string, id: string): Promise<Receipt> {
    const receipt = await this.receiptRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        company: true,
        customer: true,
        invoice: true,
        receiver: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  private async ensurePaymentTransaction(
    companyId: string,
    id: string,
  ): Promise<PaymentTransaction> {
    const payment = await this.paymentTransactionRepository.findOne({
      where: { id, company_id: companyId },
      relations: { company: true, invoice: true, receipt: true },
    });
    if (!payment) throw new NotFoundException('Payment transaction not found');
    return payment;
  }

  private async ensureCommissionTransaction(
    companyId: string,
    id: string,
  ): Promise<CommissionTransaction> {
    const commission = await this.commissionTransactionRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        company: true,
        insurer_company: true,
        intermediary_company: true,
        invoice: true,
        receipt: true,
        commission_rule: true,
      },
    });
    if (!commission)
      throw new NotFoundException('Commission transaction not found');
    return commission;
  }

  private async ensureCommissionPayment(
    companyId: string,
    id: string,
  ): Promise<CommissionPayment> {
    const payment = await this.commissionPaymentRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        company: true,
        intermediary_company: true,
        approver: true,
        payer: true,
        items: true,
      },
    });
    if (!payment) throw new NotFoundException('Commission payment not found');
    return payment;
  }

  private async ensureRefund(
    companyId: string,
    id: string,
  ): Promise<FinanceRefund> {
    const refund = await this.financeRefundRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  private async ensureJournal(
    companyId: string,
    id: string,
  ): Promise<FinanceJournalEntry> {
    const journal = await this.financeJournalEntryRepository.findOne({
      where: { id, company_id: companyId },
      relations: { lines: true },
    });

    if (!journal) {
      throw new NotFoundException('Finance journal not found');
    }

    return journal;
  }

  private async recalculateInvoiceBalance(
    manager: any,
    companyId: string,
    invoiceId: string,
  ): Promise<void> {
    const allocationRepo = manager.getRepository(ReceiptAllocation);
    const invoiceRepo = manager.getRepository(Invoice);
    const aggregate = await allocationRepo
      .createQueryBuilder('allocation')
      .select('COALESCE(SUM(allocation.amount), 0)', 'total')
      .where('allocation.company_id = :companyId', { companyId })
      .andWhere('allocation.invoice_id = :invoiceId', { invoiceId })
      .andWhere('allocation.status = :status', {
        status: ReceiptAllocationStatus.ACTIVE,
      })
      .getRawOne();

    const paidAmount = this.normalizeMoney(aggregate?.total ?? 0);
    const invoice = await invoiceRepo.findOne({
      where: { id: invoiceId, company_id: companyId },
    });
    if (!invoice) {
      return;
    }
    invoice.paid_amount = paidAmount;
    invoice.balance_amount = this.normalizeMoney(
      Number(invoice.total_amount) - Number(paidAmount),
    );
    if (invoice.status !== InvoiceLifecycleStatus.DRAFT) {
      if (Number(invoice.paid_amount) <= 0) {
        invoice.status = InvoiceLifecycleStatus.ISSUED;
      } else if (Number(invoice.balance_amount) <= 0) {
        invoice.status = InvoiceLifecycleStatus.PAID;
      } else {
        invoice.status = InvoiceLifecycleStatus.PARTIALLY_PAID;
      }
    }
    await invoiceRepo.save(invoice);
  }

  private async syncInvoiceItems(
    manager: any,
    invoiceId: string,
    items: Array<{
      item_type: string;
      item_name: string;
      description?: string | null;
      quantity?: number | string | null;
      unit_amount?: number | string | null;
      total_amount?: number | string | null;
    }>,
  ): Promise<void> {
    const itemRepo = manager.getRepository(InvoiceItem);
    await itemRepo.delete({ invoice_id: invoiceId });
    if (!items.length) return;
    await itemRepo.save(
      items.map((item) =>
        itemRepo.create({
          invoice_id: invoiceId,
          item_type: item.item_type,
          item_name: item.item_name,
          description: item.description ?? null,
          quantity: this.normalizeMoney(item.quantity),
          unit_amount: this.normalizeMoney(item.unit_amount),
          total_amount: this.normalizeMoney(item.total_amount),
        }),
      ),
    );
  }

  private async syncCommissionPaymentItems(
    manager: any,
    commissionPaymentId: string,
    items: Array<{
      commission_transaction_id: string;
      amount?: number | string | null;
    }>,
    companyId: string,
  ): Promise<void> {
    const itemRepo = manager.getRepository(CommissionPaymentItem);

    if (items.length) {
      const transactionIds = Array.from(
        new Set(items.map((item) => item.commission_transaction_id)),
      );
      const owned = await manager.getRepository(CommissionTransaction).find({
        where: transactionIds.map((id) => ({ id, company_id: companyId })),
        select: { id: true },
      });
      if (owned.length !== transactionIds.length) {
        throw new NotFoundException(
          'One or more commission transactions were not found for this company',
        );
      }
    }

    await itemRepo.delete({ commission_payment_id: commissionPaymentId });
    if (!items.length) return;
    await itemRepo.save(
      items.map((item) =>
        itemRepo.create({
          commission_payment_id: commissionPaymentId,
          commission_transaction_id: item.commission_transaction_id,
          amount: this.normalizeMoney(item.amount),
        }),
      ),
    );
  }

  private async resolveInvoiceCustomerId(
    companyId: string,
    dto: CreateInvoiceDto | UpdateInvoiceDto,
  ): Promise<string> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    await this.ensureExists(
      this.companyRepository,
      { id: dto.insurer_company_id },
      'Insurer company not found',
    );

    if (dto.intermediary_company_id) {
      await this.ensureExists(
        this.companyRepository,
        { id: dto.intermediary_company_id },
        'Intermediary company not found',
      );
    }

    const directCustomerId = this.normalizeText(dto.customer_id);
    if (directCustomerId) {
      const directCustomer = await this.customerRepository.findOne({
        where: { id: directCustomerId, company_id: companyId },
      });

      if (directCustomer) {
        return directCustomer.id;
      }
    }

    if (dto.quotation_id) {
      const quotation = await this.quotationRepository.findOne({
        where: { id: dto.quotation_id, company_id: companyId },
        select: {
          id: true,
          customer_id: true,
        },
      });

      if (quotation?.customer_id) {
        const quotationCustomer = await this.customerRepository.findOne({
          where: { id: quotation.customer_id, company_id: companyId },
        });

        if (quotationCustomer) {
          return quotationCustomer.id;
        }
      }
    }

    throw new BadRequestException('Customer not found for company');
  }

  private async validateInvoiceScope(
    companyId: string,
    dto: CreateInvoiceDto | UpdateInvoiceDto,
  ): Promise<string> {
    const customerId = await this.resolveInvoiceCustomerId(companyId, dto);

    if (dto.quotation_id) {
      await this.ensureExists(
        this.quotationRepository,
        { id: dto.quotation_id, company_id: companyId },
        'Quotation not found for company',
      );
    }
    if (dto.policy_id) {
      await this.ensureExists(
        this.policyRepository,
        { id: dto.policy_id, company_id: companyId },
        'Policy not found for company',
      );
    }

    return customerId;
  }

  async createInvoice(
    companyId: string,
    dto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const customerId = await this.validateInvoiceScope(companyId, dto);
    return this.dataSource
      .transaction(async (manager) => {
        const invoiceRepo = manager.getRepository(Invoice);
        const invoiceNo = await this.nextSequence(
          invoiceRepo as any,
          companyId,
          'invoice_no',
          `INV-${new Date().getFullYear()}-`,
        );
        const items = dto.items ?? [];
        const itemTotal = items.reduce(
          (sum, item) => sum + Number(item.total_amount ?? 0),
          0,
        );
        const totalAmount = dto.total_amount ?? itemTotal;
        const invoice = invoiceRepo.create({
          company_id: companyId,
          insurer_company_id: dto.insurer_company_id,
          intermediary_company_id: dto.intermediary_company_id ?? null,
          customer_id: customerId,
          quotation_id: dto.quotation_id ?? null,
          policy_id: dto.policy_id ?? null,
          endorsement_id: dto.endorsement_id ?? null,
          cancellation_id: dto.cancellation_id ?? null,
          renewal_id: dto.renewal_id ?? null,
          invoice_no: invoiceNo,
          invoice_type: dto.invoice_type,
          currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
          gross_amount: this.normalizeMoney(dto.gross_amount ?? itemTotal),
          discount_amount: this.normalizeMoney(dto.discount_amount),
          tax_amount: this.normalizeMoney(dto.tax_amount),
          charges_amount: this.normalizeMoney(dto.charges_amount),
          total_amount: this.normalizeMoney(totalAmount),
          paid_amount: '0.00',
          balance_amount: this.normalizeMoney(totalAmount),
          status: InvoiceLifecycleStatus.DRAFT,
          due_date: this.normalizeDateOnly(dto.due_date),
          created_by: userId,
          updated_by: userId,
        });
        const saved = await invoiceRepo.save(invoice);
        await this.syncInvoiceItems(manager, saved.id, items);
        return manager.getRepository(Invoice).findOneOrFail({
          where: { id: saved.id, company_id: companyId },
          relations: {
            company: true,
            insurer_company: true,
            intermediary_company: true,
            customer: true,
            quotation: true,
            policy: true,
            creator: true,
            updater: true,
            items: true,
          },
        });
      })
      .catch((error) => {
        if (error instanceof ConflictException) {
          throw error;
        }
        throw error;
      });
  }

  async findInvoices(companyId: string, query: FinanceListQuery) {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.policy', 'policy')
      .leftJoinAndSelect('invoice.quotation', 'quotation')
      .where('invoice.company_id = :companyId', { companyId });
    if (query.quotation_id) {
      qb.andWhere('invoice.quotation_id = :quotationId', {
        quotationId: query.quotation_id,
      });
    }
    this.applyStatusFilter(qb, 'invoice', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        invoice_no: 'invoice.invoice_no',
        status: 'invoice.status',
        due_date: 'invoice.due_date',
        total_amount: 'invoice.total_amount',
        paid_amount: 'invoice.paid_amount',
        balance_amount: 'invoice.balance_amount',
        created_at: 'invoice.created_at',
        updated_at: 'invoice.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'invoice.invoice_no',
        'invoice.status',
        'customer.first_name',
        'customer.last_name',
        'customer.company_name',
        'quotation.quotation_no',
      ],
      tieBreaker: 'invoice.id',
    });
  }

  async findInvoice(companyId: string, id: string): Promise<Invoice> {
    return this.ensureInvoice(companyId, id);
  }

  async updateInvoice(
    companyId: string,
    id: string,
    dto: UpdateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.ensureInvoice(companyId, id);
    if (invoice.status !== InvoiceLifecycleStatus.DRAFT) {
      throw new ConflictException('Issued invoices cannot be directly edited');
    }
    const merged = { ...invoice, ...dto } as CreateInvoiceDto;
    const customerId = await this.validateInvoiceScope(companyId, merged);

    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      if (dto.insurer_company_id !== undefined)
        invoice.insurer_company_id = dto.insurer_company_id;
      if (dto.intermediary_company_id !== undefined)
        invoice.intermediary_company_id = dto.intermediary_company_id ?? null;
      if (dto.customer_id !== undefined) invoice.customer_id = customerId;
      if (dto.quotation_id !== undefined)
        invoice.quotation_id = dto.quotation_id ?? null;
      if (dto.policy_id !== undefined)
        invoice.policy_id = dto.policy_id ?? null;
      if (dto.endorsement_id !== undefined)
        invoice.endorsement_id = dto.endorsement_id ?? null;
      if (dto.cancellation_id !== undefined)
        invoice.cancellation_id = dto.cancellation_id ?? null;
      if (dto.renewal_id !== undefined)
        invoice.renewal_id = dto.renewal_id ?? null;
      if (dto.invoice_type !== undefined)
        invoice.invoice_type = dto.invoice_type;
      if (dto.currency !== undefined)
        invoice.currency = dto.currency.trim().toUpperCase();
      if (dto.gross_amount !== undefined)
        invoice.gross_amount = this.normalizeMoney(dto.gross_amount);
      if (dto.discount_amount !== undefined)
        invoice.discount_amount = this.normalizeMoney(dto.discount_amount);
      if (dto.tax_amount !== undefined)
        invoice.tax_amount = this.normalizeMoney(dto.tax_amount);
      if (dto.charges_amount !== undefined)
        invoice.charges_amount = this.normalizeMoney(dto.charges_amount);
      if (dto.total_amount !== undefined)
        invoice.total_amount = this.normalizeMoney(dto.total_amount);
      if (dto.due_date !== undefined)
        invoice.due_date = this.normalizeDateOnly(dto.due_date);
      invoice.paid_amount = '0.00';
      invoice.balance_amount = invoice.total_amount;
      invoice.status = InvoiceLifecycleStatus.DRAFT;
      invoice.updated_by = userId;
      const saved = await invoiceRepo.save(invoice);
      if (dto.items) {
        await this.syncInvoiceItems(manager, saved.id, dto.items);
      }
      return manager.getRepository(Invoice).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: {
          company: true,
          insurer_company: true,
          intermediary_company: true,
          customer: true,
          quotation: true,
          policy: true,
          creator: true,
          updater: true,
          items: true,
        },
      });
    });
  }

  async deleteInvoice(companyId: string, id: string): Promise<void> {
    const invoice = await this.ensureInvoice(companyId, id);
    if (invoice.status !== InvoiceLifecycleStatus.DRAFT) {
      throw new ConflictException(
        'Issued invoices must be voided instead of deleted',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(InvoiceItem)
        .delete({ invoice_id: invoice.id });
      await manager.getRepository(Invoice).softDelete(invoice.id);
    });
  }

  async createReceipt(
    companyId: string,
    dto: CreateReceiptDto,
    userId: string,
  ): Promise<Receipt> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    await this.ensureExists(
      this.customerRepository,
      { id: dto.customer_id, company_id: companyId },
      'Customer not found for company',
    );
    const invoice = dto.invoice_id
      ? await this.ensureInvoice(companyId, dto.invoice_id)
      : null;
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      const receiptNo = await this.nextSequence(
        receiptRepo as any,
        companyId,
        'receipt_no',
        `RCT-${new Date().getFullYear()}-`,
      );
      const receipt = receiptRepo.create({
        company_id: companyId,
        customer_id: dto.customer_id,
        invoice_id: invoice?.id ?? null,
        receipt_no: receiptNo,
        payment_method: dto.payment_method,
        amount: this.normalizeMoney(dto.amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
        unallocated_amount: '0.00',
        payment_reference: this.normalizeText(dto.payment_reference),
        received_by: dto.received_by ?? userId,
        received_at: dto.received_at ? new Date(dto.received_at) : new Date(),
        status: ReceiptLifecycleStatus.RECEIVED,
      });
      const saved = await receiptRepo.save(receipt);
      if (invoice?.id) {
        await this.recalculateInvoiceBalance(manager, companyId, invoice.id);
      }
      return manager.getRepository(Receipt).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: {
          company: true,
          customer: true,
          invoice: true,
          receiver: true,
        },
      });
    });
  }

  async findReceipts(companyId: string, query: FinanceListQuery) {
    const qb = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.customer', 'customer')
      .leftJoinAndSelect('receipt.invoice', 'invoice')
      .where('receipt.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'receipt', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        receipt_no: 'receipt.receipt_no',
        status: 'receipt.status',
        amount: 'receipt.amount',
        allocated_amount: 'receipt.allocated_amount',
        received_at: 'receipt.received_at',
        created_at: 'receipt.created_at',
        updated_at: 'receipt.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'receipt.receipt_no',
        'receipt.status',
        'receipt.payer_name',
        'receipt.payment_reference',
        'receipt.provider_reference',
        'customer.first_name',
        'customer.last_name',
        'customer.company_name',
      ],
      tieBreaker: 'receipt.id',
    });
  }

  async findReceipt(companyId: string, id: string): Promise<Receipt> {
    return this.ensureReceipt(companyId, id);
  }

  async updateReceipt(
    companyId: string,
    id: string,
    dto: UpdateReceiptDto,
    userId: string,
  ): Promise<Receipt> {
    const receipt = await this.ensureReceipt(companyId, id);
    if (receipt.status !== ReceiptLifecycleStatus.RECEIVED) {
      throw new ConflictException('Posted receipts cannot be directly edited');
    }
    const previousInvoiceId = receipt.invoice_id;
    if (dto.customer_id !== undefined) {
      await this.ensureExists(
        this.customerRepository,
        { id: dto.customer_id, company_id: companyId },
        'Customer not found for company',
      );
    }
    if (dto.invoice_id !== undefined) {
      if (dto.invoice_id) {
        await this.ensureInvoice(companyId, dto.invoice_id);
      }
    }
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      if (dto.customer_id !== undefined) receipt.customer_id = dto.customer_id;
      if (dto.invoice_id !== undefined) receipt.invoice_id = dto.invoice_id;
      if (dto.payment_method !== undefined)
        receipt.payment_method = dto.payment_method;
      if (dto.amount !== undefined)
        receipt.amount = this.normalizeMoney(dto.amount);
      if (dto.currency !== undefined)
        receipt.currency = dto.currency.trim().toUpperCase();
      if (dto.payment_reference !== undefined)
        receipt.payment_reference = this.normalizeText(dto.payment_reference);
      if (dto.received_by !== undefined)
        receipt.received_by = dto.received_by ?? null;
      if (dto.received_at !== undefined)
        receipt.received_at = dto.received_at
          ? new Date(dto.received_at)
          : null;
      if (dto.status !== undefined)
        receipt.status = dto.status.trim().toUpperCase();
      receipt.receiver =
        (await this.userRepository.findOne({
          where: { id: receipt.received_by ?? userId },
        })) ?? null;
      const saved = await receiptRepo.save(receipt);
      if (previousInvoiceId && previousInvoiceId !== receipt.invoice_id) {
        await this.recalculateInvoiceBalance(
          manager,
          companyId,
          previousInvoiceId,
        );
      }
      if (receipt.invoice_id) {
        await this.recalculateInvoiceBalance(
          manager,
          companyId,
          receipt.invoice_id,
        );
      }
      return manager.getRepository(Receipt).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: {
          company: true,
          customer: true,
          invoice: true,
          receiver: true,
        },
      });
    });
  }

  async deleteReceipt(companyId: string, id: string): Promise<void> {
    const receipt = await this.ensureReceipt(companyId, id);
    if (receipt.status !== ReceiptLifecycleStatus.RECEIVED) {
      throw new ConflictException(
        'Posted receipts must be reversed instead of deleted',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Receipt).softDelete(receipt.id);
      if (receipt.invoice_id) {
        await this.recalculateInvoiceBalance(
          manager,
          companyId,
          receipt.invoice_id,
        );
      }
    });
  }

  async createPaymentTransaction(
    companyId: string,
    dto: CreatePaymentTransactionDto,
  ): Promise<PaymentTransaction> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    if (dto.invoice_id) {
      await this.ensureInvoice(companyId, dto.invoice_id);
    }
    if (dto.receipt_id) {
      await this.ensureReceipt(companyId, dto.receipt_id);
    }
    const payment = this.paymentTransactionRepository.create({
      company_id: companyId,
      invoice_id: dto.invoice_id ?? null,
      receipt_id: dto.receipt_id ?? null,
      provider: dto.provider,
      provider_reference: dto.provider_reference,
      internal_reference: dto.internal_reference,
      amount: this.normalizeMoney(dto.amount),
      currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
      status: dto.status?.trim().toUpperCase() ?? 'PENDING',
      request_payload: dto.request_payload ?? null,
      response_payload: dto.response_payload ?? null,
    });
    return this.paymentTransactionRepository.save(payment);
  }

  async findPaymentTransactions(companyId: string, query: FinanceListQuery) {
    const qb = this.paymentTransactionRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('payment.receipt', 'receipt')
      .where('payment.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'payment', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        transaction_no: 'payment.transaction_no',
        provider: 'payment.provider_code',
        provider_code: 'payment.provider_code',
        payer_name: 'payment.payer_name',
        status: 'payment.status',
        amount: 'payment.amount',
        created_at: 'payment.created_at',
        updated_at: 'payment.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'payment.transaction_no',
        'payment.provider',
        'payment.provider_code',
        'payment.provider_reference',
        'payment.provider_transaction_id',
        'payment.internal_reference',
        'payment.payer_name',
        'payment.status',
      ],
      tieBreaker: 'payment.id',
    });
  }

  async findPaymentTransaction(
    companyId: string,
    id: string,
  ): Promise<PaymentTransaction> {
    return this.ensurePaymentTransaction(companyId, id);
  }

  async updatePaymentTransaction(
    companyId: string,
    id: string,
    dto: UpdatePaymentTransactionDto,
  ): Promise<PaymentTransaction> {
    const payment = await this.ensurePaymentTransaction(companyId, id);
    if (dto.invoice_id !== undefined) {
      if (dto.invoice_id) await this.ensureInvoice(companyId, dto.invoice_id);
      payment.invoice_id = dto.invoice_id ?? null;
    }
    if (dto.receipt_id !== undefined) {
      if (dto.receipt_id) await this.ensureReceipt(companyId, dto.receipt_id);
      payment.receipt_id = dto.receipt_id ?? null;
    }
    if (dto.provider !== undefined) payment.provider = dto.provider;
    if (dto.provider_reference !== undefined)
      payment.provider_reference = dto.provider_reference;
    if (dto.internal_reference !== undefined)
      payment.internal_reference = dto.internal_reference;
    if (dto.amount !== undefined)
      payment.amount = this.normalizeMoney(dto.amount);
    if (dto.currency !== undefined)
      payment.currency = dto.currency.trim().toUpperCase();
    if (dto.status !== undefined)
      payment.status = dto.status.trim().toUpperCase();
    if (dto.request_payload !== undefined)
      payment.request_payload = dto.request_payload ?? null;
    if (dto.response_payload !== undefined)
      payment.response_payload = dto.response_payload ?? null;
    return this.paymentTransactionRepository.save(payment);
  }

  async deletePaymentTransaction(companyId: string, id: string): Promise<void> {
    const payment = await this.ensurePaymentTransaction(companyId, id);
    await this.paymentTransactionRepository.softDelete(payment.id);
  }

  async findRefunds(companyId: string, query: FinanceListQuery) {
    const qb = this.financeRefundRepository
      .createQueryBuilder('refund')
      .where('refund.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'refund', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        refund_no: 'refund.refund_no',
        status: 'refund.status',
        amount: 'refund.amount',
        reason: 'refund.reason',
        requested_at: 'refund.requested_at',
        paid_at: 'refund.paid_at',
        created_at: 'refund.created_at',
        updated_at: 'refund.updated_at',
      },
      defaultSort: 'created_at',
      searchable: ['refund.refund_no', 'refund.status', 'refund.reason'],
      tieBreaker: 'refund.id',
    });
  }

  async findRefund(companyId: string, id: string): Promise<FinanceRefund> {
    return this.ensureRefund(companyId, id);
  }

  async findFinanceJournals(companyId: string, query: FinanceListQuery) {
    const qb = this.financeJournalEntryRepository
      .createQueryBuilder('journal')
      .leftJoinAndSelect('journal.lines', 'lines')
      .where('journal.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'journal', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        journal_no: 'journal.journal_no',
        journal_date: 'journal.journal_date',
        source_type: 'journal.source_type',
        status: 'journal.status',
        description: 'journal.description',
        created_at: 'journal.created_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'journal.journal_no',
        'journal.description',
        'journal.source_type',
        'journal.source_event_id',
      ],
      tieBreaker: 'journal.id',
    });
  }

  async findFinanceJournal(
    companyId: string,
    id: string,
  ): Promise<FinanceJournalEntry> {
    return this.ensureJournal(companyId, id);
  }

  async createCommissionTransaction(
    companyId: string,
    dto: CreateCommissionTransactionDto,
  ): Promise<CommissionTransaction> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    await this.ensureExists(
      this.companyRepository,
      { id: dto.insurer_company_id },
      'Insurer company not found',
    );
    await this.ensureExists(
      this.companyRepository,
      { id: dto.intermediary_company_id },
      'Intermediary company not found',
    );
    await this.ensureExists(
      this.policyRepository,
      { id: dto.policy_id, company_id: companyId },
      'Policy not found for company',
    );
    if (dto.invoice_id) await this.ensureInvoice(companyId, dto.invoice_id);
    if (dto.receipt_id) await this.ensureReceipt(companyId, dto.receipt_id);
    if (dto.commission_rule_id) {
      await this.ensureExists(
        this.commissionRuleRepository,
        { id: dto.commission_rule_id },
        'Commission rule not found',
      );
    }
    return this.commissionTransactionRepository.save(
      this.commissionTransactionRepository.create({
        company_id: companyId,
        insurer_company_id: dto.insurer_company_id,
        intermediary_company_id: dto.intermediary_company_id,
        policy_id: dto.policy_id,
        invoice_id: dto.invoice_id ?? null,
        receipt_id: dto.receipt_id ?? null,
        commission_rule_id: dto.commission_rule_id ?? null,
        commission_type: dto.commission_type,
        calculation_base: dto.calculation_base,
        gross_premium: this.normalizeMoney(dto.gross_premium),
        net_premium: this.normalizeMoney(dto.net_premium),
        commission_rate: this.normalizeRate(dto.commission_rate),
        commission_amount: this.normalizeMoney(dto.commission_amount),
        paid_amount: '0.0000',
        balance_amount: this.normalizeMoney(dto.commission_amount),
        status: dto.status?.trim().toUpperCase() ?? 'PENDING',
        earned_at: dto.earned_at ? new Date(dto.earned_at) : null,
        paid_at: dto.paid_at ? new Date(dto.paid_at) : null,
      }),
    );
  }

  async findCommissionTransactions(companyId: string, query: FinanceListQuery) {
    const qb = this.commissionTransactionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.policy', 'policy')
      .leftJoinAndSelect('commission.invoice', 'invoice')
      .leftJoinAndSelect('commission.receipt', 'receipt')
      .leftJoinAndSelect('commission.commission_rule', 'commissionRule')
      .where('commission.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'commission', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        accrual_no: 'commission.accrual_no',
        commission_type: 'commission.commission_type',
        status: 'commission.status',
        commission_amount: 'commission.commission_amount',
        paid_amount: 'commission.paid_amount',
        earned_at: 'commission.earned_at',
        paid_at: 'commission.paid_at',
        created_at: 'commission.created_at',
        updated_at: 'commission.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'commission.accrual_no',
        'commission.commission_type',
        'commission.status',
        'policy.policy_no',
      ],
      tieBreaker: 'commission.id',
    });
  }

  async findCommissionTransaction(
    companyId: string,
    id: string,
  ): Promise<CommissionTransaction> {
    return this.ensureCommissionTransaction(companyId, id);
  }

  async updateCommissionTransaction(
    companyId: string,
    id: string,
    dto: UpdateCommissionTransactionDto,
  ): Promise<CommissionTransaction> {
    const commission = await this.ensureCommissionTransaction(companyId, id);
    if (dto.insurer_company_id !== undefined) {
      await this.ensureExists(
        this.companyRepository,
        { id: dto.insurer_company_id },
        'Insurer company not found',
      );
      commission.insurer_company_id = dto.insurer_company_id;
    }
    if (dto.intermediary_company_id !== undefined) {
      await this.ensureExists(
        this.companyRepository,
        { id: dto.intermediary_company_id },
        'Intermediary company not found',
      );
      commission.intermediary_company_id = dto.intermediary_company_id;
    }
    if (dto.policy_id !== undefined) {
      await this.ensureExists(
        this.policyRepository,
        { id: dto.policy_id, company_id: companyId },
        'Policy not found for company',
      );
      commission.policy_id = dto.policy_id;
    }
    if (dto.invoice_id !== undefined) {
      if (dto.invoice_id) await this.ensureInvoice(companyId, dto.invoice_id);
      commission.invoice_id = dto.invoice_id ?? null;
    }
    if (dto.receipt_id !== undefined) {
      if (dto.receipt_id) await this.ensureReceipt(companyId, dto.receipt_id);
      commission.receipt_id = dto.receipt_id ?? null;
    }
    if (dto.commission_rule_id !== undefined) {
      if (dto.commission_rule_id) {
        await this.ensureExists(
          this.commissionRuleRepository,
          { id: dto.commission_rule_id },
          'Commission rule not found',
        );
      }
      commission.commission_rule_id = dto.commission_rule_id ?? null;
    }
    if (dto.commission_type !== undefined)
      commission.commission_type = dto.commission_type;
    if (dto.calculation_base !== undefined)
      commission.calculation_base = dto.calculation_base;
    if (dto.gross_premium !== undefined)
      commission.gross_premium = this.normalizeMoney(dto.gross_premium);
    if (dto.net_premium !== undefined)
      commission.net_premium = this.normalizeMoney(dto.net_premium);
    if (dto.commission_rate !== undefined)
      commission.commission_rate = this.normalizeRate(dto.commission_rate);
    if (dto.commission_amount !== undefined)
      commission.commission_amount = this.normalizeMoney(dto.commission_amount);
    commission.balance_amount = this.normalizeMoney(
      Number(commission.commission_amount) -
        Number(commission.paid_amount ?? 0),
    );
    if (dto.status !== undefined)
      commission.status = dto.status.trim().toUpperCase();
    if (dto.earned_at !== undefined)
      commission.earned_at = dto.earned_at ? new Date(dto.earned_at) : null;
    if (dto.paid_at !== undefined)
      commission.paid_at = dto.paid_at ? new Date(dto.paid_at) : null;
    return this.commissionTransactionRepository.save(commission);
  }

  async deleteCommissionTransaction(
    companyId: string,
    id: string,
  ): Promise<void> {
    const commission = await this.ensureCommissionTransaction(companyId, id);
    await this.commissionTransactionRepository.softDelete(commission.id);
  }

  async createCommissionPayment(
    companyId: string,
    dto: CreateCommissionPaymentDto,
    userId: string,
  ): Promise<CommissionPayment> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    await this.ensureExists(
      this.companyRepository,
      { id: dto.intermediary_company_id },
      'Intermediary company not found',
    );
    if (dto.approved_by)
      await this.ensureExists(
        this.userRepository,
        { id: dto.approved_by },
        'Approver not found',
      );
    if (dto.paid_by)
      await this.ensureExists(
        this.userRepository,
        { id: dto.paid_by },
        'Payer not found',
      );

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(CommissionPayment);
      const initialStatus = dto.status?.trim().toUpperCase() ?? 'PENDING';
      const payment = paymentRepo.create({
        company_id: companyId,
        intermediary_company_id: dto.intermediary_company_id,
        payment_no: dto.payment_no,
        payment_method: dto.payment_method,
        payment_reference: this.normalizeText(dto.payment_reference),
        total_amount: this.normalizeMoney(dto.total_amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
        status: initialStatus,
        approved_by: dto.approved_by ?? null,
        approved_at:
          initialStatus === 'APPROVED' || initialStatus === 'PAID'
            ? new Date()
            : null,
        paid_by: dto.paid_by ?? userId,
        paid_at: initialStatus === 'PAID' ? new Date() : null,
      });
      const saved = await paymentRepo.save(payment);
      await this.syncCommissionPaymentItems(
        manager,
        saved.id,
        dto.items ?? [],
        companyId,
      );
      return manager.getRepository(CommissionPayment).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: {
          company: true,
          intermediary_company: true,
          approver: true,
          payer: true,
          items: true,
        },
      });
    });
  }

  async findCommissionPayments(companyId: string, query: FinanceListQuery) {
    const qb = this.commissionPaymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.intermediary_company', 'intermediaryCompany')
      .leftJoinAndSelect('payment.items', 'items')
      .where('payment.company_id = :companyId', { companyId });
    this.applyStatusFilter(qb, 'payment', query);
    return this.paginateFinanceList(qb, query, {
      sortable: {
        payment_no: 'payment.payment_no',
        status: 'payment.status',
        total_amount: 'payment.total_amount',
        allocated_amount: 'payment.allocated_amount',
        paid_at: 'payment.paid_at',
        created_at: 'payment.created_at',
        updated_at: 'payment.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'payment.payment_no',
        'payment.status',
        'payment.payment_method',
        'payment.payment_reference',
      ],
      tieBreaker: 'payment.id',
    });
  }

  async findCommissionPayment(
    companyId: string,
    id: string,
  ): Promise<CommissionPayment> {
    return this.ensureCommissionPayment(companyId, id);
  }

  async updateCommissionPayment(
    companyId: string,
    id: string,
    dto: UpdateCommissionPaymentDto,
  ): Promise<CommissionPayment> {
    const payment = await this.ensureCommissionPayment(companyId, id);
    if (dto.intermediary_company_id !== undefined) {
      await this.ensureExists(
        this.companyRepository,
        { id: dto.intermediary_company_id },
        'Intermediary company not found',
      );
      payment.intermediary_company_id = dto.intermediary_company_id;
    }
    if (dto.payment_no !== undefined) payment.payment_no = dto.payment_no;
    if (dto.payment_method !== undefined)
      payment.payment_method = dto.payment_method;
    if (dto.payment_reference !== undefined)
      payment.payment_reference = this.normalizeText(dto.payment_reference);
    if (dto.total_amount !== undefined)
      payment.total_amount = this.normalizeMoney(dto.total_amount);
    if (dto.currency !== undefined)
      payment.currency = dto.currency.trim().toUpperCase();
    if (dto.status !== undefined) {
      const newStatus = dto.status.trim().toUpperCase();
      if (newStatus !== payment.status) {
        if (
          (newStatus === 'APPROVED' || newStatus === 'PAID') &&
          !payment.approved_at
        ) {
          payment.approved_at = new Date();
        }
        if (newStatus === 'PAID' && !payment.paid_at) {
          payment.paid_at = new Date();
        }
      }
      payment.status = newStatus;
    }
    if (dto.approved_by !== undefined)
      payment.approved_by = dto.approved_by ?? null;
    if (dto.paid_by !== undefined) payment.paid_by = dto.paid_by ?? null;
    if (dto.items) {
      return this.dataSource.transaction(async (manager) => {
        const saved = await manager
          .getRepository(CommissionPayment)
          .save(payment);
        await this.syncCommissionPaymentItems(
          manager,
          saved.id,
          dto.items ?? [],
          companyId,
        );
        return manager.getRepository(CommissionPayment).findOneOrFail({
          where: { id: saved.id, company_id: companyId },
          relations: {
            company: true,
            intermediary_company: true,
            approver: true,
            payer: true,
            items: true,
          },
        });
      });
    }
    return this.commissionPaymentRepository.save(payment);
  }

  async deleteCommissionPayment(companyId: string, id: string): Promise<void> {
    const payment = await this.ensureCommissionPayment(companyId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(CommissionPaymentItem)
        .delete({ commission_payment_id: payment.id });
      await manager.getRepository(CommissionPayment).softDelete(payment.id);
    });
  }
}
