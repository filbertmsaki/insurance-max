import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager, Not } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';

@Injectable()
export class QuotationInvoiceService {
  constructor(
    private readonly hashService: ProductDefinitionHashService,
    private readonly identifierService: IdentifierGeneratorService,
  ) {}

  async createOrReuseQuotationInvoice(
    manager: EntityManager,
    params: {
      companyId: string;
      quotationId: string;
      quotationNumber: string;
      workflowRevision: number;
      insurerCompanyId: string;
      intermediaryCompanyId?: string | null;
      customerId: string;
      branchId: string | null;
      currencyCode: string;
      amount: string;
      pricingResultHash: string | null;
      finalizationHash: string;
      sourceSnapshot: Record<string, unknown>;
      createdBy: string;
      instructions?: string;
    },
  ) {
    const repository = manager.getRepository(Invoice);
    const existing = await repository.findOne({
      where: {
        company_id: params.companyId,
        source_type: InvoiceSourceType.QUOTATION,
        source_record_id: params.quotationId,
        source_revision: params.workflowRevision,
        status: Not(InvoiceStatus.VOIDED),
      },
      relations: { items: true },
    });

    if (existing) {
      if (
        existing.pricing_result_hash !== params.pricingResultHash ||
        existing.source_snapshot_hash !== params.finalizationHash
      ) {
        throw new ConflictException({
          code: 'INVOICE_SOURCE_SNAPSHOT_MISMATCH',
          message: 'An invoice already exists for another quotation snapshot.',
        });
      }

      return existing;
    }

    const total = DecimalUtil.value(params.amount);
    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Invoice total must be greater than zero.');
    }

    const invoiceNumber = await this.identifierService.generateInvoiceNumber(
      params.companyId,
      manager,
    );

    const invoice = await repository.save(
      repository.create({
        company_id: params.companyId,
        insurer_company_id: params.insurerCompanyId,
        intermediary_company_id: params.intermediaryCompanyId ?? null,
        branch_id: params.branchId,
        customer_id: params.customerId,
        invoice_no: invoiceNumber,
        invoice_type: 'QUOTATION',
        source_type: InvoiceSourceType.QUOTATION,
        source_record_id: params.quotationId,
        source_revision: params.workflowRevision,
        quotation_id: params.quotationId,
        policy_id: null,
        due_date: new Date().toISOString().slice(0, 10),
        currency: params.currencyCode.trim().toUpperCase(),
        gross_amount: total.toFixed(2),
        discount_amount: '0.00',
        tax_amount: '0.00',
        charges_amount: '0.00',
        total_amount: total.toFixed(2),
        paid_amount: '0.00',
        allocated_amount: '0.0000',
        refunded_amount: '0.0000',
        written_off_amount: '0.0000',
        balance_amount: total.toFixed(4),
        status: InvoiceStatus.DRAFT,
        pricing_result_hash: params.pricingResultHash,
        source_snapshot: params.sourceSnapshot,
        source_snapshot_hash: params.finalizationHash,
        notes: params.instructions ?? null,
        balance_revision: 1,
        state_version: 1,
        created_by: params.createdBy,
        updated_by: params.createdBy,
      }),
    );

    const itemSnapshot = {
      source: 'QUOTATION',
      quotationId: params.quotationId,
      quotationNumber: params.quotationNumber,
      workflowRevision: params.workflowRevision,
      pricingResultHash: params.pricingResultHash,
      description: `Insurance premium for quotation ${params.quotationNumber}`,
      quantity: '1.000000',
      unitPrice: total.toFixed(4),
      totalAmount: total.toFixed(4),
    };

    await manager.getRepository(InvoiceItem).save({
      invoice_id: invoice.id,
      item_type: 'QUOTATION_PREMIUM',
      item_name: `Quotation ${params.quotationNumber}`,
      description: itemSnapshot.description,
      quantity: '1.000000',
      unit_amount: total.toFixed(2),
      total_amount: total.toFixed(2),
      source_line_type: 'QUOTATION_PREMIUM',
      source_line_id: params.quotationId,
      line_snapshot: itemSnapshot,
      line_hash: this.hashService.hashDefinition(itemSnapshot),
    });

    return manager.getRepository(Invoice).findOneOrFail({
      where: { id: invoice.id },
      relations: { items: true },
    });
  }
}
