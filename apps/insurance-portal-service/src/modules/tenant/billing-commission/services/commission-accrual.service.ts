import { Injectable } from '@nestjs/common';
import {
  CommissionAccrualStatus,
  QuotationPaymentStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';

import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { CommissionTransaction } from '../entities/commission-transaction.entity';
import { FinanceJournalService } from './finance-journal.service';
import { FinanceOutboxService } from './finance-outbox.service';

@Injectable()
export class CommissionAccrualService {
  constructor(
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly journalService: FinanceJournalService,
    private readonly outboxService: FinanceOutboxService,
  ) {}

  async accrueForPaidQuotation(
    manager: EntityManager,
    quotationId: string,
    workflowRevision: number,
    sourceEventId: string,
    invoiceId: string | null,
  ) {
    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: quotationId },
      relations: {
        cover_note: true,
      },
    });

    if (
      !quotation ||
      quotation.payment_status_v2 !== QuotationPaymentStatus.PAID ||
      !quotation.intermediary_company_id
    ) {
      return null;
    }

    const finalization = quotation.finalization_snapshot ?? null;
    const commissionAmount = this.pickNumber(
      finalization?.commissionPaid,
      quotation.cover_note?.commission_paid,
    );
    const commissionRate = this.pickNumber(
      finalization?.commissionRate,
      quotation.cover_note?.commission_rate,
    );
    const commissionBase = this.pickNumber(
      finalization?.totalPremiumExcludingTax,
      quotation.cover_note?.total_premium_excluding_tax,
    );
    const currencyCode = this.pickString(
      finalization?.currencyCode,
      quotation.cover_note?.currency_code,
      'TZS',
    );

    if (commissionAmount <= 0) {
      return null;
    }

    const existing = await manager
      .getRepository(CommissionTransaction)
      .findOne({
        where: {
          company_id: quotation.company_id,
          quotation_id: quotation.id,
          intermediary_company_id: quotation.intermediary_company_id,
        },
      });

    if (existing) {
      return existing;
    }

    const accrualNo =
      await this.identifierService.generateCommissionAccrualNumber(
        quotation.company_id,
        manager,
      );

    const snapshot = {
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision,
      intermediaryCompanyId: quotation.intermediary_company_id,
      commissionBase: commissionBase.toFixed(4),
      commissionRate: commissionRate.toFixed(10),
      commissionAmount: commissionAmount.toFixed(4),
      currencyCode,
      sourceFinalizationHash: quotation.finalization_hash,
      sourceEventId,
    };

    const accrual = await manager.getRepository(CommissionTransaction).save(
      manager.getRepository(CommissionTransaction).create({
        company_id: quotation.company_id,
        insurer_company_id: quotation.insurer_company_id,
        intermediary_company_id: quotation.intermediary_company_id,
        policy_id: null,
        quotation_id: quotation.id,
        invoice_id: invoiceId,
        receipt_id: null,
        commission_rule_id: null,
        distribution_option_id: null,
        accrual_no: accrualNo,
        commission_type: 'INTERMEDIARY',
        calculation_base: 'QUOTATION_PREMIUM',
        gross_premium: commissionBase.toFixed(4),
        net_premium: commissionBase.toFixed(4),
        commission_rate: commissionRate.toFixed(10),
        commission_amount: commissionAmount.toFixed(4),
        paid_amount: '0.0000',
        balance_amount: commissionAmount.toFixed(4),
        status: CommissionAccrualStatus.ACCRUED,
        commission_snapshot: snapshot,
        commission_snapshot_hash: this.hashService.hashDefinition(snapshot),
        accrued_at: new Date(),
      }),
    );

    await this.journalService.postCommissionAccrual(
      manager,
      accrual,
      sourceEventId,
      null,
    );

    await this.outboxService.add(manager, {
      companyId: quotation.company_id,
      aggregateType: 'COMMISSION_ACCRUAL',
      aggregateId: accrual.id,
      eventType: 'COMMISSION_ACCRUED',
      eventKey: `commission-accrual:${accrual.id}:accrued`,
      payload: snapshot,
    });

    return accrual;
  }

  private pickNumber(...values: Array<unknown>): number {
    for (const value of values) {
      const number =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : NaN;

      if (Number.isFinite(number)) {
        return number;
      }
    }

    return 0;
  }

  private pickString(...values: Array<unknown>): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim().toUpperCase();
      }
    }

    return 'TZS';
  }
}
