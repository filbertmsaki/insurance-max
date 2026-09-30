import { ConflictException, Injectable } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceRefund } from '../entities/finance-refund.entity';
import { FinanceAccount } from '../entities/finance-account.entity';
import { FinanceJournalEntry } from '../entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../entities/finance-journal-line.entity';
import { CommissionPayment } from '../entities/commission-payment.entity';
import { Invoice } from '../entities/invoice.entity';
import { Receipt } from '../entities/receipt.entity';
import { CommissionTransaction } from '../entities/commission-transaction.entity';

interface JournalLineInput {
  accountCode: string;
  accountName: string;
  accountType: string;
  customerId?: string | null;
  intermediaryCompanyId?: string | null;
  description?: string | null;
  debit?: string;
  credit?: string;
}

@Injectable()
export class FinanceJournalService {
  constructor(
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async postInvoice(
    manager: EntityManager,
    invoice: Invoice,
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      invoice.company_id,
      {
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        sourceEventId,
        description: `Invoice ${invoice.invoice_no} issued`,
        currencyCode: invoice.currency,
        lines: [
          {
            accountCode: '1200',
            accountName: 'Premium Receivables',
            accountType: 'ASSET',
            customerId: invoice.customer_id,
            debit: invoice.total_amount,
          },
          {
            accountCode: '4100',
            accountName: 'Gross Written Premium',
            accountType: 'INCOME',
            credit: invoice.gross_amount,
          },
          {
            accountCode: '4200',
            accountName: 'Insurance Taxes and Levies Payable',
            accountType: 'LIABILITY',
            credit: invoice.tax_amount,
          },
        ],
      },
      userId,
    );
  }

  async reverseInvoice(
    manager: EntityManager,
    invoice: Invoice,
    sourceEventId: string,
    userId: string | null,
    reason: string,
  ) {
    return this.postJournal(
      manager,
      invoice.company_id,
      {
        sourceType: 'WRITE_OFF',
        sourceId: invoice.id,
        sourceEventId,
        description: `Invoice ${invoice.invoice_no} reversed: ${reason}`,
        currencyCode: invoice.currency,
        lines: [
          {
            accountCode: '4100',
            accountName: 'Gross Written Premium',
            accountType: 'INCOME',
            debit: invoice.gross_amount,
          },
          {
            accountCode: '4200',
            accountName: 'Insurance Taxes and Levies Payable',
            accountType: 'LIABILITY',
            debit: invoice.tax_amount,
          },
          {
            accountCode: '1200',
            accountName: 'Premium Receivables',
            accountType: 'ASSET',
            customerId: invoice.customer_id,
            credit: invoice.total_amount,
          },
        ],
      },
      userId,
    );
  }

  async postReceipt(
    manager: EntityManager,
    receipt: Receipt,
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      receipt.company_id,
      {
        sourceType: 'RECEIPT',
        sourceId: receipt.id,
        sourceEventId,
        description: `Receipt ${receipt.receipt_no} posted`,
        currencyCode: receipt.currency,
        lines: [
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            debit: receipt.amount,
          },
          {
            accountCode: '1200',
            accountName: 'Premium Receivables',
            accountType: 'ASSET',
            customerId: receipt.customer_id,
            credit: receipt.amount,
          },
        ],
      },
      userId,
    );
  }

  async reverseReceipt(
    manager: EntityManager,
    receipt: Receipt,
    sourceEventId: string,
    userId: string | null,
    reason: string,
  ) {
    return this.postJournal(
      manager,
      receipt.company_id,
      {
        sourceType: 'RECEIPT_REVERSAL',
        sourceId: receipt.id,
        sourceEventId,
        description: `Receipt ${receipt.receipt_no} reversed: ${reason}`,
        currencyCode: receipt.currency,
        lines: [
          {
            accountCode: '1200',
            accountName: 'Premium Receivables',
            accountType: 'ASSET',
            customerId: receipt.customer_id,
            debit: receipt.amount,
          },
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            credit: receipt.amount,
          },
        ],
      },
      userId,
    );
  }

  async postCommissionAccrual(
    manager: EntityManager,
    accrual: CommissionTransaction,
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      accrual.company_id,
      {
        sourceType: 'COMMISSION_ACCRUAL',
        sourceId: accrual.id,
        sourceEventId,
        description: `Commission accrual ${accrual.accrual_no ?? accrual.id}`,
        currencyCode: accrual.invoice?.currency ?? 'TZS',
        lines: [
          {
            accountCode: '5100',
            accountName: 'Commission Expense',
            accountType: 'EXPENSE',
            debit: accrual.commission_amount,
          },
          {
            accountCode: '2200',
            accountName: 'Commission Payable',
            accountType: 'LIABILITY',
            intermediaryCompanyId: accrual.intermediary_company_id,
            credit: accrual.commission_amount,
          },
        ],
      },
      userId,
    );
  }

  async postRefund(
    manager: EntityManager,
    refund: FinanceRefund,
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      refund.company_id,
      {
        sourceType: 'REFUND',
        sourceId: refund.id,
        sourceEventId,
        description: `Refund ${refund.refund_no} paid`,
        currencyCode: refund.currency_code,
        lines: [
          {
            accountCode: refund.invoice_id ? '1200' : '2100',
            accountName: refund.invoice_id
              ? 'Premium Receivables'
              : 'Customer Overpayments',
            accountType: 'ASSET',
            customerId: refund.customer_id,
            debit: refund.amount,
          },
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            credit: refund.amount,
          },
        ],
      },
      userId,
    );
  }

  /**
   * Posts a claim payment disbursement. Takes primitives rather than a
   * `ClaimDisbursement` entity so `billing-commission` doesn't need to
   * depend on the `claims` module — the claims module owns disbursement
   * lifecycle/authority, Finance only owns the ledger entry.
   */
  async postClaimDisbursement(
    manager: EntityManager,
    params: {
      companyId: string;
      disbursementId: string;
      disbursementNo: string;
      customerId: string | null;
      amount: string;
      currencyCode: string;
    },
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      params.companyId,
      {
        sourceType: 'CLAIM_DISBURSEMENT',
        sourceId: params.disbursementId,
        sourceEventId,
        description: `Claim disbursement ${params.disbursementNo} paid`,
        currencyCode: params.currencyCode,
        lines: [
          {
            accountCode: '2400',
            accountName: 'Claims Payable',
            accountType: 'LIABILITY',
            customerId: params.customerId,
            debit: params.amount,
          },
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            credit: params.amount,
          },
        ],
      },
      userId,
    );
  }

  /** Mirror of postClaimDisbursement for a reversed (returned) payout. */
  async reverseClaimDisbursement(
    manager: EntityManager,
    params: {
      companyId: string;
      disbursementId: string;
      disbursementNo: string;
      customerId: string | null;
      amount: string;
      currencyCode: string;
      reason: string;
    },
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      params.companyId,
      {
        sourceType: 'CLAIM_DISBURSEMENT_REVERSAL',
        sourceId: params.disbursementId,
        sourceEventId,
        description: `Claim disbursement ${params.disbursementNo} reversed: ${params.reason}`,
        currencyCode: params.currencyCode,
        lines: [
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            debit: params.amount,
          },
          {
            accountCode: '2400',
            accountName: 'Claims Payable',
            accountType: 'LIABILITY',
            customerId: params.customerId,
            credit: params.amount,
          },
        ],
      },
      userId,
    );
  }

  /**
   * Posts a reinsurance settlement. Takes primitives rather than a
   * `ReinsuranceSettlement` entity so `billing-commission` doesn't need to
   * depend on the `reinsurance` module — reinsurance owns settlement
   * lifecycle/authority, Finance only owns the ledger entry. Claim-recovery
   * settlements are an inflow (money received from the reinsurer); every
   * other settlement type (premium/commission/net-account/adjustment) is
   * modelled as an outflow (money paid to the reinsurer).
   */
  async postReinsuranceSettlement(
    manager: EntityManager,
    params: {
      companyId: string;
      settlementId: string;
      settlementNo: string;
      counterpartyCompanyId: string | null;
      settlementType: string;
      amount: string;
      currencyCode: string;
    },
    sourceEventId: string,
    userId: string | null,
  ) {
    const isInflow = params.settlementType === 'CLAIM_RECOVERY';

    return this.postJournal(
      manager,
      params.companyId,
      {
        sourceType: 'REINSURANCE_SETTLEMENT',
        sourceId: params.settlementId,
        sourceEventId,
        description: `Reinsurance settlement ${params.settlementNo} (${params.settlementType}) paid`,
        currencyCode: params.currencyCode,
        lines: isInflow
          ? [
              {
                accountCode: '1100',
                accountName: 'Bank/Cash',
                accountType: 'ASSET',
                debit: params.amount,
              },
              {
                accountCode: '1300',
                accountName: 'Reinsurance Recoverables',
                accountType: 'ASSET',
                intermediaryCompanyId: params.counterpartyCompanyId,
                credit: params.amount,
              },
            ]
          : [
              {
                accountCode: '2500',
                accountName: 'Reinsurance Premium Payable',
                accountType: 'LIABILITY',
                intermediaryCompanyId: params.counterpartyCompanyId,
                debit: params.amount,
              },
              {
                accountCode: '1100',
                accountName: 'Bank/Cash',
                accountType: 'ASSET',
                credit: params.amount,
              },
            ],
      },
      userId,
    );
  }

  async postCommissionPayment(
    manager: EntityManager,
    payment: CommissionPayment,
    sourceEventId: string,
    userId: string | null,
  ) {
    return this.postJournal(
      manager,
      payment.company_id,
      {
        sourceType: 'COMMISSION_PAYMENT',
        sourceId: payment.id,
        sourceEventId,
        description: `Commission payment ${payment.payment_no} paid`,
        currencyCode: payment.currency,
        lines: [
          {
            accountCode: '2200',
            accountName: 'Commission Payable',
            accountType: 'LIABILITY',
            intermediaryCompanyId: payment.intermediary_company_id,
            debit: payment.allocated_amount || payment.total_amount,
          },
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            credit: payment.allocated_amount || payment.total_amount,
          },
        ],
      },
      userId,
    );
  }

  async reverseCommissionAccrual(
    manager: EntityManager,
    accrual: CommissionTransaction,
    sourceEventId: string,
    userId: string | null,
    reason: string,
  ) {
    return this.postJournal(
      manager,
      accrual.company_id,
      {
        sourceType: 'COMMISSION_ACCRUAL_REVERSAL',
        sourceId: accrual.id,
        sourceEventId,
        description: `Commission accrual ${accrual.accrual_no ?? accrual.id} reversed: ${reason}`,
        currencyCode: accrual.invoice?.currency ?? 'TZS',
        lines: [
          {
            accountCode: '2200',
            accountName: 'Commission Payable',
            accountType: 'LIABILITY',
            intermediaryCompanyId: accrual.intermediary_company_id,
            debit: accrual.commission_amount,
          },
          {
            accountCode: '5100',
            accountName: 'Commission Expense',
            accountType: 'EXPENSE',
            credit: accrual.commission_amount,
          },
        ],
      },
      userId,
    );
  }

  async reverseCommissionPayment(
    manager: EntityManager,
    payment: CommissionPayment,
    sourceEventId: string,
    userId: string | null,
    reason: string,
  ) {
    return this.postJournal(
      manager,
      payment.company_id,
      {
        sourceType: 'COMMISSION_PAYMENT_REVERSAL',
        sourceId: payment.id,
        sourceEventId,
        description: `Commission payment ${payment.payment_no} reversed: ${reason}`,
        currencyCode: payment.currency,
        lines: [
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            debit: payment.allocated_amount || payment.total_amount,
          },
          {
            accountCode: '2200',
            accountName: 'Commission Payable',
            accountType: 'LIABILITY',
            intermediaryCompanyId: payment.intermediary_company_id,
            credit: payment.allocated_amount || payment.total_amount,
          },
        ],
      },
      userId,
    );
  }

  private async postJournal(
    manager: EntityManager,
    companyId: string,
    params: {
      sourceType: string;
      sourceId: string;
      sourceEventId: string;
      description: string;
      currencyCode: string;
      lines: JournalLineInput[];
    },
    userId: string | null,
  ) {
    const existing = await manager.getRepository(FinanceJournalEntry).findOne({
      where: {
        company_id: companyId,
        source_type: params.sourceType,
        source_event_id: params.sourceEventId,
      },
    });

    if (existing) {
      return existing;
    }

    const totalDebit = params.lines.reduce(
      (total, line) => total.plus(DecimalUtil.value(line.debit ?? 0)),
      DecimalUtil.value(0),
    );
    const totalCredit = params.lines.reduce(
      (total, line) => total.plus(DecimalUtil.value(line.credit ?? 0)),
      DecimalUtil.value(0),
    );

    if (!totalDebit.equals(totalCredit)) {
      throw new ConflictException({
        code: 'UNBALANCED_FINANCE_JOURNAL',
        message: 'Journal debit and credit totals do not balance.',
      });
    }

    const journalNo = await this.identifierService.generateRequestId(
      companyId,
      manager,
    );

    const lineRepository = manager.getRepository(FinanceJournalLine);
    const linesForHash = params.lines.map((line) => ({
      accountCode: line.accountCode,
      debit: DecimalUtil.value(line.debit ?? 0).toFixed(4),
      credit: DecimalUtil.value(line.credit ?? 0).toFixed(4),
      customerId: line.customerId ?? null,
      intermediaryCompanyId: line.intermediaryCompanyId ?? null,
    }));

    const entry = await manager.getRepository(FinanceJournalEntry).save({
      company_id: companyId,
      journal_no: journalNo,
      journal_date: new Date().toISOString().slice(0, 10),
      source_type: params.sourceType,
      source_id: params.sourceId,
      source_event_id: params.sourceEventId,
      description: params.description,
      currency_code: params.currencyCode,
      posted_by: userId,
      posted_at: new Date(),
      entry_hash: this.hashService.hashDefinition(
        linesForHash as unknown as Record<string, unknown>,
      ),
    });

    for (const line of params.lines) {
      const account = await this.requireAccount(
        manager,
        companyId,
        line.accountCode,
        line.accountName,
        line.accountType,
      );
      await lineRepository.save(
        lineRepository.create({
          journal_entry_id: entry.id,
          account_id: account.id,
          customer_id: line.customerId ?? null,
          intermediary_company_id: line.intermediaryCompanyId ?? null,
          description: line.description ?? null,
          debit: DecimalUtil.value(line.debit ?? 0).toFixed(4),
          credit: DecimalUtil.value(line.credit ?? 0).toFixed(4),
        }),
      );
    }

    return entry;
  }

  private async requireAccount(
    manager: EntityManager,
    companyId: string,
    accountCode: string,
    accountName: string,
    accountType: string,
  ) {
    const repository = manager.getRepository(FinanceAccount);
    const existing = await repository.findOne({
      where: {
        company_id: companyId,
        account_code: accountCode,
      },
    });

    if (existing) {
      return existing;
    }

    return repository.save(
      repository.create({
        company_id: companyId,
        account_code: accountCode,
        account_name: accountName,
        account_type: accountType,
      }),
    );
  }
}
