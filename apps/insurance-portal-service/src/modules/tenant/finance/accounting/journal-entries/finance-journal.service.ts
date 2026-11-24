import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../../shared/identifiers/identifier-generator.service';
import { FinanceRefund } from '../../receivables/refunds/entities/finance-refund.entity';
import { FinanceAccount } from '../../foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceJournalEntry } from './entities/finance-journal-entry.entity';
import { FinanceJournalLine } from './entities/finance-journal-line.entity';
import {
  validatedPremiumInvoiceTax,
  hasPremiumInvoiceTax,
} from '../../taxation/tax-calculation/premium-invoice-tax';
import { CommissionPayment } from '../../payables/commission-payables/entities/commission-payment.entity';
import { Invoice } from '../../receivables/invoices/entities/invoice.entity';
import { Receipt } from '../../receivables/receipts/entities/receipt.entity';
import { CommissionTransaction } from '../../payables/commission-payables/entities/commission-transaction.entity';
import { FinancePostingPolicyService } from '../posting-rules/finance-posting-policy.service';

import { FinanceOperatingPostingService } from '../general-ledger/finance-operating-posting.service';

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
    private readonly postingPolicy: FinancePostingPolicyService = new FinancePostingPolicyService(),
    @Optional() private readonly operating?: FinanceOperatingPostingService,
  ) {}

  async postInvoice(
    manager: EntityManager,
    invoice: Invoice,
    sourceEventId: string,
    userId: string | null,
  ) {
    if (invoice.source_snapshot?.taxBreakdownStatus === 'UNRESOLVED') {
      throw new ConflictException({
        code: 'INVOICE_TAX_BREAKDOWN_UNRESOLVED',
        message:
          'The source premium is preserved, but tax and levy components need verified evidence before accounting recognition.',
      });
    }
    if (hasPremiumInvoiceTax(invoice.source_type))
      return this.postPremiumInvoice(
        manager,
        invoice,
        sourceEventId,
        userId,
        false,
      );
    return this.postJournal(
      manager,
      invoice.company_id,
      {
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        sourceEventId,
        description: `Invoice ${invoice.invoice_no} issued`,
        currencyCode: invoice.currency,
        dimensions: invoice.finance_dimensions,
        branchId: invoice.branch_id,
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
    if (hasPremiumInvoiceTax(invoice.source_type))
      return this.postPremiumInvoice(
        manager,
        invoice,
        sourceEventId,
        userId,
        true,
        reason,
      );
    return this.postJournal(
      manager,
      invoice.company_id,
      {
        sourceType: 'WRITE_OFF',
        sourceId: invoice.id,
        sourceEventId,
        description: `Invoice ${invoice.invoice_no} reversed: ${reason}`,
        currencyCode: invoice.currency,
        dimensions: invoice.finance_dimensions,
        branchId: invoice.branch_id,
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
        dimensions: receipt.finance_dimensions,
        branchId: receipt.branch_id,
        lines: [
          {
            accountCode: receipt.settlement_account_code ?? '1100',
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
        dimensions: receipt.finance_dimensions,
        branchId: receipt.branch_id,
        lines: [
          {
            accountCode: '1200',
            accountName: 'Premium Receivables',
            accountType: 'ASSET',
            customerId: receipt.customer_id,
            debit: receipt.amount,
          },
          {
            accountCode: receipt.settlement_account_code ?? '1100',
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
        currencyCode: String(
          accrual.commission_snapshot?.currencyCode ??
            accrual.invoice?.currency ??
            'TZS',
        ),
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
            accountType: refund.invoice_id ? 'ASSET' : 'LIABILITY',
            customerId: refund.customer_id,
            debit: refund.amount,
          },
          {
            accountCode: refund.settlement_account_code ?? '1100',
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
      settlementAccountCode?: string | null;
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
            accountCode: params.settlementAccountCode ?? '1100',
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
      settlementAccountCode?: string | null;
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
            accountCode: params.settlementAccountCode ?? '1100',
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
   * Posts cash received against a claim recovery (salvage, subrogation,
   * third-party). Recoveries are recognised on receipt only, so a write-off
   * needs no journal; the credit offsets claims cost as a contra-expense.
   */
  async postClaimRecoveryReceipt(
    manager: EntityManager,
    params: {
      companyId: string;
      recoveryId: string;
      recoveryNo: string;
      recoveryType: string;
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
        sourceType: 'CLAIM_RECOVERY_RECEIPT',
        sourceId: params.recoveryId,
        sourceEventId,
        description: `Claim recovery ${params.recoveryNo} (${params.recoveryType}) received`,
        currencyCode: params.currencyCode,
        lines: [
          {
            accountCode: '1100',
            accountName: 'Bank/Cash',
            accountType: 'ASSET',
            debit: params.amount,
          },
          {
            accountCode: '5300',
            accountName: 'Claim Recoveries',
            accountType: 'EXPENSE',
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
      settlementAccountCode?: string | null;
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
                accountCode: params.settlementAccountCode ?? '1100',
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
                accountCode: params.settlementAccountCode ?? '1100',
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
            accountCode: payment.settlement_account_code ?? '1100',
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
        currencyCode: String(
          accrual.commission_snapshot?.currencyCode ??
            accrual.invoice?.currency ??
            'TZS',
        ),
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
            accountCode: payment.settlement_account_code ?? '1100',
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
      dimensions?: Record<string, string> | null;
      branchId?: string | null;
    },
    userId: string | null,
  ) {
    // Serialize retries for the same source within the caller's transaction.
    // The unique database index remains the final protection against a caller
    // that bypasses this service or races a different application version.
    if (manager.queryRunner?.isTransactionActive) {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${companyId}:${params.sourceType}:${params.sourceEventId}`],
      );
    }
    const request = await this.operating?.prepare(
      manager,
      companyId,
      userId,
      params,
    );
    if (request) return request;
    for (const line of params.lines) {
      const debit = DecimalUtil.value(line.debit ?? 0);
      const credit = DecimalUtil.value(line.credit ?? 0);
      if (
        !debit.isFinite() ||
        !credit.isFinite() ||
        debit.isNegative() ||
        credit.isNegative() ||
        debit.decimalPlaces() > 4 ||
        credit.decimalPlaces() > 4 ||
        debit.greaterThanOrEqualTo('10000000000000000') ||
        credit.greaterThanOrEqualTo('10000000000000000') ||
        (debit.greaterThan(0) && credit.greaterThan(0))
      )
        throw new ConflictException({
          code: 'INVALID_FINANCE_JOURNAL_AMOUNT',
          message:
            'Journal amounts must be finite, nonnegative, one-sided and exactly representable in the existing numeric(20,4) ledger. No posting-time rounding is inferred.',
        });
    }
    const existing = await manager.getRepository(FinanceJournalEntry).findOne({
      where: {
        company_id: companyId,
        source_type: params.sourceType,
        source_event_id: params.sourceEventId,
      },
    });

    if (existing) {
      const fingerprint = params.lines.map((line) => ({
        accountCode: line.accountCode,
        ...(params.dimensions && Object.keys(params.dimensions).length
          ? { dimensions: params.dimensions }
          : {}),
        debit: DecimalUtil.value(line.debit ?? 0).toFixed(4),
        credit: DecimalUtil.value(line.credit ?? 0).toFixed(4),
        customerId: line.customerId ?? null,
        intermediaryCompanyId: line.intermediaryCompanyId ?? null,
      }));
      if (
        existing.source_id !== params.sourceId ||
        existing.currency_code !== params.currencyCode ||
        existing.entry_hash !==
          this.hashService.hashDefinition(
            fingerprint as unknown as Record<string, unknown>,
          )
      )
        throw new ConflictException({
          code: 'FINANCE_JOURNAL_SOURCE_CONFLICT',
          message:
            'A journal source-event identity was reused with a different source, currency or accounting vector. Reconciliation is required.',
        });
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

    if (!totalDebit.equals(totalCredit) || !totalDebit.greaterThan(0)) {
      throw new ConflictException({
        code: 'UNBALANCED_FINANCE_JOURNAL',
        message: 'Journal debit and credit totals do not balance.',
      });
    }

    const journalDate =
      (await this.postingPolicy.requireEligible(manager, {
        companyId,
        sourceType: params.sourceType,
        currency: params.currencyCode,
        accountMappings: params.lines.map((line) => ({
          code: line.accountCode,
          type: line.accountType,
        })),
      })) ?? new Date().toISOString().slice(0, 10);
    const dimensions = await this.operating?.legacyDimensions(
      manager,
      companyId,
      params,
      journalDate,
    );
    const journalNo = await this.identifierService.generateJournalNumber(
      companyId,
      manager,
    );
    // Resolve the entire mapping before saving any journal header or line.
    const accounts = new Map<string, FinanceAccount>();
    for (const line of params.lines)
      accounts.set(
        line.accountCode,
        await this.requireAccount(
          manager,
          companyId,
          line.accountCode,
          line.accountName,
          line.accountType,
        ),
      );

    const lineRepository = manager.getRepository(FinanceJournalLine);
    const linesForHash = params.lines.map((line) => ({
      accountCode: line.accountCode,
      ...(params.dimensions && Object.keys(params.dimensions).length
        ? { dimensions: params.dimensions }
        : {}),
      debit: DecimalUtil.value(line.debit ?? 0).toFixed(4),
      credit: DecimalUtil.value(line.credit ?? 0).toFixed(4),
      customerId: line.customerId ?? null,
      intermediaryCompanyId: line.intermediaryCompanyId ?? null,
    }));

    const entry = await manager.getRepository(FinanceJournalEntry).save({
      company_id: companyId,
      journal_no: journalNo,
      journal_date: journalDate,
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
      const account = accounts.get(line.accountCode)!;
      await lineRepository.save(
        lineRepository.create({
          journal_entry_id: entry.id,
          ...(dimensions ? { dimensions } : {}),
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

  private async postPremiumInvoice(
    manager: EntityManager,
    invoice: Invoice,
    eventId: string,
    userId: string | null,
    reverse: boolean,
    reason?: string,
  ) {
    const full = invoice.items
      ? invoice
      : await manager.getRepository(Invoice).findOne({
          where: { id: invoice.id, company_id: invoice.company_id },
          relations: { items: true },
        });
    const b = validatedPremiumInvoiceTax({
      ...invoice,
      items: full?.items ?? [],
    });
    const vector: JournalLineInput[] = [
      {
        accountCode: '1200',
        accountName: 'Premium Receivables',
        accountType: 'ASSET',
        customerId: invoice.customer_id,
        debit: b.total,
      },
      {
        accountCode: '4100',
        accountName: 'Gross Written Premium',
        accountType: 'INCOME',
        ...(DecimalUtil.value(b.net).isNegative()
          ? { debit: DecimalUtil.value(b.net).abs().toFixed(2) }
          : { credit: b.net }),
        description:
          'Premium excluding separately identified taxes, levies and fees',
      },
    ];
    for (const l of b.lines)
      for (const c of l.charges) {
        if (DecimalUtil.value(c.amount).isZero()) continue;
        if (!c.ledgerAccountCode)
          throw new ConflictException(
            `Posting account for ${c.code} is unresolved. Configure its catalogue mapping before posting.`,
          );
        vector.push({
          accountCode: c.ledgerAccountCode,
          accountName: c.name,
          accountType: ['TAX', 'LEVY', 'STAMP_DUTY'].includes(c.category)
            ? 'LIABILITY'
            : 'INCOME',
          ...(DecimalUtil.value(c.amount).isNegative()
            ? { debit: DecimalUtil.value(c.amount).abs().toFixed(2) }
            : { credit: c.amount }),
          description: `${c.code} | ${c.category} | rate ${c.rate} | base ${c.baseAmount} | ${l.sourceId}`,
        });
      }
    const lines = reverse
      ? vector.map((l) => ({ ...l, debit: l.credit, credit: l.debit }))
      : vector;
    return this.postJournal(
      manager,
      invoice.company_id,
      {
        sourceType: reverse ? 'WRITE_OFF' : 'INVOICE',
        sourceId: invoice.id,
        sourceEventId: eventId,
        description: reverse
          ? `Invoice ${invoice.invoice_no} reversed: ${reason}`
          : `Invoice ${invoice.invoice_no} issued`,
        currencyCode: invoice.currency,
        dimensions: invoice.finance_dimensions,
        branchId: invoice.branch_id,
        lines,
      },
      userId,
    );
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

    if (existing?.is_active && existing.account_type === accountType) {
      return existing;
    }
    throw new ConflictException({
      code: 'FINANCE_ACCOUNT_MAPPING_REQUIRED',
      message: `Active ${accountType} posting account ${accountCode} (${accountName}) is required. Accounts are never created by posting a transaction.`,
    });
  }
}
