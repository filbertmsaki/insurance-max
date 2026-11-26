import { ForbiddenException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from '../../accounting/general-ledger/finance-ledger-foundation.service';
import {
  FinanceGlVoucherService,
  workflowBook,
} from '../../accounting/general-ledger/finance-gl-voucher.service';
import {
  activePostingBook,
  bookChart,
  ownedEvidence,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import {
  verifyBankSettlement,
  type BankObservation,
} from '../../accounting/general-ledger/finance-bank-observation';
import { documentDimensionFields } from '../../foundation/finance-setup/finance-operating-dimensions';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import { InvoiceBalanceService } from '../outstanding-balances/invoice-balance.service';
import { FinanceCommandService } from '../payment-transactions/finance-command.service';
import { prepareAr } from './customer-account-documents';
import {
  accountReport,
  controlReport,
  matchStatement,
} from './customer-account-reports';
import { applyAr, checkFunds } from './customer-account-posting';
import {
  collectionEvent,
  sendDueReminders,
  type CollectionInput,
} from './customer-collections';
import {
  conflict,
  document,
  text,
  type ArDocument,
  type ArInput,
} from './customer-accounts.types';

@Injectable()
export class CustomerAccountsService {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly vouchers: FinanceGlVoucherService,
    private readonly balances: InvoiceBalanceService,
    private readonly commands: FinanceCommandService,
  ) {}
  private run<T>(
    a: FoundationActor,
    s: FinanceBookSelection,
    cap: 'READ' | 'PREPARE' | 'REVIEW',
    why: string,
    fn: (m: EntityManager, b: ActivePostingBook) => Promise<T>,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      cap,
      why,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s, cap === 'READ');
        if (b.book_role !== 'PRIMARY')
          conflict('Select the primary operating book for receivables.');
        return fn(m, b);
      },
    );
  }
  workspace(a: FoundationActor, s: FinanceBookSelection) {
    return this.run(a, s, 'READ', 'Read customer accounts', async (m, b) => {
      const customers = await m.query(
        "SELECT id,customer_no,coalesce(display_name,company_name,customer_no) label,EXISTS(SELECT 1 FROM users u WHERE u.id=customers.user_id AND u.status='active' AND u.deleted_at IS NULL) portal_enabled FROM customers WHERE company_id=$1 AND deleted_at IS NULL ORDER BY customer_no",
        [b.company_id],
      );
      const profiles = await m.query(
        `WITH latest AS (SELECT DISTINCT ON (customer_id,currency) * FROM finance_ar_documents
        WHERE book_id=$1 AND kind='PROFILE' AND state='APPROVED' AND effective_date<=(now() AT TIME ZONE $2)::date ORDER BY customer_id,currency,effective_date DESC,sequence DESC)
        SELECT p.customer_id,p.currency,p.effective_date::text,c.reference category,p.data->>'termCode' term,p.amount::text credit_limit,
        exposure.total::text outstanding,(p.amount-exposure.total)::text available FROM latest p JOIN finance_ar_documents c ON c.id=(p.data->>'categoryId')::uuid
        CROSS JOIN LATERAL(SELECT coalesce(sum(balance_amount),0) total FROM invoices i WHERE i.company_id=p.company_id AND i.customer_id=p.customer_id AND i.currency=p.currency AND i.deleted_at IS NULL AND i.status IN ('ISSUED','PARTIALLY_PAID'))exposure ORDER BY p.customer_id,p.currency`,
        [b.book_id, b.timezone],
      );
      const invoices = await m.query(
        "SELECT id,customer_id,invoice_no label,invoice_type,source_type,policy_id,endorsement_id,currency,status,due_date::text,total_amount,paid_amount,balance_amount FROM invoices WHERE company_id=$1 AND deleted_at IS NULL AND status IN ('ISSUED','PAID','PARTIALLY_PAID','OVERPAID') ORDER BY invoice_no DESC",
        [b.company_id],
      );
      const receipts = await m.query(
        "SELECT id,coalesce(payer_customer_id,customer_id) customer_id,receipt_no label,currency,amount,unallocated_amount,finance_ar_free_cash(id,NULL)::text available FROM receipts WHERE company_id=$1 AND deleted_at IS NULL AND status IN ('POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED') ORDER BY receipt_no DESC",
        [b.company_id],
      );
      const documents = await m.query(
        `SELECT d.*,d.effective_date::text,c.subject_hash candidate_hash,ar.state approval_state,pm.subject_hash memorandum_hash FROM finance_ar_documents d LEFT JOIN finance_ar_premium_memos pm ON pm.id=d.id LEFT JOIN finance_journal_candidates c ON c.id=d.candidate_id LEFT JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=c.id ORDER BY expires_at DESC,id DESC LIMIT 1)ar ON true WHERE d.book_id=$1 ORDER BY d.sequence DESC`,
        [b.book_id],
      );
      const cases = await m.query(
        'SELECT e.*,i.invoice_no FROM finance_ar_collection_events e JOIN invoices i ON i.id=e.invoice_id WHERE e.book_id=$1 ORDER BY e.created_at DESC,e.id DESC',
        [b.book_id],
      );
      const reminders = await m.query(
        'SELECT r.*,i.invoice_no FROM finance_ar_reminders r JOIN invoices i ON i.id=r.invoice_id WHERE r.book_id=$1 ORDER BY sent_at DESC',
        [b.book_id],
      );
      const staff = await m.query(
        "SELECT u.id,u.email label FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL ORDER BY u.email",
        [b.company_id],
      );
      const evidence = await m.query(
        "SELECT v.id,d.id document_id,d.title,v.sha256_hash hash FROM document_versions v JOIN documents d ON d.id=v.document_id AND v.company_id=d.company_id WHERE d.company_id=$1 AND v.status='AVAILABLE' AND d.status='AVAILABLE' AND (d.owner_type='COMPANY' AND d.owner_id=$1 OR d.owner_type='FINANCE_SETUP' AND d.owner_id=$2) ORDER BY d.title",
        [b.company_id, b.book_id],
      );
      const refunds = await m.query(
        'SELECT id,refund_no,customer_id,receipt_id,invoice_id,source_record_id,status,amount,currency_code FROM finance_refunds WHERE company_id=$1 ORDER BY requested_at DESC',
        [b.company_id],
      );
      const cashExceptions = await m.query(
        `SELECT r.receipt_no,f.invoice_id,finance_ar_free_cash(r.id,f.invoice_id)::text available FROM receipts r
        JOIN (SELECT DISTINCT receipt_id,invoice_id FROM finance_refunds WHERE company_id=$1 AND status IN ('REQUESTED','APPROVED','PAID')) f ON f.receipt_id=r.id
        WHERE r.company_id=$1 AND finance_ar_free_cash(r.id,f.invoice_id)<0 ORDER BY r.receipt_no`,
        [b.company_id],
      );
      return {
        customers,
        profiles,
        invoices,
        receipts,
        documents,
        cases,
        reminders,
        staff,
        evidence,
        refunds,
        cashExceptions,
        roles: (await bookChart(m, b)).roles,
        terms: (
          b.controls as unknown as {
            paymentTerms: { party: string; code: string; label: string }[];
          }
        ).paymentTerms.filter((t) => t.party === 'CUSTOMER'),
        currencies: Object.keys(b.context.currencyScales),
        dimensions: await documentDimensionFields(m, b.company_id, b.book_id),
        today: (
          await m.query('SELECT (now() AT TIME ZONE $1)::date::text today', [
            b.timezone,
          ])
        )[0].today,
      };
    });
  }
  submit(a: FoundationActor, s: FinanceBookSelection, input: ArInput) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Prepare customer document',
      async (m, b) => {
        const key = text(input?.requestKey, 'request key', 180),
          fingerprint = hash(input);
        const [old] = await m.query(
          'SELECT * FROM finance_ar_documents WHERE book_id=$1 AND request_key=$2',
          [b.book_id, key],
        );
        if (old) {
          if (
            old.request_hash !== fingerprint ||
            old.maker_id !== a.sourceUserId
          )
            conflict(
              'This request key belongs to different customer document details.',
            );
          return old;
        }
        const p = await prepareAr(m, b, input);
        if (['CREDIT_NOTE', 'DEBIT_NOTE'].includes(input.kind)) {
          const [duplicate] = await m.query(
            "SELECT 1 FROM finance_ar_documents WHERE company_id=$1 AND kind IN ('DEBIT_NOTE','CREDIT_NOTE') AND state NOT IN ('REJECTED','CANCELLED') AND (upper(reference)=upper($2) OR (invoice_id=$3 AND data->'evidence'->>'id'=$4) OR data->>'billingSourceId'=$5)",
            [
              b.company_id,
              p.data.reference,
              p.invoiceId,
              p.data.evidence!.id,
              p.data.billingSourceId ?? null,
            ],
          );
          if (duplicate)
            conflict('This adjustment already has a customer note.');
        }
        const [r] = await m.query(
          `INSERT INTO finance_ar_documents(book_id,company_id,kind,reference,request_key,request_hash,customer_id,invoice_id,receipt_id,related_id,currency,amount,effective_date,data,maker_id,maker_person)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *,effective_date::text`,
          [
            b.book_id,
            b.company_id,
            input.kind,
            p.data.reference,
            key,
            fingerprint,
            p.customer,
            p.invoiceId,
            p.receiptId,
            p.relatedId,
            input.currency,
            p.amount,
            input.date,
            p.data,
            a.sourceUserId,
            a.naturalPersonId,
          ],
        );
        await checkFunds(m, r);
        return r;
      },
    );
  }
  private async current(m: EntityManager, b: ActivePostingBook, r: ArDocument) {
    if (r.data.evidence) await ownedEvidence(m, b, r.data.evidence);
    if (r.kind === 'RECONCILIATION') {
      const report = await accountReport(
        m,
        b,
        r.data.from!,
        r.effective_date,
        r.currency,
        r.customer_id,
      );
      if (
        report.signature !== r.data.signature ||
        !matchStatement(r.data, report)
      )
        conflict('Customer statement changed. Submit a new reconciliation.');
    }
    if (r.kind === 'IMPAIRMENT' || r.kind === 'WRITE_OFF') {
      const now = await prepareAr(m, b, {
        ...r.data,
        invoiceId: r.invoice_id,
        customerId: r.customer_id,
        amount: r.amount,
        dimensions: r.data.lines[0].dimensions,
      });
      if (
        now.data.target !== r.data.target ||
        hash(now.data.lines) !== hash(r.data.lines)
      )
        conflict(
          'The invoice loss assessment changed. Prepare a new assessment.',
        );
    }
    await checkFunds(m, r);
  }
  review(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    decision: 'approve' | 'reject' | 'cancel',
    reason: string,
  ) {
    return this.run(
      a,
      s,
      decision === 'cancel' ? 'PREPARE' : 'REVIEW',
      text(reason, 'decision reason', 1000),
      async (m, b) => {
        const r = await document(m, b.book_id, id);
        const next =
          decision === 'approve'
            ? 'APPROVED'
            : decision === 'reject'
              ? 'REJECTED'
              : 'CANCELLED';
        if (decision === 'cancel') {
          if (
            r.maker_id !== a.sourceUserId ||
            r.maker_person !== a.naturalPersonId
          )
            throw new ForbiddenException(
              'Only the preparer can withdraw this document.',
            );
          if (r.state === next) return r;
          const rejected =
            r.candidate_id &&
            (
              await m.query(
                'SELECT state FROM finance_approval_requests WHERE candidate_id=$1 ORDER BY expires_at DESC,id DESC LIMIT 1',
                [r.candidate_id],
              )
            )[0]?.state === 'REJECTED_INACTIVE';
          if (
            r.state !== 'PENDING' &&
            !(
              r.state === 'APPROVED' &&
              (!r.candidate_id || rejected) &&
              ![
                'CATEGORY',
                'POLICY',
                'PROFILE',
                'PAYER_MANDATE',
                'RECONCILIATION',
              ].includes(r.kind)
            )
          )
            conflict(
              'Withdraw a pending request or an unposted financial document.',
            );
          if (r.candidate_id && r.kind === 'CREDIT_REFUND')
            conflict(
              'A bank-confirmed refund must finish the GL approval workflow.',
            );
          await m.query(
            "UPDATE finance_ar_documents SET state='CANCELLED',review_reason=$2 WHERE id=$1",
            [id, reason],
          );
        } else {
          if (
            r.maker_id === a.sourceUserId ||
            r.maker_person === a.naturalPersonId
          )
            throw new ForbiddenException(
              'An independent person must review this document.',
            );
          if (
            r.state === next ||
            (decision === 'approve' && r.state === 'POSTED')
          )
            return r;
          if (r.state !== 'PENDING')
            conflict('This customer document already has a decision.');
          if (decision === 'approve') {
            if (DecimalUtil.value(r.amount).gt(0)) {
              const [limit] = await m.query(
                `SELECT l.id FROM finance_approval_mandates l JOIN finance_approval_mandates root ON root.id=coalesce(l.delegated_from_id,l.id)
              AND (root.tenant_id,root.legal_entity_id,root.book_id,root.role_code,root.currency)=(l.tenant_id,l.legal_entity_id,l.book_id,l.role_code,l.currency)
              WHERE l.tenant_id=$1 AND l.legal_entity_id=$2 AND l.book_id=$3 AND l.subject_id=$4 AND l.natural_person_id=$5 AND l.currency=$6 AND l.max_amount>=$7
              AND l.state='ENABLED' AND root.state='ENABLED' AND l.revoked_at IS NULL AND root.revoked_at IS NULL AND l.valid_from<=now() AND(l.valid_to IS NULL OR l.valid_to>now())
              AND root.delegated_from_id IS NULL AND root.max_amount>=l.max_amount AND root.valid_from<=l.valid_from AND(root.valid_to IS NULL OR root.valid_to>=l.valid_to)
              AND root.natural_person_id<>$8 FOR SHARE OF l,root`,
                [
                  a.tenantId,
                  s.legalEntityId,
                  s.bookId,
                  a.subjectId,
                  a.naturalPersonId,
                  r.currency,
                  r.amount,
                  r.maker_person,
                ],
              );
              if (!limit)
                throw new ForbiddenException(
                  'The customer document exceeds the independent reviewer mandate.',
                );
            }
            if (r.kind === 'PROFILE')
              await m.query(
                'SELECT id FROM customers WHERE id=$1 AND company_id=$2 FOR UPDATE',
                [r.customer_id, b.company_id],
              );
            await this.current(m, b, r);
          }
          await m.query(
            'UPDATE finance_ar_documents SET state=$1,reviewer_id=$2,reviewer_person=$3,review_reason=$4,reviewed_at=now() WHERE id=$5',
            [next, a.sourceUserId, a.naturalPersonId, reason, id],
          );
        }
        return document(m, b.book_id, id);
      },
    );
  }
  post(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    bank?: BankObservation,
  ) {
    return this.run(a, s, 'PREPARE', 'Post customer document', async (m, b) => {
      const r = await document(m, b.book_id, id);
      if (r.maker_id !== a.sourceUserId || r.maker_person !== a.naturalPersonId)
        throw new ForbiddenException(
          'The preparer must submit the approved document.',
        );
      if (r.state === 'POSTED' || (r.candidate_id && r.state === 'APPROVED'))
        return r;
      if (
        r.state !== 'APPROVED' ||
        [
          'CATEGORY',
          'POLICY',
          'PROFILE',
          'PAYER_MANDATE',
          'RECONCILIATION',
        ].includes(r.kind)
      )
        conflict('Post an independently approved financial transaction.');
      await this.current(m, b, r);
      const v = {
        reference: 'AR-' + r.sequence,
        date: r.effective_date,
        currency: r.currency,
        description: r.kind + ' ' + r.reference,
        lines: r.data.lines,
        evidence: r.data.evidence!,
      };
      if (r.kind === 'CREDIT_REFUND') {
        const verified = await verifyBankSettlement(
          m,
          {
            kind: 'AR_CREDIT_REFUND',
            id: r.id,
            companyId: r.company_id,
            beneficiaryId: r.customer_id,
            reference: v.reference,
            account: r.data.bankAccount!,
            currency: r.currency,
            amount: r.amount,
          },
          bank,
        );
        const [local] = await m.query(
          'SELECT ($1::timestamptz AT TIME ZONE $2)::date::text AS day',
          [verified.paidAt, b.timezone],
        );
        if (
          verified.paidAt < new Date(r.reviewed_at) ||
          local.day !== r.effective_date
        )
          conflict(
            'The signed settlement must follow approval and match the posting date.',
          );
      }
      let candidate: { id: string } | undefined;
      if (r.kind === 'REVERSAL') {
        const original = await document(m, b.book_id, r.related_id);
        if (original.journal_id)
          candidate = await this.vouchers.reverse(
            a,
            s,
            original.journal_id,
            v,
            { manager: m, originalArId: original.id, arDocumentId: r.id },
          );
      } else if (v.lines.length)
        candidate = await this.vouchers.issue(
          m,
          a,
          b,
          'MANUAL',
          v,
          'ar:' + r.id,
          { arDocumentId: r.id },
        );
      if (candidate)
        await m.query(
          'UPDATE finance_ar_documents SET candidate_id=$2 WHERE id=$1',
          [id, candidate.id],
        );
      else await applyAr(m, r, null, this.balances, this.commands);
      return document(m, b.book_id, id);
    });
  }
  async posted(
    m: EntityManager,
    book: string,
    id: string,
    candidate: string,
    journal: string,
  ) {
    const r = await document(m, book, id);
    if (r.candidate_id !== candidate)
      conflict('The journal belongs to a different customer document.');
    const b = await activePostingBook(m, r.company_id, 'UPDATE', book);
    if (!b) conflict('This operating book is inactive.');
    await this.current(m, b, r);
    await applyAr(m, r, journal, this.balances, this.commands);
  }
  reports(
    a: FoundationActor,
    s: FinanceBookSelection,
    q: { from: string; to: string; currency: string; customer?: string },
  ) {
    return this.run(
      a,
      s,
      'READ',
      'Read customer statement and aging',
      async (m, b) => ({
        ...(await accountReport(m, b, q.from, q.to, q.currency, q.customer)),
        control: await controlReport(m, b, q.currency, q.to),
      }),
    );
  }
  collect(a: FoundationActor, s: FinanceBookSelection, input: CollectionInput) {
    return this.run(a, s, 'PREPARE', 'Record collection activity', (m, b) =>
      collectionEvent(m, b, a.sourceUserId!, input),
    );
  }
  remind(a: FoundationActor, s: FinanceBookSelection) {
    return this.run(a, s, 'PREPARE', 'Deliver due customer reminders', (m, b) =>
      sendDueReminders(m, b),
    );
  }
}
