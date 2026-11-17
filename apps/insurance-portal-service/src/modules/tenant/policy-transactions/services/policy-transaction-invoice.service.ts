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
import {
  buildEndorsementInvoiceTax,
  validatedEndorsementInvoiceTax,
} from '../../billing-commission/utils/endorsement-invoice-tax';

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
 * source_record_id and frozen pricing vector). Workflow-only endorsement
 * revisions reuse the original invoice; historical records are never rewritten.
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
    const endorsement = params.sourceType === InvoiceSourceType.ENDORSEMENT;
    if (endorsement && !manager.queryRunner?.isTransactionActive)
      return manager.transaction((m) => this.createOrReuseInvoice(m, params));
    let transaction = params.transaction;
    if (endorsement) {
      const [locked] = await manager.query(
        'SELECT *,effective_date::text AS effective_date FROM policy_transactions WHERE id=$1 AND company_id=$2 FOR UPDATE',
        [transaction.id, params.companyId],
      );
      if (
        !locked ||
        locked.state_version !== transaction.state_version ||
        locked.pricing_snapshot_hash !== transaction.pricing_snapshot_hash
      )
        throw new ConflictException(
          'Endorsement changed before invoice creation; reload the current transaction.',
        );
      transaction = locked;
      const [policy] = await manager.query(
        'SELECT customer_id,insurer_company_id FROM policies WHERE id=$1 AND company_id=$2 FOR SHARE',
        [transaction.source_policy_id, params.companyId],
      );
      if (
        !policy ||
        policy.customer_id !== params.customerId ||
        policy.insurer_company_id !== params.insurerCompanyId
      )
        throw new ConflictException(
          'Endorsement invoice customer or company ownership differs from the source policy.',
        );
    }
    const breakdown = endorsement
      ? buildEndorsementInvoiceTax(transaction, params.companyId, params.amount)
      : null;
    const repository = manager.getRepository(Invoice);
    const existing = await repository.findOne({
      where: {
        company_id: params.companyId,
        source_type: params.sourceType,
        source_record_id: transaction.id,
        ...(endorsement ? {} : { source_revision: transaction.state_version }),
        status: Not(InvoiceStatus.VOIDED),
      },
      order: { created_at: 'DESC' },
      relations: { items: true },
    });

    if (existing) {
      if (existing.pricing_result_hash !== transaction.pricing_snapshot_hash) {
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

      if (
        breakdown &&
        validatedEndorsementInvoiceTax(existing).financialHash !==
          breakdown.financialHash
      )
        throw new ConflictException(
          'Existing endorsement invoice requires reconciliation with the original component evidence.',
        );
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
      ...(breakdown ? { taxBreakdownHash: breakdown.financialHash } : {}),
      transactionId: transaction.id,
      transactionNo: transaction.transaction_no,
      transactionType: transaction.transaction_type,
      sourcePolicyId: transaction.source_policy_id,
      sourcePolicyVersionId: transaction.source_policy_version_id,
      sourcePolicyVersionNo: transaction.source_policy_version_no,
      stateVersion: transaction.state_version,
      effectiveDate: transaction.effective_date,
      premiumEffect: transaction.premium_effect,
      additionalPremium: transaction.additional_premium,
      pricingSnapshotHash: transaction.pricing_snapshot_hash,
      proposedPolicySnapshotHash: transaction.proposed_policy_snapshot_hash,
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
        source_record_id: transaction.id,
        source_revision: transaction.state_version,
        policy_id: transaction.source_policy_id,
        endorsement_id:
          params.sourceType === InvoiceSourceType.ENDORSEMENT
            ? params.childResourceId
            : null,
        cancellation_id:
          params.sourceType === InvoiceSourceType.CANCELLATION
            ? params.childResourceId
            : null,
        due_date: new Date().toISOString().slice(0, 10),
        currency: transaction.currency_code,
        gross_amount: breakdown?.gross ?? total.toFixed(2),
        discount_amount: breakdown?.discount ?? '0.00',
        tax_amount: breakdown?.statutory ?? '0.00',
        charges_amount: breakdown?.fees ?? '0.00',
        total_amount: total.toFixed(2),
        paid_amount: '0.00',
        allocated_amount: '0.0000',
        refunded_amount: '0.0000',
        written_off_amount: '0.0000',
        balance_amount: total.toFixed(4),
        status: InvoiceStatus.DRAFT,
        pricing_result_hash: transaction.pricing_snapshot_hash,
        source_snapshot: sourceSnapshot,
        source_snapshot_hash: sourceSnapshotHash,
        balance_revision: 1,
        state_version: 1,
        created_by: params.createdBy,
        updated_by: params.createdBy,
      }),
    );

    if (breakdown) {
      let first = true;
      for (const line of breakdown.lines) {
        const components = [
          {
            key: line.key + ':NET',
            type: 'ENDORSEMENT_PREMIUM',
            name: line.description,
            amount: line.net,
            evidence: {
              gross: line.gross,
              discount: line.discount,
              net: line.net,
              rounding: line.rounding,
            },
          },
          ...line.charges.map((c) => ({
            key: line.key + ':' + c.code,
            type: c.category,
            name: c.name + ' (' + line.direction + ')',
            amount: c.amount,
            evidence: c,
          })),
        ];
        for (const component of components) {
          const snapshot = {
            transactionId: transaction.id,
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
            quantity: '1.00',
            unit_amount: component.amount,
            total_amount: component.amount,
            source_line_type: component.type,
            source_line_id: line.sourceId,
            line_snapshot: snapshot,
            line_hash: this.hashService.hashDefinition(snapshot),
          });
        }
      }
    } else
      await manager.getRepository(InvoiceItem).save({
        invoice_id: invoice.id,
        item_type: `${params.sourceType}_PREMIUM`,
        item_name: params.description,
        description: params.description,
        quantity: '1.000000',
        unit_amount: total.toFixed(2),
        total_amount: total.toFixed(2),
        source_line_type: params.sourceType,
        source_line_id: transaction.id,
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
