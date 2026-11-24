import { Injectable } from '@nestjs/common';
import { QuotationFinanceEvent } from '@insurance-max/contracts';
import { EntityManager } from 'typeorm';

import { FinancePostingPolicyService } from '../../accounting/posting-rules/finance-posting-policy.service';
import { QuotationPaymentEventService } from '../quotation-finance/quotation-payment-event.service';

/**
 * Versioned Finance outbox contracts and their consumers.
 *
 * Every existing producer posts its journal inside the originating command's
 * transaction (FinanceJournalService, behind the posting-policy gate). The
 * invoice and commission consumers therefore never post: they verify that the
 * source record and its journal exist and record that as the accounting
 * outcome. A missing journal is reported (BLOCKED), never created here.
 *
 * Legacy rows carry no version and are schema version 1; keys and payloads
 * are unchanged from the producers.
 */

export type FailureClass =
  | 'TRANSIENT'
  | 'PERMANENT'
  | 'UNSUPPORTED'
  | 'SCOPE_MISMATCH'
  | 'POLICY_BLOCKED'
  | 'MISSING_JOURNAL'
  | 'OUTCOME_CONFLICT'
  | 'RETRY_EXHAUSTED';

/** A failure that retrying cannot fix: dead-lettered on first occurrence. */
export class PermanentEventError extends Error {
  constructor(
    readonly failureClass: Exclude<
      FailureClass,
      'TRANSIENT' | 'RETRY_EXHAUSTED' | 'POLICY_BLOCKED' | 'MISSING_JOURNAL'
    >,
    message: string,
  ) {
    super(message);
  }
}

export type BusinessOutcome =
  | 'APPLIED'
  | 'NO_CHANGE'
  | 'SKIPPED_STALE_REVISION'
  | 'NOT_APPLICABLE'
  | 'BLOCKED';

export type AccountingOutcome =
  | 'RECOGNIZED_BY_SOURCE_COMMAND'
  | 'NOT_REQUIRED'
  | 'NOT_APPLICABLE'
  | 'POLICY_BLOCKED'
  | 'MISSING_JOURNAL';

export interface EventOutcome {
  sourceType: string;
  sourceId: string;
  sourceRevision: string | null;
  operation: string;
  businessOutcome: BusinessOutcome;
  businessReference: string | null;
  accountingOutcome: AccountingOutcome;
  accountingReference: string | null;
  detail: string | null;
}

export interface OutboxEventRow {
  id: string;
  company_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_key: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export interface FinanceEventContract {
  eventType: string;
  schemaVersions: number[];
  consumer: string;
  role: 'ACCOUNTING_VERIFICATION' | 'BUSINESS_PROJECTION';
  /** Stable key for the intended operation; one outcome per key. */
  idempotencyKey(event: OutboxEventRow): string;
  consume(event: OutboxEventRow, manager: EntityManager): Promise<EventOutcome>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new PermanentEventError(
      'PERMANENT',
      `FINANCE_EVENT_INVALID_PAYLOAD: ${field} must be a UUID`,
    );
  }
  return value;
}

function sameAmount(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  return (
    Number.isFinite(x) && Number.isFinite(y) && x.toFixed(4) === y.toFixed(4)
  );
}

@Injectable()
export class FinanceEventContractRegistry {
  private readonly contracts: Map<string, FinanceEventContract>;

  constructor(
    private readonly quotationPaymentEventService: QuotationPaymentEventService,
    private readonly postingPolicy: FinancePostingPolicyService = new FinancePostingPolicyService(),
  ) {
    this.contracts = new Map(
      [
        this.invoiceIssued(),
        this.invoiceVoided(),
        this.commissionAccrued(),
        this.quotationPayment(),
      ].map((contract) => [contract.eventType, contract]),
    );
  }

  get(eventType: string): FinanceEventContract | undefined {
    return this.contracts.get(eventType);
  }

  list(): FinanceEventContract[] {
    return [...this.contracts.values()];
  }

  // ---------------------------------------------------------------------------

  private invoiceIssued(): FinanceEventContract {
    return {
      eventType: 'INVOICE_ISSUED',
      schemaVersions: [1],
      consumer: 'invoice-recognition-verifier',
      role: 'ACCOUNTING_VERIFICATION',
      idempotencyKey: (event) =>
        `invoice:${requireUuid(event.payload.invoiceId, 'invoiceId')}:issued`,
      consume: async (event, manager) => {
        const invoice = await this.loadInvoice(event, manager);
        if (
          !sameAmount(event.payload.amount, invoice.total_amount) ||
          event.payload.currencyCode !== invoice.currency
        ) {
          throw new PermanentEventError(
            'OUTCOME_CONFLICT',
            'FINANCE_EVENT_SOURCE_CONFLICT: event amount or currency differs from the invoice',
          );
        }
        if (!invoice.issued_at) {
          throw new PermanentEventError(
            'OUTCOME_CONFLICT',
            'FINANCE_EVENT_SOURCE_CONFLICT: invoice has no issue record',
          );
        }
        const revision =
          event.payload.sourceRevision == null
            ? null
            : String(event.payload.sourceRevision);
        return this.verifyJournal(manager, {
          companyId: event.company_id,
          journalSourceType: 'INVOICE',
          currency: invoice.currency,
          base: {
            sourceType: 'INVOICE',
            sourceId: invoice.id,
            sourceRevision: revision,
            operation: 'INVOICE_ISSUE',
            businessReference: invoice.invoice_no,
          },
        });
      },
    };
  }

  private invoiceVoided(): FinanceEventContract {
    return {
      eventType: 'INVOICE_VOIDED',
      schemaVersions: [1],
      consumer: 'invoice-recognition-verifier',
      role: 'ACCOUNTING_VERIFICATION',
      idempotencyKey: (event) =>
        `invoice:${requireUuid(event.payload.invoiceId, 'invoiceId')}:voided`,
      consume: async (event, manager) => {
        const invoice = await this.loadInvoice(event, manager);
        if (invoice.status !== 'VOIDED') {
          throw new PermanentEventError(
            'OUTCOME_CONFLICT',
            `FINANCE_EVENT_SOURCE_CONFLICT: invoice is ${invoice.status}, not VOIDED`,
          );
        }
        const base = {
          sourceType: 'INVOICE',
          sourceId: invoice.id,
          sourceRevision: null,
          operation: 'INVOICE_VOID',
          businessReference: invoice.invoice_no,
        };
        if (!invoice.issued_at) {
          // A draft void never had a receivable to reverse.
          return {
            ...base,
            businessOutcome: 'APPLIED',
            accountingOutcome: 'NOT_REQUIRED',
            accountingReference: null,
            detail: 'Draft invoice voided; no journal was recognised.',
          };
        }
        return this.verifyJournal(manager, {
          companyId: event.company_id,
          journalSourceType: 'WRITE_OFF',
          currency: invoice.currency,
          base,
        });
      },
    };
  }

  private commissionAccrued(): FinanceEventContract {
    return {
      eventType: 'COMMISSION_ACCRUED',
      schemaVersions: [1],
      consumer: 'commission-recognition-verifier',
      role: 'ACCOUNTING_VERIFICATION',
      idempotencyKey: (event) =>
        `commission-accrual:${requireUuid(event.aggregate_id, 'aggregateId')}:accrued`,
      consume: async (event, manager) => {
        const [accrual] = await manager.query(
          `SELECT id, accrual_no, commission_amount
             FROM commission_transactions
            WHERE id = $1 AND company_id = $2`,
          [event.aggregate_id, event.company_id],
        );
        if (!accrual) {
          throw new PermanentEventError(
            'SCOPE_MISMATCH',
            'FINANCE_EVENT_SOURCE_NOT_FOUND: commission accrual not found in event company',
          );
        }
        if (
          !sameAmount(event.payload.commissionAmount, accrual.commission_amount)
        ) {
          throw new PermanentEventError(
            'OUTCOME_CONFLICT',
            'FINANCE_EVENT_SOURCE_CONFLICT: event commission amount differs from the accrual',
          );
        }
        return this.verifyJournal(manager, {
          companyId: event.company_id,
          journalSourceType: 'COMMISSION_ACCRUAL',
          currency:
            typeof event.payload.currencyCode === 'string'
              ? event.payload.currencyCode
              : 'TZS',
          base: {
            sourceType: 'COMMISSION_ACCRUAL',
            sourceId: accrual.id,
            sourceRevision:
              event.payload.workflowRevision == null
                ? null
                : String(event.payload.workflowRevision),
            operation: 'COMMISSION_ACCRUE',
            businessReference: accrual.accrual_no ?? null,
          },
        });
      },
    };
  }

  private quotationPayment(): FinanceEventContract {
    return {
      eventType: 'QUOTATION_PAYMENT_EVENT',
      schemaVersions: [1],
      consumer: 'quotation-payment-projection',
      role: 'BUSINESS_PROJECTION',
      idempotencyKey: (event) => {
        const eventId = event.payload.eventId;
        if (typeof eventId !== 'string' || !eventId.trim()) {
          throw new PermanentEventError(
            'PERMANENT',
            'FINANCE_EVENT_INVALID_PAYLOAD: eventId is required',
          );
        }
        return `quotation-payment:${eventId}`;
      },
      consume: async (event, manager) => {
        if (
          typeof event.payload.companyId !== 'string' ||
          event.payload.companyId !== event.company_id
        ) {
          throw new PermanentEventError(
            'SCOPE_MISMATCH',
            'FINANCE_OUTBOX_COMPANY_SCOPE_MISMATCH',
          );
        }
        const payload = event.payload as unknown as QuotationFinanceEvent;
        const result = await this.quotationPaymentEventService.apply(
          payload,
          manager,
        );
        return {
          sourceType: 'QUOTATION',
          sourceId:
            typeof payload.quotationId === 'string' &&
            UUID.test(payload.quotationId)
              ? payload.quotationId
              : event.aggregate_id,
          sourceRevision:
            payload.workflowRevision == null
              ? null
              : String(payload.workflowRevision),
          operation: `QUOTATION_${payload.eventType ?? 'PAYMENT'}`.slice(0, 60),
          // apply() returns null when the event is stale or carries no state.
          businessOutcome: result ? 'APPLIED' : 'NO_CHANGE',
          businessReference:
            typeof payload.invoiceId === 'string' ? payload.invoiceId : null,
          // Payment projection is not accounting: receipts post their own journals.
          accountingOutcome: 'NOT_APPLICABLE',
          accountingReference: null,
          detail: null,
        };
      },
    };
  }

  // ---------------------------------------------------------------------------

  private async loadInvoice(event: OutboxEventRow, manager: EntityManager) {
    const invoiceId = requireUuid(event.payload.invoiceId, 'invoiceId');
    if (invoiceId !== event.aggregate_id) {
      throw new PermanentEventError(
        'OUTCOME_CONFLICT',
        'FINANCE_EVENT_SOURCE_CONFLICT: payload invoice differs from aggregate',
      );
    }
    const [invoice] = await manager.query(
      `SELECT id, invoice_no, status, total_amount, currency, issued_at
         FROM invoices WHERE id = $1 AND company_id = $2`,
      [invoiceId, event.company_id],
    );
    if (!invoice) {
      throw new PermanentEventError(
        'SCOPE_MISMATCH',
        'FINANCE_EVENT_SOURCE_NOT_FOUND: invoice not found in event company',
      );
    }
    return invoice as {
      id: string;
      invoice_no: string | null;
      status: string;
      total_amount: string;
      currency: string;
      issued_at: Date | null;
    };
  }

  /**
   * Records the journal the source command posted. If none exists, the event
   * is BLOCKED: POLICY_BLOCKED when the posting gate currently holds this
   * source, otherwise MISSING_JOURNAL. Nothing is posted here.
   */
  private async verifyJournal(
    manager: EntityManager,
    params: {
      companyId: string;
      journalSourceType: string;
      currency: string;
      base: Pick<
        EventOutcome,
        | 'sourceType'
        | 'sourceId'
        | 'sourceRevision'
        | 'operation'
        | 'businessReference'
      >;
    },
  ): Promise<EventOutcome> {
    const [journal] = await manager.query(
      `SELECT id FROM finance_journal_entries
        WHERE company_id = $1 AND source_type = $2 AND source_id = $3
        ORDER BY created_at ASC LIMIT 1`,
      [params.companyId, params.journalSourceType, params.base.sourceId],
    );
    if (journal) {
      return {
        ...params.base,
        businessOutcome: 'APPLIED',
        accountingOutcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
        accountingReference: journal.id,
        detail: null,
      };
    }

    const [schema] = await manager.query(
      "SELECT to_regclass('public.finance_operating_postings') IS NOT NULL deployed",
    );
    if (schema?.deployed) {
      const [canonical] = await manager.query(
        `SELECT p.candidate_id,j.id FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
        WHERE p.company_id=$1 AND p.source_type=$2 AND p.source_id=$3`,
        [params.companyId, params.journalSourceType, params.base.sourceId],
      );
      if (canonical)
        return {
          ...params.base,
          businessOutcome: canonical.id ? 'APPLIED' : 'BLOCKED',
          accountingOutcome: canonical.id
            ? 'RECOGNIZED_BY_SOURCE_COMMAND'
            : 'POLICY_BLOCKED',
          accountingReference: canonical.id ?? null,
          detail: canonical.id
            ? null
            : 'The accounting request awaits independent journal approval.',
        };
    }
    let policyHold: string | null = null;
    await manager.query('SAVEPOINT finance_event_policy_probe');
    try {
      await this.postingPolicy.requireEligible(manager, {
        companyId: params.companyId,
        sourceType: params.journalSourceType,
        currency: params.currency,
        date: new Date().toISOString().slice(0, 10),
        accountMappings: [],
      });
      await manager.query('RELEASE SAVEPOINT finance_event_policy_probe');
    } catch (error) {
      await manager.query('ROLLBACK TO SAVEPOINT finance_event_policy_probe');
      const response = (error as { response?: { code?: string } })?.response;
      policyHold =
        response?.code === 'FINANCE_POSTING_HELD'
          ? ((error as Error).message ?? 'FINANCE_POSTING_HELD')
          : null;
    }
    return {
      ...params.base,
      businessOutcome: 'BLOCKED',
      accountingOutcome: policyHold ? 'POLICY_BLOCKED' : 'MISSING_JOURNAL',
      accountingReference: null,
      detail: policyHold
        ? `No journal; posting policy holds ${params.journalSourceType}.`
        : `No ${params.journalSourceType} journal found for the source record.`,
    };
  }
}
