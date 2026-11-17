import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager, Not, In } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { Tax } from '../../taxes/entities/tax.entity';
import { PricingQuote } from '../../pricing/entities/pricing-quote.entity';
import {
  buildQuotationInvoiceTax,
  validatedInvoiceTax,
} from '../utils/quotation-invoice-tax';

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
    const total = DecimalUtil.value(params.amount);
    if (!total.isFinite() || total.lessThanOrEqualTo(0))
      throw new BadRequestException('Invoice total must be greater than zero.');
    if (!manager.queryRunner?.isTransactionActive)
      return manager.transaction((m) =>
        this.createOrReuseQuotationInvoice(m, params),
      );
    const [locked] = await manager.query(
      'SELECT id FROM quotations WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL FOR UPDATE',
      [params.quotationId, params.companyId],
    );
    if (!locked)
      throw new BadRequestException(
        'Quotation was not found in the invoice company.',
      );
    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: params.quotationId, company_id: params.companyId },
      relations: {
        cover_note: {
          entries: { risks: { taxes: true }, addons: { taxes: true } },
        },
      },
    });
    if (!quotation || quotation.customer_id !== params.customerId)
      throw new BadRequestException('Quotation customer evidence differs.');
    const riskItems = (quotation.cover_note?.entries ?? []).flatMap(
      (e) => e.risks ?? [],
    );
    const codes = [
      ...new Set(
        (quotation.cover_note?.entries ?? []).flatMap((e) =>
          [...(e.risks ?? []), ...(e.addons ?? [])].flatMap((r) =>
            (r.taxes ?? []).map((t) => t.tax_code),
          ),
        ),
      ),
    ];
    const pricingIds = [
      ...new Set(
        riskItems
          .map((r) => r.pricing_quote_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const catalogue = codes.length
      ? await manager.getRepository(Tax).find({
          where: { company_id: params.companyId, tax_code: In(codes) },
          withDeleted: true,
        })
      : [];
    const pricingQuotes = pricingIds.length
      ? await manager.getRepository(PricingQuote).find({
          where: {
            company_id: params.companyId,
            pricing_quote_id: In(pricingIds),
          },
        })
      : [];
    const breakdown = buildQuotationInvoiceTax(
      quotation,
      catalogue,
      pricingQuotes,
      params.amount,
      params.currencyCode,
    );
    const repository = manager.getRepository(Invoice);
    const existing = await repository.findOne({
      where: {
        company_id: params.companyId,
        source_type: InvoiceSourceType.QUOTATION,
        source_record_id: params.quotationId,
        status: Not(In(['VOID', 'VOIDED', 'CANCELLED'])),
      },
      order: { created_at: 'DESC' },
      relations: { items: true },
    });

    if (existing) {
      const original = validatedInvoiceTax(existing);
      if (
        existing.pricing_result_hash !== params.pricingResultHash ||
        original.financialHash !== breakdown.financialHash
      ) {
        throw new ConflictException({
          code: 'INVOICE_SOURCE_SNAPSHOT_MISMATCH',
          message: 'An invoice already exists for another quotation snapshot.',
        });
      }

      return existing;
    }

    if (Number(quotation.workflow_revision ?? 1) !== params.workflowRevision)
      throw new ConflictException(
        'The quotation changed before invoice creation. Reload the current source revision.',
      );

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
        gross_amount: breakdown.gross,
        discount_amount: breakdown.discount,
        tax_amount: breakdown.statutory,
        charges_amount: breakdown.fees,
        total_amount: breakdown.total,
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

    let first = true;
    for (const line of breakdown.lines) {
      const components = [
        {
          key: `${line.key}:NET`,
          type: 'QUOTATION_PREMIUM',
          name: line.description,
          amount: line.net,
          evidence: {
            sourceType: line.sourceType,
            sourceId: line.sourceId,
            gross: line.gross,
            discount: line.discount,
            net: line.net,
          },
        },
        ...line.charges.map((c) => ({
          key: `${line.key}:${c.code}`,
          type: c.category,
          name: c.name,
          amount: c.amount,
          evidence: c,
        })),
      ];
      for (const component of components) {
        const itemSnapshot: Record<string, unknown> = {
          source: 'QUOTATION',
          quotationId: params.quotationId,
          quotationNumber: params.quotationNumber,
          workflowRevision: params.workflowRevision,
          pricingResultHash: line.pricingResultHash,
          component_key: component.key,
          component: component.evidence,
          ...(first ? { tax_breakdown: breakdown } : {}),
        };
        first = false;
        await manager.getRepository(InvoiceItem).save({
          invoice_id: invoice.id,
          item_type: component.type,
          item_name: component.name.slice(0, 150),
          description: component.name,
          quantity: '1.000000',
          unit_amount: component.amount,
          total_amount: component.amount,
          source_line_type: component.type,
          source_line_id: line.sourceId,
          line_snapshot: itemSnapshot,
          line_hash: this.hashService.hashDefinition(itemSnapshot),
        });
      }
    }

    return manager.getRepository(Invoice).findOneOrFail({
      where: { id: invoice.id },
      relations: { items: true },
    });
  }
}
