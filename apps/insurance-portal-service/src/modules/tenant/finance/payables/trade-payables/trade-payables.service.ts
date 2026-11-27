import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { documentDimensionFields } from '../../foundation/finance-setup/finance-operating-dimensions';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from '../../accounting/general-ledger/finance-ledger-foundation.service';
import {
  FinanceGlVoucherService,
  voucherLines,
  workflowBook,
} from '../../accounting/general-ledger/finance-gl-voucher.service';
import {
  activePostingBook,
  bookChart,
  ownedEvidence,
} from '../../accounting/general-ledger/finance-book-request';
import {
  verifyBankSettlement,
  type BankObservation,
} from '../../accounting/general-ledger/finance-bank-observation';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import {
  fromMinor,
  moneyMinor,
} from '../../accounting/general-ledger/finance-gl-program';
import {
  activeMaster,
  cashKinds,
  conflict,
  current,
  date,
  fail,
  kinds,
  masters,
  record,
  rootId,
  terms,
  text,
  uuid,
  voucherNumber,
  type ApRecord,
  type Context,
  type Fields,
  type Input,
} from './trade-payables.types';
import {
  master,
  purchasing,
  relatedCompanies,
  receivingRoles,
} from './trade-payables-purchasing';
import {
  activeBatch,
  batch,
  payment,
  verifiedStatementPayments,
} from './trade-payables-payments';
import {
  availableCredits,
  reconciliation,
  report,
  tieOut,
} from './trade-payables-reports';
import { prepareReversal } from './trade-payables-reversals';
import { checkReservedCredit } from './trade-payables-credit';
import { paymentSchedule } from './trade-payables-schedule';
import {
  openingImport,
  approveOpening,
  voidOpening,
} from './trade-payables-openings';

function prepareDocument(c: Context) {
  switch (c.input.kind) {
    case 'CATEGORY':
    case 'SETTINGS':
    case 'BANK':
    case 'SUPPLIER':
      return master(c);
    case 'OPENING_IMPORT':
      return openingImport(c);
    case 'BATCH':
      return batch(c);
    case 'RECONCILIATION':
      return reconciliation(c);
    case 'REVERSAL':
      return prepareReversal(c);
    case 'ADVANCE':
    case 'IMPREST':
    case 'PAYMENT':
    case 'APPLICATION':
    case 'CREDIT_APPLICATION':
    case 'SUPPLIER_REFUND':
      return payment(c);
    default:
      return purchasing(c);
  }
}
async function audit(
  m: EntityManager,
  r: ApRecord,
  action: string,
  a: Pick<FoundationActor, 'subjectId'>,
  reason: string,
  evidence?: Input['evidence'],
) {
  await m.query(
    'INSERT INTO finance_ap_events(book_id,record_id,action,actor,reason,evidence) VALUES($1,$2,$3,$4,$5,$6)',
    [r.book_id, r.id, action, a.subjectId, reason, evidence ?? null],
  );
}
function visible(r: ApRecord) {
  if (r.settlement) {
    const { issuer, reference, settledAt, valueDate } = r.settlement;
    r = {
      ...r,
      settlement: {
        issuer,
        reference,
        settledAt,
        ...(valueDate ? { valueDate } : {}),
      },
    };
  }
  if (r.kind !== 'BANK') return r;
  const { accountNumber, ...other } = r.data.details;
  return {
    ...r,
    data: {
      ...r.data,
      details: { ...other, accountEnding: String(accountNumber).slice(-4) },
    },
  };
}
@Injectable()
export class TradePayablesService {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly vouchers: FinanceGlVoucherService,
    private readonly db: DataSource,
  ) {}
  private run<T>(
    a: FoundationActor,
    s: FinanceBookSelection,
    cap: 'READ' | 'REVIEW' | 'PREPARE',
    reason: string,
    work: (m: EntityManager, b: Context['b']) => Promise<T>,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      cap,
      reason,
      async ({ manager }) => {
        const b = await workflowBook(manager, a, s, cap === 'READ');
        if (b.book_role !== 'PRIMARY')
          conflict(
            'Select the company primary operating book for accounts payable.',
          );
        return work(manager, b);
      },
    );
  }
  submit(a: FoundationActor, s: FinanceBookSelection, input: Input) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Prepare accounts payable document',
      (m, b) => this.prepare(m, b, a, input),
    );
  }
  private async prepare(
    m: EntityManager,
    b: Context['b'],
    a: Pick<FoundationActor, 'sourceUserId' | 'naturalPersonId' | 'subjectId'>,
    input: Input,
  ) {
    if (
      !input ||
      !kinds.includes(input.kind) ||
      !input.details ||
      typeof input.details !== 'object' ||
      Array.isArray(input.details) ||
      Buffer.byteLength(JSON.stringify(input), 'utf8') >
        (input.kind === 'OPENING_IMPORT' ? 2_000_000 : 500_000)
    )
      fail('Enter a supported accounts payable document.');
    const key = uuid(input.requestKey, 'request key'),
      fingerprint = hash(input);
    const [saved] = await m.query(
      'SELECT id,request_hash FROM finance_ap_records WHERE book_id=$1 AND request_key=$2',
      [b.book_id, key],
    );
    if (saved) {
      if (saved.request_hash !== fingerprint)
        conflict('The request key already identifies different data.');
      return visible(await record(m, b.book_id, saved.id));
    }
    const ref = text(input.reference, 'document reference', 100);
    date(input.date);
    const currency = input.currency ?? b.context.functionalCurrency;
    if (!Object.hasOwn(b.context.currencyScales, currency))
      fail('Select a currency enabled for this book.');
    input = { ...input, reference: ref, currency };
    const c: Context = {
      m,
      b,
      chart: await bookChart(m, b),
      scale: b.context.currencyScales[currency],
      id: randomUUID(),
      party: '',
      input,
    };
    const k = input.kind;
    let employeePerson: string | undefined;
    if (input.supplierId && input.employeeId) fail('Select a single creditor.');
    if (input.supplierId)
      c.party =
        'S:' + rootId(await activeMaster(c, input.supplierId, 'SUPPLIER'));
    if (input.employeeId) {
      const [staff] = await m.query(
        "SELECT (SELECT i.natural_person_id FROM finance_foundation_identity_bindings i WHERE i.book_id=$3 AND i.source_company_id=$1 AND i.source_user_id=$2 AND i.revoked_at IS NULL AND i.valid_from<=now() AND (i.valid_to IS NULL OR i.valid_to>now()) LIMIT 1) person FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1::text AND cu.user_id::text=$2::text AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL",
        [b.company_id, uuid(input.employeeId, 'employee'), b.book_id],
      );
      if (!staff) fail('Choose an active employee of this company.');
      c.party = 'E:' + input.employeeId;
      employeePerson = staff.person ?? input.employeeId;
    }
    if (['EXPENSE', 'IMPREST', 'RETIREMENT'].includes(k) && !input.employeeId)
      fail('Select an employee.');
    if (
      [
        'ORDER',
        'RECEIPT',
        'BILL',
        'CREDIT',
        'CREDIT_APPLICATION',
        'SUPPLIER_REFUND',
        'DEBIT',
        'ADVANCE',
        'APPLICATION',
        'RECONCILIATION',
      ].includes(k) &&
      !input.supplierId
    )
      fail('Select a supplier.');
    if (['BANK', 'PAYMENT', 'REVERSAL'].includes(k) && !c.party)
      fail('Select the creditor.');
    if (
      ['SUPPLIER', 'CATEGORY', 'SETTINGS', 'BATCH', 'OPENING_IMPORT'].includes(
        k,
      ) &&
      c.party
    )
      fail('This document does not take a creditor.');
    if (input.evidence || !['CATEGORY', 'BATCH'].includes(k))
      await ownedEvidence(m, b, input.evidence);
    const prev = await current(m, b.book_id, k, ref, c.party);
    let revision = 1;
    if (input.replacesId) {
      if (prev?.id !== uuid(input.replacesId, 'latest approved version'))
        conflict('Revise the latest approved version of this reference.');
      if (!masters.includes(k)) {
        const [correction] = await m.query(
          "SELECT id FROM finance_ap_status WHERE book_id=$1 AND kind='REVERSAL' AND data->'details'->>'originalId'=$2 AND status='POSTED'",
          [b.book_id, prev.id],
        );
        if (!correction)
          conflict(
            'Post a linked reversal before replacing an accounting document.',
          );
      }
      revision = prev.revision + 1;
    } else if (prev) conflict('This business reference already exists.');
    const [dup] = await m.query(
      "SELECT 1 FROM finance_ap_records WHERE book_id=$1 AND kind=$2 AND party=$3 AND upper(reference)=upper($4) AND revision=$5 AND state NOT IN ('CANCELLED','REJECTED')",
      [b.book_id, k, c.party, ref, revision],
    );
    if (dup) conflict('Duplicate supplier or document reference.');
    const p = await prepareDocument(c);
    if (employeePerson) p.details.employeePerson = employeePerson;
    if (k === 'SETTINGS')
      p.details.controlAccounts = [
        ...new Set(
          [p.details.payableRole, p.details.employeePayableRole].map(
            (code) => c.chart.roles.find((r) => r.code === code)!.accountCode,
          ),
        ),
      ];
    if (p.lines.length) {
      await voucherLines(
        m,
        b,
        'MANUAL',
        { date: input.date, currency, lines: p.lines },
        c.chart,
      );
      p.accounts = Object.fromEntries(
        p.lines.map((l) => [
          l.role,
          c.chart.roles.find((x) => x.code === l.role)!.accountCode!,
        ]),
      );
    }
    await m.query(
      `INSERT INTO finance_ap_records(id,book_id,kind,reference,party,revision,replaces_id,request_key,request_hash,data,doc_date,due_date,currency,amount,maker_id,maker_person)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        c.id,
        b.book_id,
        k,
        ref,
        c.party,
        revision,
        input.replacesId ?? null,
        key,
        fingerprint,
        p,
        input.date,
        p.due ?? null,
        currency,
        p.amount,
        a.sourceUserId,
        a.naturalPersonId,
      ],
    );
    for (const v of p.movements)
      await m.query(
        'INSERT INTO finance_ap_movements(book_id,document_id,item_id,amount,withholding) VALUES($1,$2,$3,$4,$5)',
        [b.book_id, c.id, v.itemId, v.amount, v.withholding],
      );
    for (const l of p.quantities ?? [])
      await m.query(
        'INSERT INTO finance_ap_order_quantities(book_id,document_id,order_id,item,quantity) VALUES($1,$2,$3,$4,$5)',
        [b.book_id, c.id, p.orderId, l.item, l.quantity],
      );
    for (const id of p.batchItems ?? [])
      await m.query(
        'INSERT INTO finance_ap_batch_items(book_id,batch_id,payment_id) VALUES($1,$2,$3)',
        [b.book_id, c.id, id],
      );
    const r = await record(m, b.book_id, c.id);
    await audit(m, r, 'SUBMIT', a, ref);
    return visible(r);
  }
  private async employeeBook(m: EntityManager, u: AuthenticatedUser) {
    if (
      u?.scope !== 'company' ||
      !u.companyId ||
      !['COMPANY_USER', 'COMPANY_ADMIN'].includes(u.userType)
    )
      throw new ForbiddenException('An active employee identity is required.');
    const [member] = await m.query(
      "SELECT 1 FROM company_users cu JOIN users us ON us.id::text=cu.user_id::text WHERE cu.company_id=$1 AND cu.user_id=$2 AND cu.status='active' AND us.status='active' AND us.deleted_at IS NULL FOR SHARE OF cu,us",
      [u.companyId, u.id],
    );
    if (!member)
      throw new ForbiddenException('An active company membership is required.');
    const b = await activePostingBook(m, u.companyId);
    if (!b) conflict('Activate the company primary book.');
    return b;
  }
  employee(u: AuthenticatedUser, input?: Input) {
    return this.db.transaction(async (m) => {
      const b = await this.employeeBook(m, u);
      const documents = await m.query(
        `SELECT d.title,d.id AS "documentId",v.id,v.sha256_hash hash FROM documents d JOIN document_versions v ON v.document_id=d.id AND d.company_id=v.company_id
        WHERE d.company_id=$1 AND d.owner_type='COMPANY' AND d.owner_id=$1 AND (v.uploaded_by=$2 OR d.created_by=$2) AND d.status='AVAILABLE' AND v.status='AVAILABLE' ORDER BY d.title`,
        [b.company_id, u.id],
      );
      if (input) {
        if (
          !['EXPENSE', 'IMPREST', 'RETIREMENT', 'BANK'].includes(input.kind) ||
          input.supplierId ||
          (input.employeeId && input.employeeId !== u.id)
        )
          throw new ForbiddenException(
            'Submit personal expenses, imprests or beneficiary details only.',
          );
        if (!documents.some((d) => d.id === input.evidence?.id))
          fail('Attach your available company document version.');
        return this.prepare(
          m,
          b,
          { sourceUserId: u.id, naturalPersonId: u.id, subjectId: u.id },
          { ...input, employeeId: u.id },
        );
      }
      const rows = await m.query(
        'SELECT *,doc_date::text,due_date::text FROM finance_ap_status WHERE book_id=$1 AND party=$2 ORDER BY sequence DESC',
        [b.book_id, 'E:' + u.id],
      );
      const chart = await bookChart(m, b);
      return {
        records: rows.map(visible),
        staff: [{ id: u.id, name: 'My account' }],
        terms: [],
        documents,
        roles: chart.roles.filter((r) => r.accountType === 'EXPENSE'),
        receivingRoles: receivingRoles(b, chart),
        dimensions: await documentDimensionFields(m, b.company_id, b.book_id),
        currencies: b.context.currencyScales,
        functionalCurrency: b.context.functionalCurrency,
      };
    });
  }
  withdrawEmployee(u: AuthenticatedUser, id: string, reason: string) {
    const note = text(reason, 'withdrawal reason', 1000);
    return this.db.transaction(async (m) => {
      const b = await this.employeeBook(m, u),
        r = await record(m, b.book_id, id);
      if (r.maker_id !== u.id || r.party !== 'E:' + u.id)
        throw new ForbiddenException(
          'Only the employee who submitted the request may withdraw it.',
        );
      if (r.state === 'CANCELLED') return visible(r);
      if (r.state !== 'PENDING')
        conflict('Only a pending employee request can be withdrawn.');
      await m.query(
        "UPDATE finance_ap_records SET state='CANCELLED' WHERE id=$1",
        [id],
      );
      await audit(m, r, 'CANCEL', { subjectId: u.id }, note);
      return visible(await record(m, b.book_id, id));
    });
  }
  review(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    approve: boolean,
    reason: string,
  ) {
    return this.run(
      a,
      s,
      'REVIEW',
      text(reason, 'review reason', 1000),
      async (m, b) => {
        const r = await record(m, b.book_id, id),
          next = approve ? 'APPROVED' : 'REJECTED';
        if (
          r.maker_person === a.naturalPersonId ||
          r.maker_id === a.sourceUserId ||
          r.data.details.employeePerson === a.naturalPersonId ||
          r.party === 'E:' + a.sourceUserId
        )
          throw new ForbiddenException(
            'A different person must review this document.',
          );
        if (r.state === next) return visible(r);
        if (r.state !== 'PENDING')
          conflict('This document already has a decision.');
        if (approve) {
          await checkReservedCredit(m, r);
          if (r.data.evidence) await ownedEvidence(m, b, r.data.evidence);
          const scale = b.context.currencyScales[r.currency],
            amount = moneyMinor(r.amount, scale);
          const debit = r.data.lines.reduce(
            (sum, l) => sum + moneyMinor(l.debit, scale),
            0n,
          );
          if (amount > 0n || debit > 0n) {
            const [mandate] = await m.query(
              `SELECT leaf.id FROM finance_approval_mandates leaf JOIN finance_approval_mandates root ON root.id=coalesce(leaf.delegated_from_id,leaf.id)
                AND (root.tenant_id,root.legal_entity_id,root.book_id,root.role_code,root.currency)=(leaf.tenant_id,leaf.legal_entity_id,leaf.book_id,leaf.role_code,leaf.currency)
                WHERE leaf.tenant_id=$1 AND leaf.legal_entity_id=$2 AND leaf.book_id=$3 AND leaf.subject_id=$4 AND leaf.natural_person_id=$5 AND leaf.currency=$6 AND leaf.max_amount>=$7
                AND root.delegated_from_id IS NULL AND root.max_amount>=leaf.max_amount AND root.valid_from<=leaf.valid_from
                AND (root.valid_to IS NULL OR root.valid_to>=leaf.valid_to) AND root.state='ENABLED' AND root.revoked_at IS NULL
                AND leaf.state='ENABLED' AND leaf.revoked_at IS NULL AND leaf.valid_from<=statement_timestamp() AND (leaf.valid_to IS NULL OR leaf.valid_to>statement_timestamp())
                AND root.natural_person_id<>ALL($8::uuid[]) FOR SHARE OF leaf,root`,
              [
                a.tenantId,
                s.legalEntityId,
                s.bookId,
                a.subjectId,
                a.naturalPersonId,
                r.currency,
                fromMinor(debit > amount ? debit : amount, scale),
                [r.maker_person, r.data.details.employeePerson].filter(Boolean),
              ],
            );
            if (!mandate)
              throw new ForbiddenException(
                'This amount exceeds the reviewer mandate.',
              );
          }
          if (r.kind === 'RECONCILIATION') {
            const d = r.data.details;
            const now = await report(
              m,
              b.book_id,
              r.party,
              r.currency,
              d.from,
              r.doc_date,
            );
            if (!d.matches || now.signature !== d.signature)
              conflict(
                'Resolve statement differences and submit the current reconciliation.',
              );
          }
          if (r.data.bankId) await this.checkBank(m, r);
          if (r.kind === 'OPENING_IMPORT') {
            const context: Context = {
              m,
              b,
              id: r.id,
              party: '',
              chart: await bookChart(m, b),
              scale: b.context.currencyScales[r.currency],
              input: {
                kind: r.kind,
                reference: r.reference,
                requestKey: r.request_key,
                currency: r.currency,
                date: r.doc_date,
                details: r.data.details,
                evidence: r.data.evidence,
              },
            };
            await approveOpening(context, r, a, reason);
          }
        }
        await m.query(
          'UPDATE finance_ap_records SET state=$1,reviewer_person=$2,review_reason=$3,reviewed_at=statement_timestamp(),reviewer_user_id=$5 WHERE id=$4',
          [next, a.naturalPersonId, reason, id, a.sourceUserId],
        );
        await audit(m, r, next, a, reason);
        return visible(await record(m, b.book_id, id));
      },
    );
  }
  cancel(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    reason: string,
  ) {
    return this.run(
      a,
      s,
      'PREPARE',
      text(reason, 'cancellation reason', 1000),
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (r.state === 'CANCELLED') return visible(r);
        if (
          r.maker_person !== a.naturalPersonId ||
          r.settlement ||
          (r.candidate_id && r.status !== 'GL_REJECTED') ||
          !['PENDING', 'APPROVED'].includes(r.state)
        )
          conflict(
            'Only the preparer can withdraw an unsettled request before posting or after a GL rejection.',
          );
        if (
          r.state === 'APPROVED' &&
          (masters.includes(r.kind) ||
            ['ORDER', 'RECEIPT', 'RECONCILIATION', 'OPENING_IMPORT'].includes(
              r.kind,
            ) ||
            r.data.details.openingImportId)
        )
          conflict('This approved record must be retained.');
        if ((await verifiedStatementPayments(m, b.book_id, [id])).length)
          conflict(
            'Withdraw the EFT bank verification before withdrawing the payable.',
          );
        if (await activeBatch({ m, b }, id))
          conflict('Withdraw the batch before its payment.');
        if (r.kind === 'BATCH') {
          const [used] = await m.query(
            'SELECT 1 FROM finance_ap_batch_items i JOIN finance_ap_records d ON d.id=i.payment_id WHERE i.batch_id=$1 AND d.candidate_id IS NOT NULL',
            [id],
          );
          if (used)
            conflict(
              'A batch containing settled vouchers cannot be withdrawn.',
            );
        }
        await m.query(
          "UPDATE finance_ap_records SET state='CANCELLED' WHERE id=$1",
          [id],
        );
        await audit(m, r, 'CANCEL', a, reason);
        return visible(await record(m, b.book_id, id));
      },
    );
  }
  voidPurchase(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    reason: string,
    evidence: Input['evidence'],
  ) {
    return this.run(
      a,
      s,
      'REVIEW',
      text(reason, 'purchase correction reason', 1000),
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (
          !['ORDER', 'RECEIPT', 'OPENING_IMPORT'].includes(r.kind) ||
          r.maker_person === a.naturalPersonId
        )
          throw new ForbiddenException(
            'An independent reviewer must correct the purchase document.',
          );
        if (r.state === 'CANCELLED') return visible(r);
        if (r.state !== 'APPROVED')
          conflict('Select an approved order or delivery.');
        await ownedEvidence(m, b, evidence);
        if (r.kind === 'OPENING_IMPORT') {
          await voidOpening({ m, b }, r, a.subjectId, reason, evidence);
          await audit(m, r, 'VOID_OPENING', a, reason, evidence);
          return visible(await record(m, b.book_id, id));
        }
        const sources = await m.query(
          `WITH quantities AS (
        SELECT q.item,d.doc_date,sum(CASE WHEN d.kind='RECEIPT' THEN CASE WHEN d.state='APPROVED' THEN q.quantity ELSE 0 END ELSE -q.quantity END) qty
        FROM finance_ap_order_quantities q JOIN finance_ap_records d ON d.id=q.document_id
        WHERE q.book_id=$1 AND q.order_id=$2 AND d.id<>$3 AND d.state IN ('PENDING','APPROVED')
          AND NOT EXISTS(SELECT 1 FROM finance_ap_status v WHERE v.book_id=$1 AND v.kind='REVERSAL' AND v.data->'details'->>'originalId'=d.id::text AND v.status='POSTED')
        GROUP BY q.item,d.doc_date)
        SELECT count(*)::int used,coalesce(bool_or(available<0),false) short FROM (SELECT sum(qty) OVER(PARTITION BY item ORDER BY doc_date) available FROM quantities) s`,
          [b.book_id, r.kind === 'ORDER' ? id : r.data.orderId, id],
        );
        if (r.kind === 'ORDER' ? sources[0].used > 0 : sources[0].short)
          conflict(
            'Resolve the dependent receipts or matched invoices before voiding this document.',
          );
        await m.query(
          "UPDATE finance_ap_records SET state='CANCELLED' WHERE id=$1",
          [id],
        );
        await audit(m, r, 'VOID_PURCHASE', a, reason, evidence);
        return visible(await record(m, b.book_id, id));
      },
    );
  }
  private async checkBank(m: EntityManager, r: ApRecord, asOf?: Date) {
    const bank = await record(m, r.book_id, r.data.bankId);
    const active = asOf
      ? (
          await m.query(
            "SELECT * FROM finance_ap_records WHERE book_id=$1 AND kind='BANK' AND upper(reference)=upper($2) AND party=$3 AND state='APPROVED' AND reviewed_at<=$4 ORDER BY revision DESC LIMIT 1",
            [r.book_id, bank.reference, r.party, asOf],
          )
        )[0]
      : await current(m, r.book_id, 'BANK', bank.reference, r.party);
    if (active?.id !== bank.id || active.data.details.disabled)
      conflict(
        'Beneficiary details changed. Prepare a voucher using the approved bank version.',
      );
    return bank;
  }
  post(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    observation?: BankObservation,
    batchId?: string,
  ) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Post approved accounts payable transaction',
      async (m, b) => {
        const r = await record(m, b.book_id, id),
          p = r.data;
        if (r.candidate_id) {
          if (observation && hash(r.settlement) !== hash(observation))
            conflict('This voucher already has a different settlement.');
          return visible(r);
        }
        if (
          r.state !== 'APPROVED' ||
          (!p.lines.length && r.kind !== 'REVERSAL')
        )
          conflict('Approve an accounting document before posting.');
        await checkReservedCredit(m, r);
        if (r.party.startsWith('S:')) {
          const vendor = await record(m, b.book_id, r.party.slice(2));
          const active = await current(
            m,
            b.book_id,
            'SUPPLIER',
            vendor.reference,
          );
          if (!active || active.data.details.disabled)
            conflict('The supplier is inactive.');
        }
        if (p.accounts) {
          const chart = await bookChart(m, b);
          if (
            Object.entries(p.accounts).some(
              ([code, account]) =>
                chart.roles.find((v) => v.code === code)?.accountCode !==
                account,
            )
          )
            conflict(
              'The approved posting account mapping has changed. Review the voucher before settlement.',
            );
        }
        const assigned = await activeBatch({ m, b }, id);
        if (
          assigned &&
          (assigned.id !== batchId || assigned.state !== 'APPROVED')
        )
          conflict('Settle the voucher through its approved batch.');
        if (batchId && assigned?.id !== batchId)
          conflict('The voucher does not belong to this batch.');
        let postingDate = r.doc_date;
        const returned =
          r.kind === 'RETIREMENT' ? p.details.cashReturned : null;
        const money = moneyMinor(
          r.amount,
          b.context.currencyScales[r.currency],
        );
        const bankNeeded =
          (cashKinds.includes(r.kind) && money > 0n) ||
          r.kind === 'SUPPLIER_REFUND' ||
          (!!returned &&
            moneyMinor(returned, b.context.currencyScales[r.currency]) > 0n) ||
          (r.kind === 'REVERSAL' && !!p.details.bankAmount);
        let recordedSettlement: Record<string, string> | undefined;
        const [proof] =
          bankNeeded && !p.details.tillId && cashKinds.includes(r.kind)
            ? await verifiedStatementPayments(m, b.book_id, [id])
            : [];
        if (bankNeeded && p.details.tillId) {
          if (batchId || observation)
            conflict(
              'Physical till payments must be confirmed by the assigned cashier.',
            );
          const [shift] = await m.query(
            `SELECT s.id,s.day::text,(now() AT TIME ZONE $4)::date::text today,a.payment_limit,a.balance,
            clock_timestamp() settled FROM finance_cb_shifts s JOIN finance_cb_balances a ON a.id=s.account_id
            WHERE a.id=$1 AND a.book_id=$2 AND a.kind='TILL' AND a.active AND a.currency=$5 AND a.account_code=$6 AND s.cashier=$3 AND s.close_id IS NULL`,
            [
              p.details.tillId,
              b.book_id,
              a.sourceUserId,
              b.timezone,
              r.currency,
              p.bankAccount,
            ],
          );
          if (
            !shift ||
            shift.day !== shift.today ||
            shift.day < (r.due_date ?? r.doc_date) ||
            (p.details.discountUntil && shift.day > p.details.discountUntil)
          )
            conflict(
              'Use the assigned cashier and open shift on the scheduled settlement date.',
            );
          if (
            r.kind !== 'REVERSAL' &&
            (money >
              moneyMinor(
                shift.payment_limit,
                b.context.currencyScales[r.currency],
              ) ||
              money >
                moneyMinor(shift.balance, b.context.currencyScales[r.currency]))
          )
            conflict(
              'The payment exceeds the till balance or single payment limit.',
            );
          recordedSettlement = {
            issuer: 'CASH_OFFICE',
            reference: voucherNumber(r),
            settledAt: new Date(shift.settled).toISOString(),
            shiftId: shift.id,
            cashier: a.sourceUserId!,
          };
          postingDate = shift.day;
        } else if (proof) {
          if (observation || batchId)
            conflict(
              'This voucher already has independently verified statement evidence.',
            );
          await this.checkBank(m, r, proof.verified_at);
          postingDate = proof.day;
          if (
            postingDate < (r.due_date ?? r.doc_date) ||
            (p.details.discountUntil && postingDate > p.details.discountUntil)
          )
            conflict(
              'The bank value date falls outside the approved settlement dates.',
            );
          recordedSettlement = {
            issuer: 'BANK_STATEMENT',
            reference: proof.reference,
            valueDate: proof.day,
            statementProof: proof.id,
          };
        } else if (bankNeeded) {
          const verified = await verifyBankSettlement(
            m,
            {
              kind:
                r.kind === 'REVERSAL'
                  ? 'AP_REVERSAL'
                  : r.kind === 'SUPPLIER_REFUND'
                    ? 'AP_SUPPLIER_REFUND'
                    : returned
                      ? 'AP_IMPREST_RETURN'
                      : 'AP_PAYMENT',
              id: r.id,
              companyId: b.company_id,
              reference: voucherNumber(r),
              beneficiaryId: p.bankId ?? r.party.slice(2),
              account: p.bankAccount!,
              currency: r.currency,
              amount: returned || p.details.bankAmount || r.amount,
            },
            observation,
          );
          if (p.bankId && r.kind !== 'REVERSAL')
            await this.checkBank(m, r, verified.paidAt);
          const [local] = await m.query(
            'SELECT ($1::timestamptz AT TIME ZONE $2)::date::text AS day',
            [verified.paidAt, b.timezone],
          );
          postingDate = local.day;
          if (
            (r.kind !== 'SUPPLIER_REFUND' &&
              verified.paidAt < new Date(r.reviewed_at!)) ||
            (assigned && verified.paidAt < new Date(assigned.reviewed_at))
          )
            conflict(
              'The bank observation predates approval of the payment or batch.',
            );
          if (
            postingDate < (r.due_date ?? r.doc_date) ||
            (p.details.discountUntil && postingDate > p.details.discountUntil)
          )
            conflict(
              'The settlement falls outside the scheduled payment or discount dates.',
            );
        } else if (observation)
          fail('This transaction does not require a bank receipt.');
        const reference = cashKinds.includes(r.kind)
          ? voucherNumber(r)
          : 'AP-' + r.sequence;
        const v = {
          reference,
          date: postingDate,
          currency: r.currency,
          description:
            r.kind + ' ' + r.reference + ' ' + (p.details.description ?? ''),
          lines: p.lines,
          evidence: p.evidence,
        };
        const candidate =
          r.kind === 'REVERSAL'
            ? await this.vouchers.reverse(
                a,
                s,
                p.details.journalId,
                { ...v, evidence: p.evidence! },
                { manager: m, originalApId: p.details.originalId },
              )
            : await this.vouchers.issue(m, a, b, 'MANUAL', v, 'ap:' + r.id, {
                apDocumentId: r.id,
                apKind: r.kind,
                apReference: r.reference,
                apParty: r.party,
                apEmployeePerson: p.details.employeePerson ?? null,
              });
        await m.query(
          'UPDATE finance_ap_records SET candidate_id=$1,settlement=$2 WHERE id=$3',
          [candidate.id, recordedSettlement ?? observation ?? null, id],
        );
        await audit(m, r, 'SUBMIT_GL', a, reference);
        return visible(await record(m, b.book_id, id));
      },
    );
  }
  async settleBatch(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    observations: Record<string, BankObservation>,
  ) {
    const items = await this.run(
      a,
      s,
      'PREPARE',
      'Execute approved payment batch',
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (r.kind !== 'BATCH' || r.state !== 'APPROVED')
          conflict('Select an approved payment batch.');
        return r.data.batchItems!;
      },
    );
    if (
      !observations ||
      typeof observations !== 'object' ||
      Object.keys(observations).some((key) => !items.includes(key))
    )
      fail('Provide observations keyed by vouchers in this batch.');
    const results: { paymentId: string; status: string; reason?: string }[] =
      [];
    for (const paymentId of items) {
      try {
        const r = await this.post(a, s, paymentId, observations[paymentId], id);
        results.push({ paymentId, status: r.status });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        results.push({ paymentId, status: 'HELD', reason: error.message });
      }
    }
    return results;
  }
  instructions(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Read approved payment instructions',
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (
          r.state !== 'APPROVED' ||
          (r.kind !== 'BATCH' && !cashKinds.includes(r.kind))
        )
          conflict('Approve the voucher or batch first.');
        const items = r.data.batchItems ?? [id];
        const verified = await verifiedStatementPayments(m, b.book_id, items);
        if (verified.length)
          conflict(
            'The bank debit is already verified. Submit the original payable for GL approval.',
          );
        const instructions: Fields[] = [];
        for (const key of items) {
          const v = await record(m, b.book_id, key);
          if (v.data.details.tillId)
            conflict(
              'Use the assigned cashier to settle this physical payment.',
            );
          if (v.candidate_id || v.settlement) continue;
          const assigned = await activeBatch({ m, b }, key);
          if (
            assigned &&
            (assigned.id !== r.id || assigned.state !== 'APPROVED')
          )
            conflict('Use the approved batch for these instructions.');
          const bank = await this.checkBank(m, v);
          instructions.push({
            id: v.id,
            reference: voucherNumber(v),
            beneficiaryId: bank.id,
            bankName: bank.data.details.bankName,
            accountName: bank.data.details.accountName,
            accountNumber: bank.data.details.accountNumber,
            branch: bank.data.details.branch,
            swift: bank.data.details.swift,
            sourceAccount: v.data.bankAccount,
            amount: v.amount,
            currency: v.currency,
            scheduledDate: v.due_date,
            status: v.status,
          });
        }
        await audit(m, r, 'PAYMENT_INSTRUCTIONS', a, r.reference);
        return instructions;
      },
    );
  }
  rejected(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Reconsider rejected AP posting',
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (r.status !== 'GL_REJECTED' || r.state !== 'APPROVED')
          conflict('Select a rejected journal for an approved AP document.');
        const [candidate] = await m.query(
          'SELECT id,subject_hash AS hash FROM finance_journal_candidates WHERE id=$1',
          [r.candidate_id],
        );
        return candidate;
      },
    );
  }
  bankReview(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'REVIEW',
      'Verify beneficiary bank details',
      async (m, b) => {
        const bank = await record(m, b.book_id, id);
        if (bank.kind !== 'BANK') fail('Select a bank account.');
        await audit(
          m,
          bank,
          'VIEW_BANK_DETAILS',
          a,
          'Independent beneficiary verification',
        );
        return bank.data.details;
      },
    );
  }
  history(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(a, s, 'READ', 'Read AP document history', async (m, b) => {
      await record(m, b.book_id, id);
      return m.query(
        "SELECT e.action,e.reason,e.evidence,e.at,coalesce(nullif(concat_ws(' ',u.first_name,u.last_name),''),e.actor::text) actor FROM finance_ap_events e LEFT JOIN users u ON u.id::text=e.actor::text WHERE e.book_id=$1 AND e.record_id=$2 ORDER BY e.id",
        [b.book_id, id],
      );
    });
  }
  schedule(
    a: FoundationActor,
    s: FinanceBookSelection,
    payOn: string,
    discounts: boolean,
  ) {
    return this.run(a, s, 'READ', 'Read scheduled payables', (m, b) =>
      paymentSchedule(m, b.book_id, payOn, discounts),
    );
  }
  plan(
    a: FoundationActor,
    s: FinanceBookSelection,
    payOn: string,
    selections: { itemId: string; bankId: string; requestKey: string }[],
    takeDiscount: boolean,
  ) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Schedule supplier and staff vouchers',
      async (m, b) => {
        if (
          !Array.isArray(selections) ||
          !selections.length ||
          selections.length > 100 ||
          selections.some((x) => !x || typeof x !== 'object') ||
          new Set(selections.map((x) => x.itemId)).size !== selections.length
        )
          fail('Select up to 100 distinct open items.');
        const candidates = await paymentSchedule(
          m,
          b.book_id,
          date(payOn),
          takeDiscount,
        );
        const planned: ApRecord[] = [];
        for (const entry of selections) {
          const item = await record(m, b.book_id, entry.itemId);
          const key = uuid(entry.requestKey, 'scheduling request key');
          const [old] = await m.query(
            'SELECT id FROM finance_ap_records WHERE book_id=$1 AND request_key=$2',
            [b.book_id, key],
          );
          if (old) {
            const saved = await record(m, b.book_id, old.id);
            if (
              saved.kind !== 'PAYMENT' ||
              saved.data.details.allocations?.[0]?.itemId !== item.id ||
              saved.data.bankId !== entry.bankId ||
              saved.due_date !== payOn ||
              saved.data.details.takeDiscount !== takeDiscount
            )
              conflict('This scheduling key identifies a different voucher.');
            planned.push(visible(saved));
            continue;
          }
          const due = candidates.find((x) => x.id === item.id);
          if (!due)
            conflict(
              'Refresh the payment schedule. The bill is unavailable or fully reserved.',
            );
          const [clock] = await m.query(
            'SELECT (statement_timestamp() AT TIME ZONE $1)::date::text AS day',
            [b.timezone],
          );
          if (payOn < clock.day) fail('Schedule the payment today or later.');
          planned.push(
            await this.prepare(m, b, a, {
              kind: 'PAYMENT',
              reference: 'SCH-' + payOn + '-' + key,
              requestKey: key,
              date: clock.day,
              currency: item.currency,
              ...(item.party.startsWith('S:')
                ? { supplierId: item.party.slice(2) }
                : { employeeId: item.party.slice(2) }),
              dimensions: item.data.dimensions,
              evidence: item.data.evidence,
              details: {
                description: 'Scheduled settlement of ' + item.reference,
                bankId: entry.bankId,
                scheduledDate: payOn,
                takeDiscount,
                allocations: [{ itemId: item.id, amount: due.available }],
              },
            }),
          );
        }
        return planned;
      },
    );
  }
  workspace(a: FoundationActor, s: FinanceBookSelection) {
    return this.run(
      a,
      s,
      'READ',
      'Read accounts payable workspace',
      async (m, b) => {
        const rows: ApRecord[] = await m.query(
          'SELECT *,doc_date::text,due_date::text FROM finance_ap_status WHERE book_id=$1 ORDER BY sequence DESC',
          [b.book_id],
        );
        const staff = await m.query(
          "SELECT u.id,concat_ws(' ',u.first_name,u.last_name) AS name FROM company_users cu JOIN users u ON cu.user_id::text=u.id::text WHERE cu.company_id=$1 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL ORDER BY name",
          [b.company_id],
        );
        return {
          records: rows.map(visible),
          statementVerifiedVouchers: (
            await verifiedStatementPayments(m, b.book_id)
          ).map((x) => x.voucher_id),
          cashTills: (
            await m.query(
              "SELECT to_regclass('public.finance_cb_accounts') IS NOT NULL installed",
            )
          )[0].installed
            ? await m.query(
                "SELECT id,code,name,currency FROM finance_cb_accounts WHERE book_id=$1 AND active AND kind='TILL' ORDER BY code",
                [b.book_id],
              )
            : [],
          terms: terms(b),
          staff,
          companies: await relatedCompanies(m, b),
          availableCredits: await availableCredits(m, b.book_id, b.timezone),
          receivingRoles: receivingRoles(b, await bookChart(m, b)),
        };
      },
    );
  }
  reports(
    a: FoundationActor,
    s: FinanceBookSelection,
    q: { party?: string; currency: string; from: string; to: string },
  ) {
    return this.run(
      a,
      s,
      'READ',
      'Read AP statement, aging and control accounts',
      async (m, b) => {
        if (!Object.hasOwn(b.context.currencyScales, q.currency))
          fail('Select a book currency.');
        const statement = await report(
          m,
          b.book_id,
          q.party ?? '',
          q.currency,
          q.from,
          q.to,
        );
        const reconciliations = q.party
          ? await m.query(
              "SELECT id,reference,state,data->'details'->>'signature'=$5 AS current,data->'details'->'differences' differences FROM finance_ap_records WHERE book_id=$1 AND kind='RECONCILIATION' AND party=$2 AND currency=$3 AND doc_date=$4 ORDER BY sequence DESC",
              [b.book_id, q.party, q.currency, q.to, statement.signature],
            )
          : [];
        return {
          ...statement,
          reconciliations,
          functionalCurrency: b.context.functionalCurrency,
          controls: await tieOut(m, b.book_id, q.to),
        };
      },
    );
  }
}
export { voucherNumber } from './trade-payables.types';
