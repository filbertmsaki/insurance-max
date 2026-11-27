import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from '../accounting/general-ledger/finance-ledger-foundation.service';
import {
  FinanceGlVoucherService,
  workflowBook,
} from '../accounting/general-ledger/finance-gl-voucher.service';
import {
  activePostingBook,
  bookChart,
  ownedEvidence,
} from '../accounting/general-ledger/finance-book-request';
import { financeConfigurationHash as hash } from '../foundation/finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../foundation/finance-configuration/finance-scope.service';
import { documentDimensionFields } from '../foundation/finance-setup/finance-operating-dimensions';
import { CASH_BANK_GROUPS } from '@insurance-max/contracts';
import {
  account,
  conflict,
  denied,
  doc,
  field,
  validateInput,
  uuid,
  journalKinds,
  type Context,
  type Document,
  type Input,
} from './cash-bank.types';
import { cutover, setupOrShift } from './cash-bank-setup';
import { isDuplicateEntryError } from '@insurance-max/portal-shared/utils/db-error.util';
import {
  channelOperation,
  finishMovement,
  openEft,
  payableInstruction,
  prepareMovement,
} from './cash-bank-movements';
import {
  reconciliationSummary,
  statementOperation,
} from './cash-bank-statements';
import { forecast, plan, positions } from './cash-bank-reports';

@Injectable()
export class CashBankService {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly vouchers: FinanceGlVoucherService,
  ) {}
  private run<T>(
    a: FoundationActor,
    s: FinanceBookSelection,
    cap: 'READ' | 'PREPARE' | 'REVIEW',
    why: string,
    fn: (c: Context) => Promise<T>,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      cap,
      why,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s, cap === 'READ');
        if (b.book_role !== 'PRIMARY')
          conflict('Choose the active primary cash and bank book.');
        try {
          return await fn({ m, b, a });
        } catch (e) {
          if (isDuplicateEntryError(e))
            conflict(
              'The reference, account or transaction is already registered. Review its existing record.',
            );
          throw e;
        }
      },
    );
  }
  workspace(a: FoundationActor, s: FinanceBookSelection) {
    return this.run(
      a,
      s,
      'READ',
      'Read the cash and bank workspace',
      async (c) => {
        const { m, b } = c;
        const [{ today }] = await m.query(
          'SELECT (now() AT TIME ZONE $1)::date::text today',
          [b.timezone],
        );
        const docs = await m.query(
          `SELECT d.id,d.sequence,d.kind,d.reference,d.day::text,d.state,d.maker_id,d.reviewer_id,d.reason,d.candidate_id,d.journal_id,c.subject_hash candidate_hash,
        d.input->'fields'->>'target' target,d.input->'fields'->>'apVoucher' ap_voucher,d.input->'fields'->>'account' account_id
        FROM finance_cb_documents d LEFT JOIN finance_journal_candidates c ON c.id=d.candidate_id WHERE d.book_id=$1 ORDER BY sequence DESC`,
          [b.book_id],
        );
        const evidence = await m.query(
          "SELECT v.id,d.id AS \"documentId\",d.title,v.sha256_hash hash FROM document_versions v JOIN documents d ON d.id=v.document_id AND d.company_id=v.company_id WHERE d.company_id=$1 AND v.status='AVAILABLE' AND d.status='AVAILABLE' AND ((d.owner_type='COMPANY' AND d.owner_id=$1) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$2)) ORDER BY d.title",
          [b.company_id, b.book_id],
        );
        const staff = await m.query(
          "SELECT u.id value,u.email label FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL ORDER BY u.email",
          [b.company_id],
        );
        const statements = await m.query(
          'SELECT s.id,s.account_id,s.starts::text,s.ends::text,s.opening,s.closing,s.withdrawn_id,s.signoff_id FROM finance_cb_statements s JOIN finance_cb_accounts a ON a.id=s.account_id WHERE a.book_id=$1 ORDER BY s.ends DESC,s.withdrawn_id NULLS FIRST',
          [b.book_id],
        );
        return {
          today,
          currency: b.context.functionalCurrency,
          currencies: Object.keys(b.context.currencyScales),
          roles: (await bookChart(m, b)).roles,
          dimensions: await documentDimensionFields(m, b.company_id, b.book_id),
          evidence,
          staff,
          documents: docs,
          accounts: await positions(c, today),
          masters: await m.query(
            'SELECT * FROM finance_cb_masters WHERE book_id=$1 ORDER BY kind,code',
            [b.book_id],
          ),
          rules: await m.query(
            'SELECT r.*,r.decision_id id FROM finance_cb_rules r JOIN finance_cb_accounts a ON a.id=r.account_id WHERE a.book_id=$1 ORDER BY a.code,r.pattern',
            [b.book_id],
          ),
          statements,
          eftProofs: await m.query(
            'SELECT p.id,p.eft_id,p.voucher_id,p.line_id,p.entry_id FROM finance_cb_ap_proofs p WHERE p.book_id=$1 AND released_id IS NULL',
            [b.book_id],
          ),
          planEntries: await m.query(
            'SELECT plan_id,entry_id,day::text,amount FROM finance_cb_plan_entries($1,$2)',
            [b.book_id, today],
          ),
          payables: await m.query(
            "SELECT v.id,v.reference,v.amount,v.currency,a.id account_id FROM finance_ap_status v JOIN finance_cb_accounts a ON a.book_id=v.book_id AND a.account_code=v.data->>'bankAccount' AND a.kind='BANK' AND a.currency=v.currency WHERE v.book_id=$1 AND v.status='APPROVED' AND v.kind IN ('PAYMENT','IMPREST','ADVANCE') AND v.data->>'bankId' IS NOT NULL ORDER BY v.due_date,v.reference",
            [b.book_id],
          ),
          shifts: await m.query(
            'SELECT s.*,s.day::text,a.code FROM finance_cb_shifts s JOIN finance_cb_accounts a ON a.id=s.account_id WHERE a.book_id=$1 ORDER BY s.day DESC',
            [b.book_id],
          ),
          counts: await m.query(
            'SELECT x.*,a.code FROM finance_cb_counts x JOIN finance_cb_shifts s ON s.id=x.shift_id JOIN finance_cb_accounts a ON a.id=s.account_id WHERE a.book_id=$1',
            [b.book_id],
          ),
          cashiers: await m.query(
            'SELECT x.* FROM finance_cb_cashiers x JOIN finance_cb_accounts a ON a.id=x.account_id WHERE a.book_id=$1',
            [b.book_id],
          ),
          cheques: await m.query(
            'SELECT ch.*,d.reference FROM finance_cb_cheques ch JOIN finance_cb_documents d ON d.id=ch.id WHERE d.book_id=$1 ORDER BY d.sequence DESC',
            [b.book_id],
          ),
          transfers: await m.query(
            'SELECT t.*,d.reference FROM finance_cb_transfers t JOIN finance_cb_documents d ON d.id=t.id WHERE d.book_id=$1 ORDER BY d.sequence DESC',
            [b.book_id],
          ),
          entries: await m.query(
            `SELECT e.*,e.day::text,a.code,a.currency,x.line_id,t.entry_id IS NOT NULL documented,j.journal_no,op.source_type,op.source_id,op.snapshot->>'apDocumentId' ap_document_id
          FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id LEFT JOIN finance_cb_matches x ON x.entry_id=e.id LEFT JOIN finance_cb_timing t ON t.entry_id=e.id LEFT JOIN finance_foundation_journals j ON j.id=e.journal_id LEFT JOIN finance_operating_postings op ON op.candidate_id=j.candidate_id WHERE a.book_id=$1 ORDER BY e.day DESC,e.id`,
            [b.book_id],
          ),
          lines: await m.query(
            `SELECT l.*,l.day::text,s.account_id,s.signoff_id,(x.entries)[1] entry_id,cardinality(x.entries) match_count,p.id proof_id FROM finance_cb_statement_lines l JOIN finance_cb_statements s ON s.id=l.statement_id JOIN finance_cb_accounts a ON a.id=s.account_id LEFT JOIN LATERAL (SELECT array_agg(mx.entry_id ORDER BY mx.entry_id) entries FROM finance_cb_matches mx WHERE mx.line_id=l.id)x ON true LEFT JOIN finance_cb_ap_proofs p ON p.line_id=l.id AND p.released_id IS NULL WHERE a.book_id=$1 AND s.withdrawn_id IS NULL ORDER BY s.ends DESC,l.ordinal`,
            [b.book_id],
          ),
        };
      },
    );
  }
  detail(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'READ',
      'Read cash document and evidence',
      async (c) => {
        const r = await doc(c, id);
        if (r.kind === 'EFT_VERIFY') {
          const [eft] = await c.m.query(
            "SELECT eft_export FROM finance_cb_documents WHERE book_id=$1 AND id::text=lower($2) AND kind='EFT' AND state='POSTED'",
            [s.bookId, r.input.fields.target ?? ''],
          );
          return { ...r, approved_eft: eft?.eft_export };
        }
        if (r.kind !== 'STATEMENT') return r;
        const [archived] = await c.m.query(
          'SELECT archived_lines FROM finance_cb_statements WHERE id=$1 AND withdrawn_id IS NOT NULL',
          [id],
        );
        return archived ? { ...r, archived_lines: archived.archived_lines } : r;
      },
    );
  }
  cutover(
    a: FoundationActor,
    s: FinanceBookSelection,
    role: string,
    currency: string,
    day: string,
  ) {
    return this.run(a, s, 'READ', 'Check cash account cutover', (c) =>
      cutover(c, role, currency, day),
    );
  }
  report(
    a: FoundationActor,
    s: FinanceBookSelection,
    from: string,
    to: string,
  ) {
    return this.run(a, s, 'READ', 'Read cash flow forecast', (c) =>
      forecast(c, from, to),
    );
  }
  summary(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(a, s, 'READ', 'Compare bank statement to ledger', (c) =>
      reconciliationSummary(c, id),
    );
  }
  instruction(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Export approved EFT instruction',
      async (c) => {
        const r = await openEft(c, id);
        if (r.input.fields.apVoucher)
          await payableInstruction(c, r.input.fields);
        if (!r.eft_export)
          conflict(
            'Withdraw and reapprove this EFT to establish the payment instructions.',
          );
        const snapshot = r.eft_export!;
        return Object.fromEntries(
          [
            'instructionId',
            'reference',
            'date',
            'source',
            'sourceBank',
            'sourceAccountName',
            'sourceAccountNumber',
            'currency',
            'amount',
            'payee',
            'bank',
            'beneficiary',
          ].map((key) => [key, snapshot[key]]),
        );
      },
    );
  }
  submit(a: FoundationActor, s: FinanceBookSelection, v: Input) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Prepare cash or bank document',
      async (c) => {
        validateInput(v);
        const digest = hash(v),
          { m, b } = c;
        const [old] = await m.query(
          'SELECT * FROM finance_cb_documents WHERE book_id=$1 AND request_key=$2',
          [s.bookId, v.requestKey],
        );
        if (old) {
          if (old.request_hash !== digest || old.maker_id !== a.sourceUserId)
            conflict('This request key is in use for a different document.');
          return old;
        }
        if (
          v.evidence ||
          journalKinds.includes(v.kind) ||
          [
            'ACCOUNT',
            'WITHDRAW_STATEMENT',
            'EFT_VERIFY',
            'EFT_RELEASE',
            'RETIRE_LEAF',
            'STATEMENT',
            'TIMING',
            'SIGNOFF',
            'EFT',
            'REPLENISH',
            'CLOSE',
            'COUNT',
          ].includes(v.kind)
        )
          await ownedEvidence(m, b, v.evidence);
        if (v.kind === 'STATEMENT') {
          const replaces = v.fields.replaces ? uuid(v.fields.replaces) : null;
          const [used] = await m.query(
            `SELECT d.id FROM finance_cb_documents d LEFT JOIN finance_cb_statements st ON st.id=d.id
            WHERE d.book_id=$1 AND d.kind='STATEMENT' AND upper(d.reference)=upper($2) AND d.state IN ('PENDING','POSTED')
            AND st.withdrawn_id IS NULL AND d.id IS DISTINCT FROM $3::uuid`,
            [b.book_id, v.reference.trim(), replaces],
          );
          if (used)
            conflict(
              'This statement reference is in use. Select the unsigned statement to replace.',
            );
        }
        if (v.kind === 'EFT' && v.fields.apVoucher)
          v = { ...v, fields: await payableInstruction(c, v.fields) };
        const [r] = await m.query(
          `INSERT INTO finance_cb_documents(book_id,company_id,kind,reference,day,input,request_key,request_hash,maker_id,maker_person) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *,day::text`,
          [
            s.bookId,
            b.company_id,
            v.kind,
            v.reference.trim(),
            v.date,
            v,
            v.requestKey,
            digest,
            a.sourceUserId,
            a.naturalPersonId,
          ],
        );
        if (v.kind === 'EFT') {
          const [snap] = await m.query(
            'WITH saved AS (UPDATE finance_cb_documents SET eft_export=finance_cb_eft_export(id,clock_timestamp()) WHERE id=$1 RETURNING eft_export) SELECT eft_export FROM saved',
            [r.id],
          );
          if (!snap.eft_export)
            conflict('Choose an active bank account for the instruction.');
          r.eft_export = snap.eft_export;
        }
        if (journalKinds.includes(v.kind)) {
          const p = await prepareMovement(c, r);
          const roles = p.original
            ? (
                await m.query(
                  'SELECT role_code role FROM finance_foundation_lines WHERE journal_id=$1',
                  [p.original.journal_id],
                )
              ).map((x: { role: string }) => x.role)
            : p.lines.map((l) => l.role);
          const [till] = await m.query(
            "SELECT s.id FROM finance_cb_accounts ac LEFT JOIN finance_cb_shifts s ON s.account_id=ac.id AND s.close_id IS NULL AND s.cashier=$3 AND s.day=$4 WHERE ac.book_id=$1 AND ac.kind='TILL' AND ac.role=ANY($2::text[])",
            [s.bookId, roles, a.sourceUserId, v.date],
          );
          if (till && !till.id)
            denied('Use the originating cashier and open shift.');
          if (till)
            await m.query(
              'UPDATE finance_cb_documents SET shift_id=$2 WHERE id=$1',
              [r.id, till.id],
            );
        }
        return r;
      },
    );
  }
  private async operational(c: Context, r: Document) {
    if (
      Object.hasOwn(CASH_BANK_GROUPS['Bank and till setup'], r.kind) ||
      ['OPEN', 'CLOSE', 'COUNT'].includes(r.kind)
    )
      return setupOrShift(c, r);
    if (
      Object.hasOwn(CASH_BANK_GROUPS['Statements and reconciliation'], r.kind)
    )
      return statementOperation(c, r);
    if (Object.hasOwn(CASH_BANK_GROUPS['Payment channels'], r.kind))
      return channelOperation(c, r);
    return plan(c, r);
  }
  review(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    decision: 'approve' | 'reject' | 'cancel',
    why: string,
  ) {
    const reason = field(why, 'decision reason', 700);
    return this.run(
      a,
      s,
      decision === 'cancel' ? 'PREPARE' : 'REVIEW',
      reason,
      async (c) => {
        const r = await doc(c, id);
        const own =
          r.maker_id === a.sourceUserId || r.maker_person === a.naturalPersonId;
        if (decision === 'cancel' ? !own : own)
          denied(
            'The preparer may withdraw a request. Approval and rejection require an independent reviewer.',
          );
        if (decision === 'approve' && ['APPROVED', 'POSTED'].includes(r.state))
          return r;
        if (
          (decision === 'reject' && r.state === 'REJECTED') ||
          (decision === 'cancel' && r.state === 'CANCELLED')
        )
          return r;
        if (r.state !== 'PENDING') {
          const [rejected] = r.candidate_id
            ? await c.m.query(
                "SELECT state='REJECTED_INACTIVE' rejected FROM finance_approval_requests WHERE candidate_id=$1 ORDER BY expires_at DESC,id DESC LIMIT 1",
                [r.candidate_id],
              )
            : [];
          if (
            decision !== 'cancel' ||
            r.state !== 'APPROVED' ||
            (r.candidate_id && !rejected?.rejected)
          )
            conflict('The request already has a decision.');
        }
        if (decision === 'cancel') {
          await c.m.query(
            "UPDATE finance_cb_documents SET state='CANCELLED',reason=$2 WHERE id=$1",
            [id, reason],
          );
          return doc(c, id);
        }
        const journal = journalKinds.includes(r.kind);
        if (decision === 'approve') {
          if (r.input.evidence) await ownedEvidence(c.m, c.b, r.input.evidence);
          if (r.kind === 'REPLENISH' || r.kind === 'WITHDRAW') {
            const target = await account(c, r.input.fields.destination);
            if (target.manager_id !== a.sourceUserId)
              denied('The designated till manager must approve replenishment.');
          }
          if (journal) await prepareMovement(c, r);
          else await this.operational(c, r);
        }
        const state =
          decision === 'reject' ? 'REJECTED' : journal ? 'APPROVED' : 'POSTED';
        await c.m.query(
          'UPDATE finance_cb_documents SET state=$2,reviewer_id=$3,reviewer_person=$4,reviewed_at=now(),reason=$5 WHERE id=$1',
          [id, state, a.sourceUserId, a.naturalPersonId, reason],
        );
        return doc(c, id);
      },
    );
  }
  post(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Submit cash and bank journal',
      async (c) => {
        const r = await doc(c, id);
        if (
          a.sourceUserId !== r.maker_id ||
          a.naturalPersonId !== r.maker_person
        )
          denied('The original preparer submits the approved voucher.');
        if (r.state === 'POSTED' || r.candidate_id) return r;
        if (r.state !== 'APPROVED' || !journalKinds.includes(r.kind))
          conflict('Approve the cash or bank movement before posting.');
        const plan = await prepareMovement(c, r);
        const v = {
          reference: 'CB-' + r.sequence,
          description: r.kind + ' ' + r.reference,
          date: r.day,
          currency: plan.currency,
          evidence: r.input.evidence!,
          lines: plan.lines,
        };
        const candidate = plan.original
          ? await this.vouchers.reverse(a, s, plan.original.journal_id!, v, {
              manager: c.m,
              originalCashId: plan.original.id,
              cashDocumentId: r.id,
            })
          : await this.vouchers.issue(
              c.m,
              a,
              c.b,
              'MANUAL',
              v,
              'cash-bank:' + r.id,
              { cashDocumentId: r.id },
            );
        await c.m.query(
          'UPDATE finance_cb_documents SET candidate_id=$2 WHERE id=$1',
          [r.id, candidate.id],
        );
        return doc(c, id);
      },
    );
  }
  async posted(
    m: EntityManager,
    a: FoundationActor,
    book: string,
    id: string,
    candidate: string,
    journal: string,
  ) {
    const b = await activePostingBook(m, a.sourceCompanyId!, 'UPDATE', book);
    if (!b) return conflict('The primary cash and bank book must be active.');
    const c = { m, b, a },
      r = await doc(c, id);
    if (r.state === 'POSTED' && r.journal_id === journal) return;
    if (r.state !== 'APPROVED' || r.candidate_id !== candidate)
      conflict('The approved cash voucher must match its journal.');
    await finishMovement(c, r, journal);
    await m.query(
      "UPDATE finance_cb_documents SET state='POSTED',journal_id=$2 WHERE id=$1",
      [id, journal],
    );
  }
}
