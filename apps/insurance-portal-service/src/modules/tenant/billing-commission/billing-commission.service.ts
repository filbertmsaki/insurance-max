import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
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
import { FilterBillingDto } from './dto/filter-billing.dto';
import { UpdateCommissionPaymentDto } from './dto/update-commission-payment.dto';
import { UpdateCommissionTransactionDto } from './dto/update-commission-transaction.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Receipt } from './entities/receipt.entity';

type NumericLike = number | string | null | undefined;

@Injectable()
export class BillingCommissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Receipt) private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionTransactionRepository: Repository<CommissionTransaction>,
    @InjectRepository(CommissionPayment)
    private readonly commissionPaymentRepository: Repository<CommissionPayment>,
    @InjectRepository(CommissionPaymentItem)
    private readonly commissionPaymentItemRepository: Repository<CommissionPaymentItem>,
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Quotation) private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Policy) private readonly policyRepository: Repository<Policy>,
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
    const num = value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid numeric value');
    }
    return String(Math.round(num * 100) / 100);
  }

  private normalizeRate(value: NumericLike): string {
    const num = value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid rate value');
    }
    return String(Math.round(num * 1000000) / 1000000);
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

  private paginate<T>(items: T[], total: number, page: number, limit: number) {
    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
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

    const current = last ? String((last as any)[column] ?? '') : '';
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
      relations: { company: true, customer: true, invoice: true, receiver: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  private async ensurePaymentTransaction(companyId: string, id: string): Promise<PaymentTransaction> {
    const payment = await this.paymentTransactionRepository.findOne({
      where: { id, company_id: companyId },
      relations: { company: true, invoice: true, receipt: true },
    });
    if (!payment) throw new NotFoundException('Payment transaction not found');
    return payment;
  }

  private async ensureCommissionTransaction(companyId: string, id: string): Promise<CommissionTransaction> {
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
    if (!commission) throw new NotFoundException('Commission transaction not found');
    return commission;
  }

  private async ensureCommissionPayment(companyId: string, id: string): Promise<CommissionPayment> {
    const payment = await this.commissionPaymentRepository.findOne({
      where: { id, company_id: companyId },
      relations: { company: true, intermediary_company: true, approver: true, payer: true, items: true },
    });
    if (!payment) throw new NotFoundException('Commission payment not found');
    return payment;
  }

  private async recalculateInvoiceBalance(manager: any, companyId: string, invoiceId: string): Promise<void> {
    const receiptRepo = manager.getRepository(Receipt);
    const invoiceRepo = manager.getRepository(Invoice);
    const aggregate = await receiptRepo
      .createQueryBuilder('receipt')
      .select('COALESCE(SUM(receipt.amount), 0)', 'total')
      .where('receipt.company_id = :companyId', { companyId })
      .andWhere('receipt.invoice_id = :invoiceId', { invoiceId })
      .andWhere('receipt.deleted_at IS NULL')
      .getRawOne();

    const paidAmount = this.normalizeMoney(aggregate?.total ?? 0);
    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId, company_id: companyId } });
    if (!invoice) {
      return;
    }
    invoice.paid_amount = paidAmount;
    invoice.balance_amount = this.normalizeMoney(Number(invoice.total_amount) - Number(paidAmount));
    await invoiceRepo.save(invoice);
  }

  private async syncInvoiceItems(manager: any, invoiceId: string, items: Array<{ item_type: string; item_name: string; description?: string | null; quantity?: number | string | null; unit_amount?: number | string | null; total_amount?: number | string | null; }>): Promise<void> {
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
    items: Array<{ commission_transaction_id: string; amount?: number | string | null }>,
  ): Promise<void> {
    const itemRepo = manager.getRepository(CommissionPaymentItem);
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

  private async validateInvoiceScope(companyId: string, dto: CreateInvoiceDto | UpdateInvoiceDto): Promise<void> {
    await this.ensureExists(this.companyRepository, { id: companyId }, 'Company not found');
    await this.ensureExists(this.companyRepository, { id: dto.insurer_company_id }, 'Insurer company not found');

    if (dto.intermediary_company_id) {
      await this.ensureExists(this.companyRepository, { id: dto.intermediary_company_id }, 'Intermediary company not found');
    }
    await this.ensureExists(this.customerRepository, { id: dto.customer_id, company_id: companyId }, 'Customer not found for company');

    if (dto.quotation_id) {
      await this.ensureExists(this.quotationRepository, { id: dto.quotation_id, company_id: companyId }, 'Quotation not found for company');
    }
    if (dto.policy_id) {
      await this.ensureExists(this.policyRepository, { id: dto.policy_id, company_id: companyId }, 'Policy not found for company');
    }
  }

  async createInvoice(companyId: string, dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    await this.validateInvoiceScope(companyId, dto);
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const invoiceNo = await this.nextSequence(invoiceRepo as any, companyId, 'invoice_no', `INV-${new Date().getFullYear()}-`);
      const items = dto.items ?? [];
      const itemTotal = items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
      const totalAmount = dto.total_amount ?? itemTotal;
      const invoice = invoiceRepo.create({
        company_id: companyId,
        insurer_company_id: dto.insurer_company_id,
        intermediary_company_id: dto.intermediary_company_id ?? null,
        customer_id: dto.customer_id,
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
        paid_amount: this.normalizeMoney(dto.paid_amount),
        balance_amount: this.normalizeMoney(
          dto.balance_amount ?? Number(totalAmount) - Number(dto.paid_amount ?? 0),
        ),
        status: dto.status?.trim().toUpperCase() ?? 'DRAFT',
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
    }).catch((error) => {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw error;
    });
  }

  async findInvoices(companyId: string, query: FilterBillingDto) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = SortDirection.DESC, search } = query;
    const allowedSortFields = ['invoice_no', 'status', 'due_date', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.policy', 'policy')
      .leftJoinAndSelect('invoice.quotation', 'quotation')
      .where('invoice.company_id = :companyId', { companyId })
      .orderBy(`invoice.${safeSortBy}`, direction);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(invoice.invoice_no ILIKE :term OR invoice.status ILIKE :term OR customer.first_name ILIKE :term OR customer.last_name ILIKE :term OR customer.company_name ILIKE :term)', { term });
    }
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.paginate(items, total, page, limit);
  }

  async findInvoice(companyId: string, id: string): Promise<Invoice> {
    return this.ensureInvoice(companyId, id);
  }

  async updateInvoice(companyId: string, id: string, dto: UpdateInvoiceDto, userId: string): Promise<Invoice> {
    const invoice = await this.ensureInvoice(companyId, id);
    const merged = { ...invoice, ...dto } as CreateInvoiceDto;
    await this.validateInvoiceScope(companyId, merged);

    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      if (dto.insurer_company_id !== undefined) invoice.insurer_company_id = dto.insurer_company_id;
      if (dto.intermediary_company_id !== undefined) invoice.intermediary_company_id = dto.intermediary_company_id ?? null;
      if (dto.customer_id !== undefined) invoice.customer_id = dto.customer_id;
      if (dto.quotation_id !== undefined) invoice.quotation_id = dto.quotation_id ?? null;
      if (dto.policy_id !== undefined) invoice.policy_id = dto.policy_id ?? null;
      if (dto.endorsement_id !== undefined) invoice.endorsement_id = dto.endorsement_id ?? null;
      if (dto.cancellation_id !== undefined) invoice.cancellation_id = dto.cancellation_id ?? null;
      if (dto.renewal_id !== undefined) invoice.renewal_id = dto.renewal_id ?? null;
      if (dto.invoice_type !== undefined) invoice.invoice_type = dto.invoice_type;
      if (dto.currency !== undefined) invoice.currency = dto.currency.trim().toUpperCase();
      if (dto.gross_amount !== undefined) invoice.gross_amount = this.normalizeMoney(dto.gross_amount);
      if (dto.discount_amount !== undefined) invoice.discount_amount = this.normalizeMoney(dto.discount_amount);
      if (dto.tax_amount !== undefined) invoice.tax_amount = this.normalizeMoney(dto.tax_amount);
      if (dto.charges_amount !== undefined) invoice.charges_amount = this.normalizeMoney(dto.charges_amount);
      if (dto.total_amount !== undefined) invoice.total_amount = this.normalizeMoney(dto.total_amount);
      if (dto.paid_amount !== undefined) invoice.paid_amount = this.normalizeMoney(dto.paid_amount);
      if (dto.balance_amount !== undefined) invoice.balance_amount = this.normalizeMoney(dto.balance_amount);
      if (dto.status !== undefined) invoice.status = dto.status.trim().toUpperCase();
      if (dto.due_date !== undefined) invoice.due_date = this.normalizeDateOnly(dto.due_date);
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
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(InvoiceItem).delete({ invoice_id: invoice.id });
      await manager.getRepository(Invoice).softDelete(invoice.id);
    });
  }

  async createReceipt(companyId: string, dto: CreateReceiptDto, userId: string): Promise<Receipt> {
    await this.ensureExists(this.companyRepository, { id: companyId }, 'Company not found');
    await this.ensureExists(this.customerRepository, { id: dto.customer_id, company_id: companyId }, 'Customer not found for company');
    const invoice = await this.ensureInvoice(companyId, dto.invoice_id);
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      const receiptNo = await this.nextSequence(receiptRepo as any, companyId, 'receipt_no', `RCT-${new Date().getFullYear()}-`);
      const receipt = receiptRepo.create({
        company_id: companyId,
        customer_id: dto.customer_id,
        invoice_id: invoice.id,
        receipt_no: receiptNo,
        payment_method: dto.payment_method,
        amount: this.normalizeMoney(dto.amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
        payment_reference: this.normalizeText(dto.payment_reference),
        received_by: dto.received_by ?? userId,
        received_at: dto.received_at ? new Date(dto.received_at) : new Date(),
        status: dto.status?.trim().toUpperCase() ?? 'RECEIVED',
      });
      const saved = await receiptRepo.save(receipt);
      await this.recalculateInvoiceBalance(manager, companyId, invoice.id);
      return manager.getRepository(Receipt).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: { company: true, customer: true, invoice: true, receiver: true },
      });
    });
  }

  async findReceipts(companyId: string, query: FilterBillingDto) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = SortDirection.DESC, search } = query;
    const allowedSortFields = ['receipt_no', 'status', 'received_at', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const qb = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.customer', 'customer')
      .leftJoinAndSelect('receipt.invoice', 'invoice')
      .where('receipt.company_id = :companyId', { companyId })
      .orderBy(`receipt.${safeSortBy}`, direction);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(receipt.receipt_no ILIKE :term OR receipt.status ILIKE :term OR customer.first_name ILIKE :term OR customer.last_name ILIKE :term OR customer.company_name ILIKE :term)', { term });
    }
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.paginate(items, total, page, limit);
  }

  async findReceipt(companyId: string, id: string): Promise<Receipt> {
    return this.ensureReceipt(companyId, id);
  }

  async updateReceipt(companyId: string, id: string, dto: UpdateReceiptDto, userId: string): Promise<Receipt> {
    const receipt = await this.ensureReceipt(companyId, id);
    const previousInvoiceId = receipt.invoice_id;
    if (dto.customer_id !== undefined) {
      await this.ensureExists(this.customerRepository, { id: dto.customer_id, company_id: companyId }, 'Customer not found for company');
    }
    if (dto.invoice_id !== undefined) {
      await this.ensureInvoice(companyId, dto.invoice_id);
    }
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      if (dto.customer_id !== undefined) receipt.customer_id = dto.customer_id;
      if (dto.invoice_id !== undefined) receipt.invoice_id = dto.invoice_id;
      if (dto.payment_method !== undefined) receipt.payment_method = dto.payment_method;
      if (dto.amount !== undefined) receipt.amount = this.normalizeMoney(dto.amount);
      if (dto.currency !== undefined) receipt.currency = dto.currency.trim().toUpperCase();
      if (dto.payment_reference !== undefined) receipt.payment_reference = this.normalizeText(dto.payment_reference);
      if (dto.received_by !== undefined) receipt.received_by = dto.received_by ?? null;
      if (dto.received_at !== undefined) receipt.received_at = dto.received_at ? new Date(dto.received_at) : null;
      if (dto.status !== undefined) receipt.status = dto.status.trim().toUpperCase();
      receipt.receiver = await this.userRepository.findOne({ where: { id: receipt.received_by ?? userId } }) ?? null;
      const saved = await receiptRepo.save(receipt);
      if (previousInvoiceId && previousInvoiceId !== receipt.invoice_id) {
        await this.recalculateInvoiceBalance(manager, companyId, previousInvoiceId);
      }
      if (receipt.invoice_id) {
        await this.recalculateInvoiceBalance(manager, companyId, receipt.invoice_id);
      }
      return manager.getRepository(Receipt).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: { company: true, customer: true, invoice: true, receiver: true },
      });
    });
  }

  async deleteReceipt(companyId: string, id: string): Promise<void> {
    const receipt = await this.ensureReceipt(companyId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Receipt).softDelete(receipt.id);
      if (receipt.invoice_id) {
        await this.recalculateInvoiceBalance(manager, companyId, receipt.invoice_id);
      }
    });
  }

  async createPaymentTransaction(
    companyId: string,
    dto: CreatePaymentTransactionDto,
  ): Promise<PaymentTransaction> {
    await this.ensureExists(this.companyRepository, { id: companyId }, 'Company not found');
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

  async findPaymentTransactions(companyId: string, query: FilterBillingDto) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = SortDirection.DESC, search } = query;
    const allowedSortFields = ['provider', 'status', 'amount', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const qb = this.paymentTransactionRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('payment.receipt', 'receipt')
      .where('payment.company_id = :companyId', { companyId })
      .orderBy(`payment.${safeSortBy}`, direction);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(payment.provider ILIKE :term OR payment.provider_reference ILIKE :term OR payment.internal_reference ILIKE :term OR payment.status ILIKE :term)', { term });
    }
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.paginate(items, total, page, limit);
  }

  async findPaymentTransaction(companyId: string, id: string): Promise<PaymentTransaction> {
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
    if (dto.provider_reference !== undefined) payment.provider_reference = dto.provider_reference;
    if (dto.internal_reference !== undefined) payment.internal_reference = dto.internal_reference;
    if (dto.amount !== undefined) payment.amount = this.normalizeMoney(dto.amount);
    if (dto.currency !== undefined) payment.currency = dto.currency.trim().toUpperCase();
    if (dto.status !== undefined) payment.status = dto.status.trim().toUpperCase();
    if (dto.request_payload !== undefined) payment.request_payload = dto.request_payload ?? null;
    if (dto.response_payload !== undefined) payment.response_payload = dto.response_payload ?? null;
    return this.paymentTransactionRepository.save(payment);
  }

  async deletePaymentTransaction(companyId: string, id: string): Promise<void> {
    const payment = await this.ensurePaymentTransaction(companyId, id);
    await this.paymentTransactionRepository.remove(payment);
  }

  async createCommissionTransaction(
    companyId: string,
    dto: CreateCommissionTransactionDto,
  ): Promise<CommissionTransaction> {
    await this.ensureExists(this.companyRepository, { id: companyId }, 'Company not found');
    await this.ensureExists(this.companyRepository, { id: dto.insurer_company_id }, 'Insurer company not found');
    await this.ensureExists(this.companyRepository, { id: dto.intermediary_company_id }, 'Intermediary company not found');
    await this.ensureExists(this.policyRepository, { id: dto.policy_id, company_id: companyId }, 'Policy not found for company');
    if (dto.invoice_id) await this.ensureInvoice(companyId, dto.invoice_id);
    if (dto.receipt_id) await this.ensureReceipt(companyId, dto.receipt_id);
    if (dto.commission_rule_id) {
      await this.ensureExists(this.commissionRuleRepository, { id: dto.commission_rule_id }, 'Commission rule not found');
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
        status: dto.status?.trim().toUpperCase() ?? 'PENDING',
        earned_at: dto.earned_at ? new Date(dto.earned_at) : null,
        paid_at: dto.paid_at ? new Date(dto.paid_at) : null,
      }),
    );
  }

  async findCommissionTransactions(companyId: string, query: FilterBillingDto) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = SortDirection.DESC, search } = query;
    const allowedSortFields = ['commission_type', 'status', 'earned_at', 'paid_at', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const qb = this.commissionTransactionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.policy', 'policy')
      .leftJoinAndSelect('commission.invoice', 'invoice')
      .leftJoinAndSelect('commission.receipt', 'receipt')
      .leftJoinAndSelect('commission.commission_rule', 'commissionRule')
      .where('commission.company_id = :companyId', { companyId })
      .orderBy(`commission.${safeSortBy}`, direction);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(commission.commission_type ILIKE :term OR commission.status ILIKE :term)', { term });
    }
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.paginate(items, total, page, limit);
  }

  async findCommissionTransaction(companyId: string, id: string): Promise<CommissionTransaction> {
    return this.ensureCommissionTransaction(companyId, id);
  }

  async updateCommissionTransaction(
    companyId: string,
    id: string,
    dto: UpdateCommissionTransactionDto,
  ): Promise<CommissionTransaction> {
    const commission = await this.ensureCommissionTransaction(companyId, id);
    if (dto.insurer_company_id !== undefined) {
      await this.ensureExists(this.companyRepository, { id: dto.insurer_company_id }, 'Insurer company not found');
      commission.insurer_company_id = dto.insurer_company_id;
    }
    if (dto.intermediary_company_id !== undefined) {
      await this.ensureExists(this.companyRepository, { id: dto.intermediary_company_id }, 'Intermediary company not found');
      commission.intermediary_company_id = dto.intermediary_company_id;
    }
    if (dto.policy_id !== undefined) {
      await this.ensureExists(this.policyRepository, { id: dto.policy_id, company_id: companyId }, 'Policy not found for company');
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
        await this.ensureExists(this.commissionRuleRepository, { id: dto.commission_rule_id }, 'Commission rule not found');
      }
      commission.commission_rule_id = dto.commission_rule_id ?? null;
    }
    if (dto.commission_type !== undefined) commission.commission_type = dto.commission_type;
    if (dto.calculation_base !== undefined) commission.calculation_base = dto.calculation_base;
    if (dto.gross_premium !== undefined) commission.gross_premium = this.normalizeMoney(dto.gross_premium);
    if (dto.net_premium !== undefined) commission.net_premium = this.normalizeMoney(dto.net_premium);
    if (dto.commission_rate !== undefined) commission.commission_rate = this.normalizeRate(dto.commission_rate);
    if (dto.commission_amount !== undefined) commission.commission_amount = this.normalizeMoney(dto.commission_amount);
    if (dto.status !== undefined) commission.status = dto.status.trim().toUpperCase();
    if (dto.earned_at !== undefined) commission.earned_at = dto.earned_at ? new Date(dto.earned_at) : null;
    if (dto.paid_at !== undefined) commission.paid_at = dto.paid_at ? new Date(dto.paid_at) : null;
    return this.commissionTransactionRepository.save(commission);
  }

  async deleteCommissionTransaction(companyId: string, id: string): Promise<void> {
    const commission = await this.ensureCommissionTransaction(companyId, id);
    await this.commissionTransactionRepository.softDelete(commission.id);
  }

  async createCommissionPayment(
    companyId: string,
    dto: CreateCommissionPaymentDto,
    userId: string,
  ): Promise<CommissionPayment> {
    await this.ensureExists(this.companyRepository, { id: companyId }, 'Company not found');
    await this.ensureExists(this.companyRepository, { id: dto.intermediary_company_id }, 'Intermediary company not found');
    if (dto.approved_by) await this.ensureExists(this.userRepository, { id: dto.approved_by }, 'Approver not found');
    if (dto.paid_by) await this.ensureExists(this.userRepository, { id: dto.paid_by }, 'Payer not found');

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(CommissionPayment);
      const payment = paymentRepo.create({
        company_id: companyId,
        intermediary_company_id: dto.intermediary_company_id,
        payment_no: dto.payment_no,
        payment_method: dto.payment_method,
        payment_reference: this.normalizeText(dto.payment_reference),
        total_amount: this.normalizeMoney(dto.total_amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
        status: dto.status?.trim().toUpperCase() ?? 'PENDING',
        approved_by: dto.approved_by ?? null,
        approved_at: null,
        paid_by: dto.paid_by ?? userId,
        paid_at: null,
      });
      const saved = await paymentRepo.save(payment);
      await this.syncCommissionPaymentItems(manager, saved.id, dto.items ?? []);
      return manager.getRepository(CommissionPayment).findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: { company: true, intermediary_company: true, approver: true, payer: true, items: true },
      });
    });
  }

  async findCommissionPayments(companyId: string, query: FilterBillingDto) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = SortDirection.DESC, search } = query;
    const allowedSortFields = ['payment_no', 'status', 'paid_at', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';
    const qb = this.commissionPaymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.intermediary_company', 'intermediaryCompany')
      .leftJoinAndSelect('payment.items', 'items')
      .where('payment.company_id = :companyId', { companyId })
      .orderBy(`payment.${safeSortBy}`, direction);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(payment.payment_no ILIKE :term OR payment.status ILIKE :term OR payment.payment_method ILIKE :term)', { term });
    }
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.paginate(items, total, page, limit);
  }

  async findCommissionPayment(companyId: string, id: string): Promise<CommissionPayment> {
    return this.ensureCommissionPayment(companyId, id);
  }

  async updateCommissionPayment(
    companyId: string,
    id: string,
    dto: UpdateCommissionPaymentDto,
  ): Promise<CommissionPayment> {
    const payment = await this.ensureCommissionPayment(companyId, id);
    if (dto.intermediary_company_id !== undefined) {
      await this.ensureExists(this.companyRepository, { id: dto.intermediary_company_id }, 'Intermediary company not found');
      payment.intermediary_company_id = dto.intermediary_company_id;
    }
    if (dto.payment_no !== undefined) payment.payment_no = dto.payment_no;
    if (dto.payment_method !== undefined) payment.payment_method = dto.payment_method;
    if (dto.payment_reference !== undefined) payment.payment_reference = this.normalizeText(dto.payment_reference);
    if (dto.total_amount !== undefined) payment.total_amount = this.normalizeMoney(dto.total_amount);
    if (dto.currency !== undefined) payment.currency = dto.currency.trim().toUpperCase();
    if (dto.status !== undefined) payment.status = dto.status.trim().toUpperCase();
    if (dto.approved_by !== undefined) payment.approved_by = dto.approved_by ?? null;
    if (dto.paid_by !== undefined) payment.paid_by = dto.paid_by ?? null;
    if (dto.items) {
      return this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(CommissionPayment).save(payment);
        await this.syncCommissionPaymentItems(manager, saved.id, dto.items ?? []);
        return manager.getRepository(CommissionPayment).findOneOrFail({
          where: { id: saved.id, company_id: companyId },
          relations: { company: true, intermediary_company: true, approver: true, payer: true, items: true },
        });
      });
    }
    return this.commissionPaymentRepository.save(payment);
  }

  async deleteCommissionPayment(companyId: string, id: string): Promise<void> {
    const payment = await this.ensureCommissionPayment(companyId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CommissionPaymentItem).delete({ commission_payment_id: payment.id });
      await manager.getRepository(CommissionPayment).softDelete(payment.id);
    });
  }
}
