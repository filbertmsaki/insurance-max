import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager, Not } from 'typeorm';
import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { InvoiceItem } from '../../billing-commission/entities/invoice-item.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';

export interface PolicyTransactionInvoiceInput {
  companyId: string;
  insurerCompanyId: string;
  intermediaryCompanyId?: string | null;
  customerId: string;
  branchId: string | null;
  transaction: PolicyTransaction;
  /** `PolicyEndorsement.id` or `PolicyCancellation.id` — the id of the
   * child row referenced by `invoices.endorsement_id`/`cancellation_id`. */
  childResourceId: string;
  sourceType:
    | typeof InvoiceSourceType.ENDORSEMENT
    | typeof InvoiceSourceType.CANCELLATION;
  amount: string;
  description: string;
  createdBy: string;
}

/**
 * Creates the additional-premium/cancellation-charge invoice for a policy
 * transaction, mirroring `QuotationInvoiceService.createOrReuseQuotationInvoice`
 * (§13.7/§13.13/§13.19). Idempotent per (company, source_type,
 * source_record_id, source_revision=state_version).
 */
@Injectable()
export class PolicyTransactionInvoiceService {
  constructor(
    private readonly hashService: ProductDefinitionHashService,
    private readonly identifierService: IdentifierGeneratorService,
  ) {}

  async createOrReuseInvoice(
    manager: EntityManager,
    params: PolicyTransactionInvoiceInput,
  ): Promise<Invoice> {
    const repository = manager.getRepository(Invoice);
    const existing = await repository.findOne({
      where: {
        company_id: params.companyId,
        source_type: params.sourceType,
        source_record_id: params.transaction.id,
        source_revision: params.transaction.state_version,
        status: Not(InvoiceStatus.VOIDED),
      },
      relations: { items: true },
    });

    if (existing) {
      if (
        existing.pricing_result_hash !==
        params.transaction.pricing_snapshot_hash
      ) {
        throw new ConflictException({
          code: 'ENDORSEMENT_INVOICE_PRICING_MISMATCH',
          message:
            'An invoice already exists for a different endorsement pricing result.',
        });
      }

      if (
        !DecimalUtil.value(existing.total_amount).equals(
          DecimalUtil.value(params.amount),
        )
      ) {
        throw new ConflictException({
          code: 'ENDORSEMENT_INVOICE_AMOUNT_MISMATCH',
          message:
            'The existing endorsement invoice amount no longer matches the transaction.',
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

    const sourceSnapshot = {
      transactionId: params.transaction.id,
      transactionNo: params.transaction.transaction_no,
      transactionType: params.transaction.transaction_type,
      sourcePolicyId: params.transaction.source_policy_id,
      sourcePolicyVersionId: params.transaction.source_policy_version_id,
      sourcePolicyVersionNo: params.transaction.source_policy_version_no,
      stateVersion: params.transaction.state_version,
      effectiveDate: params.transaction.effective_date,
      premiumEffect: params.transaction.premium_effect,
      additionalPremium: params.transaction.additional_premium,
      pricingSnapshotHash: params.transaction.pricing_snapshot_hash,
      proposedPolicySnapshotHash:
        params.transaction.proposed_policy_snapshot_hash,
    };
    const sourceSnapshotHash = this.hashService.hashDefinition(sourceSnapshot);

    const invoice = await repository.save(
      repository.create({
        company_id: params.companyId,
        insurer_company_id: params.insurerCompanyId,
        intermediary_company_id: params.intermediaryCompanyId ?? null,
        branch_id: params.branchId,
        customer_id: params.customerId,
        invoice_no: invoiceNumber,
        invoice_type: params.sourceType,
        source_type: params.sourceType,
        source_record_id: params.transaction.id,
        source_revision: params.transaction.state_version,
        policy_id: params.transaction.source_policy_id,
        endorsement_id:
          params.sourceType === InvoiceSourceType.ENDORSEMENT
            ? params.childResourceId
            : null,
        cancellation_id:
          params.sourceType === InvoiceSourceType.CANCELLATION
            ? params.childResourceId
            : null,
        due_date: new Date().toISOString().slice(0, 10),
        currency: params.transaction.currency_code,
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
        pricing_result_hash: params.transaction.pricing_snapshot_hash,
        source_snapshot: sourceSnapshot,
        source_snapshot_hash: sourceSnapshotHash,
        balance_revision: 1,
        state_version: 1,
        created_by: params.createdBy,
        updated_by: params.createdBy,
      }),
    );

    await manager.getRepository(InvoiceItem).save({
      invoice_id: invoice.id,
      item_type: `${params.sourceType}_PREMIUM`,
      item_name: params.description,
      description: params.description,
      quantity: '1.000000',
      unit_amount: total.toFixed(2),
      total_amount: total.toFixed(2),
      source_line_type: params.sourceType,
      source_line_id: params.transaction.id,
      line_snapshot: sourceSnapshot,
      line_hash: sourceSnapshotHash,
    });

    const reloaded = await repository.findOne({
      where: { id: invoice.id },
      relations: { items: true },
    });

    if (!reloaded) {
      throw new ConflictException('Failed to reload the created invoice.');
    }

    return reloaded;
  }
}
