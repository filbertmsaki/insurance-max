import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { InvoiceStatus, PaymentMethod } from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Invoice } from '../entities/invoice.entity';
import { PaymentReference } from '../entities/payment-reference.entity';
import {
  CreatePaymentReferenceDto,
  PaymentChannel,
  PaymentReferenceStatus,
} from '../dto/payment-reference.dto';

const ACTIVE_REFERENCE_STATUSES = [
  PaymentReferenceStatus.PENDING,
  PaymentReferenceStatus.ACTIVE,
] as const;
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
];

@Injectable()
export class PaymentReferenceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hashService: ProductDefinitionHashService,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentReference)
    private readonly referenceRepository: Repository<PaymentReference>,
  ) {}

  listForInvoice(user: AuthenticatedUser, invoiceId: string) {
    return this.referenceRepository.find({
      where: {
        company_id: user.companyId!,
        invoice_id: invoiceId,
      },
      order: { created_at: 'DESC' },
    });
  }

  async createOrReuse(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: CreatePaymentReferenceDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager
        .getRepository(Invoice)
        .createQueryBuilder('invoice')
        .setLock('pessimistic_write')
        .where('invoice.id = :invoiceId', { invoiceId })
        .andWhere('invoice.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (!OPEN_INVOICE_STATUSES.includes(invoice.status as InvoiceStatus)) {
        throw new BadRequestException(
          'Payment reference can only be created for an issued open invoice.',
        );
      }

      if (DecimalUtil.value(invoice.balance_amount).lessThanOrEqualTo(0)) {
        throw new BadRequestException('Invoice does not have an open balance.');
      }

      const method = dto.method.trim().toUpperCase() as PaymentMethod;
      const provider = this.resolveProvider(method, dto.provider);
      const channel = this.resolveChannel(method, dto.channel);
      const referenceRepo = manager.getRepository(PaymentReference);
      const now = new Date();

      const existing = await referenceRepo.findOne({
        where: {
          company_id: user.companyId!,
          invoice_id: invoice.id,
          method,
          provider,
          status: In([...ACTIVE_REFERENCE_STATUSES]),
        },
        order: { created_at: 'DESC' },
      });

      if (existing && !this.isExpired(existing, now)) {
        return existing;
      }

      if (existing && this.isExpired(existing, now)) {
        existing.status = PaymentReferenceStatus.EXPIRED;
        existing.updated_by = user.id;
        await referenceRepo.save(existing);
      }

      const providerReference = await this.generateProviderReference(
        invoice,
        method,
        provider,
        dto.metadata,
      );
      const controlNumber =
        method === 'CONTROL_NUMBER'
          ? await this.generateControlNumber(user.companyId!, invoice, manager)
          : null;
      const expiresAt = this.calculateExpiry(method);

      return referenceRepo.save(
        referenceRepo.create({
          company_id: user.companyId!,
          invoice_id: invoice.id,
          provider,
          method,
          channel,
          control_number: controlNumber,
          provider_reference: providerReference,
          external_bill_id: `${invoice.invoice_no}-${method}`,
          amount: DecimalUtil.value(invoice.balance_amount).toFixed(2),
          currency: invoice.currency,
          status: PaymentReferenceStatus.ACTIVE,
          expires_at: expiresAt,
          provider_metadata: {
            ...(dto.metadata ?? {}),
            invoice_no: invoice.invoice_no,
            total_amount: invoice.total_amount,
            balance_amount: invoice.balance_amount,
            source_type: invoice.source_type,
            source_record_id: invoice.source_record_id,
          },
          created_by: user.id,
          updated_by: user.id,
        }),
      );
    });
  }

  async markPaidByReference(
    manager: EntityManager,
    companyId: string,
    invoiceId: string | null,
    method: string | null,
    paymentReference: string | null,
    userId: string | null,
  ) {
    if (!invoiceId || !method || !paymentReference) return;

    const reference = await manager.getRepository(PaymentReference).findOne({
      where: [
        {
          company_id: companyId,
          invoice_id: invoiceId,
          method: method.trim().toUpperCase(),
          provider_reference: paymentReference.trim(),
          status: In([...ACTIVE_REFERENCE_STATUSES]),
        },
        {
          company_id: companyId,
          invoice_id: invoiceId,
          method: method.trim().toUpperCase(),
          control_number: paymentReference.trim(),
          status: In([...ACTIVE_REFERENCE_STATUSES]),
        },
      ],
    });

    if (!reference) return;

    reference.status = PaymentReferenceStatus.PAID;
    reference.updated_by = userId;
    await manager.getRepository(PaymentReference).save(reference);
  }

  private resolveProvider(method: PaymentMethod, provider?: string | null) {
    const normalized = provider?.trim().toUpperCase();
    if (normalized) return normalized;

    switch (method) {
      case 'CASH':
        return 'CASH_DESK';
      case 'EFT':
      case 'BANK_TRANSFER':
        return 'BANK';
      case 'MOBILE_MONEY':
        return 'MOBILE_MONEY';
      case 'CARD':
        return 'CARD';
      case 'CONTROL_NUMBER':
        return 'CONTROL_NUMBER_PROVIDER';
      default:
        return 'MANUAL';
    }
  }

  private resolveChannel(method: PaymentMethod, channel?: string | null) {
    const normalized = channel?.trim().toUpperCase();
    if (normalized) return normalized;

    switch (method) {
      case 'CASH':
        return PaymentChannel.CASH;
      case 'EFT':
        return PaymentChannel.EFT;
      case 'BANK_TRANSFER':
        return PaymentChannel.BANK_TRANSFER;
      case 'MOBILE_MONEY':
        return PaymentChannel.MOBILE_MONEY;
      case 'CARD':
        return PaymentChannel.CARD;
      default:
        return PaymentChannel.UNKNOWN;
    }
  }

  private isExpired(reference: PaymentReference, now: Date) {
    return Boolean(reference.expires_at && reference.expires_at <= now);
  }

  private calculateExpiry(method: PaymentMethod) {
    const now = new Date();
    const hours = method === 'CONTROL_NUMBER' ? 48 : 24;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  private async generateProviderReference(
    invoice: Invoice,
    method: PaymentMethod,
    provider: string,
    metadata?: Record<string, unknown>,
  ) {
    const externalReference = metadata?.provider_reference;
    if (typeof externalReference === 'string' && externalReference.trim()) {
      return externalReference.trim();
    }

    const suffix = this.hashService
      .hashDefinition({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoice_no,
        method,
        provider,
        generatedAt: new Date().toISOString(),
      })
      .slice(0, 10)
      .toUpperCase();

    return `${method}-${invoice.invoice_no}-${suffix}`.slice(0, 180);
  }

  private async generateControlNumber(
    companyId: string,
    invoice: Invoice,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(PaymentReference);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const seed = this.hashService.hashDefinition({
        companyId,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoice_no,
        attempt,
        timestamp: Date.now(),
      });
      const numeric = seed.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
      const controlNumber = numeric.startsWith('0')
        ? `9${numeric.slice(1)}`
        : numeric;
      const exists = await repo.findOne({
        where: {
          company_id: companyId,
          control_number: controlNumber,
        },
        select: { id: true },
      });
      if (!exists) return controlNumber;
    }

    throw new BadRequestException(
      'Unable to generate a unique control number.',
    );
  }
}
