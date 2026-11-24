import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from './finance-ledger-foundation.service';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import {
  financeConfigurationHash as hash,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  candidateCode,
  candidateText,
} from '../journal-entries/finance-journal-candidate.types';
import { documentDimensionFields } from '../../foundation/finance-setup/finance-operating-dimensions';
import {
  bookChart,
  ownedEvidence,
  type ActivePostingBook,
} from './finance-book-request';
import {
  FinanceGlVoucherService,
  voucherLines,
  workflowBook,
} from './finance-gl-voucher.service';
import { requestWriteOff, type WriteOff } from './finance-gl-write-off';
import { FinanceOperatingPostingService } from './finance-operating-posting.service';
import { glReadiness, recordGlDeployment } from './finance-gl-release';
import { certifiedOpening, nextDate, revalue } from './finance-gl-balances';
import {
  dueDate,
  moneyMinor,
  invalid,
  programLines,
  validateProgram,
  type ProgramDefinition,
  type ProgramKind,
  type VoucherLine,
} from './finance-gl-program';

export interface ProgramInput {
  code: string;
  kind: ProgramKind;
  previousHash?: string;
  definition: ProgramDefinition;
}
interface Program {
  id: string;
  code: string;
  kind: ProgramKind;
  revision: number;
  subject_hash: string;
  definition: ProgramDefinition;
  maker_subject_id: string;
  maker_person_id: string;
  state: string;
}
const versions =
  "SELECT p.*,CASE WHEN EXISTS(SELECT 1 FROM finance_gl_decisions e WHERE e.program_id=p.id AND e.action='PAUSE') THEN 'PAUSED' WHEN EXISTS(SELECT 1 FROM finance_gl_decisions e WHERE e.program_id=p.id AND e.action='APPROVE') THEN 'APPROVED' ELSE 'DRAFT' END state FROM finance_gl_programs p";
async function approved(
  m: EntityManager,
  book: string,
  id: string,
  expected: string,
) {
  const [p]: Program[] = await m.query(
    versions + ' WHERE p.book_id=$1 AND p.id=$2',
    [book, id],
  );
  if (!p || p.subject_hash !== expected || p.state !== 'APPROVED')
    throw new ConflictException(
      'An independently approved, unpaused version is required.',
    );
  return p;
}
async function reconciliation(
  m: EntityManager,
  ledger: FinanceLedgerFoundationService,
  a: FoundationActor,
  b: ActivePostingBook,
  d: ProgramDefinition,
) {
  const o = await certifiedOpening(m, b.book_id, d.end);
  if (d.currency !== b.context.functionalCurrency)
    invalid('Reconcile the account in the functional currency of the book.');
  const report = await ledger.trialBalance(
    a,
    { legalEntityId: b.legal_entity_id, bookId: b.book_id },
    {
      mode: 'LIVE',
      openingId: o.id,
      openingHash: o.subject_hash,
      from: o.payload.date,
      to: nextDate(d.end),
    },
    m,
  );
  const row = report.rows.find((r) => r.accountCode === d.account);
  if (!row)
    invalid('Choose an account included in the certified trial balance.');
  const ledgerBalance = row.closing,
    difference = DecimalUtil.value(ledgerBalance)
      .minus(d.statementBalance!)
      .toFixed(b.context.currencyScales[d.currency]);
  const relevant = report.journals
    .filter((j) => j.lines.some((l) => l.accountCode === d.account))
    .map((j) => [j.id, j.subjectHash]);
  return {
    opening: o.id,
    ledgerBalance,
    statementBalance: d.statementBalance,
    difference,
    openItems: d.exceptions!.filter((e) => !e.resolved).length,
    populationHash: hash({ opening: o.subject_hash, relevant }),
  };
}
@Injectable()
export class FinanceGlWorkflowsService {
  private readonly logger = new Logger(FinanceGlWorkflowsService.name);
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly vouchers: FinanceGlVoucherService,
    private readonly posting: FinanceOperatingPostingService,
  ) {}
  writeOff(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    input: WriteOff,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      input.reason,
      async ({ manager: m }) =>
        requestWriteOff(
          m,
          await workflowBook(m, a, s),
          a.sourceUserId!,
          id,
          input,
          this.posting,
        ),
    );
  }
  reverseWriteOff(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    reason: string,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      reason,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        const [w] = await m.query(
          'SELECT currency FROM finance_gl_writeoffs WHERE id=$1 AND book_id=$2',
          [id, b.book_id],
        );
        if (!w)
          throw new ConflictException(
            'Select an existing write-off in this book.',
          );
        return this.posting.prepare(m, b.company_id, a.sourceUserId!, {
          sourceType: 'INVOICE_WRITE_OFF_REVERSAL',
          sourceId: id,
          sourceEventId: 'reverse:' + id,
          description: reason,
          currencyCode: w.currency,
          lines: [],
        });
      },
    );
  }
  deploy(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: Parameters<typeof recordGlDeployment>[3],
    reason: string,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'RELEASE',
      reason,
      async ({ manager: m }) =>
        recordGlDeployment(m, a, await workflowBook(m, a, s), input, reason),
    );
  }
  overview(a: FoundationActor, s: FinanceBookSelection) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'READ',
      'Read general ledger workspace',
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s, true),
          chart = await bookChart(m, b);
        const programs = await m.query(
          versions + ' WHERE p.book_id=$1 ORDER BY p.code,p.revision DESC',
          [s.bookId],
        );
        const journals = await m.query(
          `SELECT p.candidate_id id,c.subject_hash hash,p.source_type type,p.snapshot,c.maker_subject_id=$2 AS maker,j.id AS "journalId",j.journal_no AS "journalNo",
        CASE WHEN j.id IS NOT NULL THEN 'POSTED' ELSE r.state END state,r.expires_at AS "expiresAt" FROM finance_operating_postings p
        JOIN finance_journal_candidates c ON c.id=p.candidate_id LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
        JOIN LATERAL(SELECT state,expires_at FROM finance_approval_requests WHERE candidate_id=p.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1) r ON true
        WHERE p.book_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 200`,
          [s.bookId, a.subjectId],
        );
        const documents = await m.query(
          `SELECT d.title,d.id AS "documentId",v.id,v.sha256_hash hash FROM documents d JOIN document_versions v ON v.document_id=d.id AND d.company_id=v.company_id
        WHERE d.company_id=$1 AND ((d.owner_type='COMPANY' AND d.owner_id=$1) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$2)) AND d.status='AVAILABLE' AND v.status='AVAILABLE' ORDER BY d.title,v.version_number DESC`,
          [b.company_id, b.book_id],
        );
        const registers = await m.query(
          `SELECT p.snapshot->>'programCode' code,p.snapshot->>'currency' currency,
        sum(CASE WHEN p.snapshot->>'occurrence'='INITIAL' THEN 1 ELSE -1 END * CASE WHEN j.kind='REVERSAL' THEN -1 ELSE 1 END * (p.snapshot->>'amount')::numeric)::text remaining
        FROM finance_operating_postings p JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
        WHERE p.book_id=$1 AND p.snapshot->>'programKind' IN ('ACCRUAL','PREPAYMENT') GROUP BY 1,2`,
          [b.book_id],
        );
        const reconciliations: (Awaited<ReturnType<typeof reconciliation>> & {
          id: string;
          current: boolean;
        })[] = [];
        for (const p of programs.filter(
          (p: Program) => p.kind === 'RECONCILIATION' && p.state === 'APPROVED',
        )) {
          const now = await reconciliation(m, this.ledger, a, b, p.definition);
          reconciliations.push({
            id: p.id,
            ...now,
            current:
              p.definition.reconciliation.populationHash === now.populationHash,
          });
        }
        const drafts = await m.query(
          'SELECT id,revision,input FROM finance_gl_drafts WHERE book_id=$1 AND maker_subject_id=$2 AND maker_person_id=$3 AND candidate_id IS NULL ORDER BY updated_at DESC',
          [b.book_id, a.subjectId, a.naturalPersonId],
        );
        return {
          readiness: await glReadiness(m, b),
          drafts,
          accounts: chart.accounts,
          roles: chart.roles,
          components: b.context.allowedComponents.filter(
            (x) => x.origin === 'FIN02_GL',
          ),
          currencies: b.context.currencyScales,
          functionalCurrency: b.context.functionalCurrency,
          dimensions: await documentDimensionFields(m, b.company_id, b.book_id),
          documents,
          programs,
          journals,
          registers,
          reconciliations,
        };
      },
    );
  }
  save(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: ProgramInput,
    reason: string,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      reason,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        if (!input || !candidateCode(input.code) || input.code.length > 48)
          invalid('Enter a program code of up to 48 characters.');
        const { kind, code } = input,
          d = input.definition;
        validateProgram(kind, d, b.context.currencyScales[d?.currency]);
        await ownedEvidence(m, b, d.evidence);
        const [last]: Program[] = await m.query(
          versions +
            ' WHERE p.book_id=$1 AND p.code=$2 ORDER BY revision DESC LIMIT 1',
          [b.book_id, code],
        );
        const chart = await bookChart(m, b);
        let definition: ProgramDefinition & { reconciliation?: unknown } = {
          ...d,
        };
        if (
          ['ACCRUAL', 'PREPAYMENT', 'INTERBRANCH', 'ALLOCATION'].includes(kind)
        ) {
          const first = programLines(
            kind,
            d,
            'INITIAL',
            0,
            b.context.currencyScales[d.currency],
          );
          await voucherLines(
            m,
            b,
            kind,
            { date: d.start, currency: d.currency, lines: first },
            chart,
          );
          const types = (r: string | undefined) =>
            chart.roles.find((x) => x.code === r)?.accountType;
          if (kind === 'ACCRUAL') {
            const income = d.accrualType === 'INCOME';
            if (
              types(d.debitRole) !== (income ? 'ASSET' : 'EXPENSE') ||
              types(d.creditRole) !== (income ? 'INCOME' : 'LIABILITY')
            )
              invalid(
                'Select the income receivable or expense payable roles matching this accrual.',
              );
            await voucherLines(
              m,
              b,
              'ACCRUAL_SETTLEMENT',
              {
                date: d.start,
                currency: d.currency,
                lines: programLines(
                  kind,
                  d,
                  'SETTLE',
                  0,
                  b.context.currencyScales[d.currency],
                ),
              },
              chart,
            );
          }
          if (kind === 'PREPAYMENT') {
            if (
              types(d.debitRole) !== 'ASSET' ||
              types(d.releaseRole) !== 'EXPENSE'
            )
              invalid(
                'Prepayment recognition needs a prepaid asset and an expense release account.',
              );
            await voucherLines(
              m,
              b,
              'PREPAYMENT_RELEASE',
              {
                date: d.start,
                currency: d.currency,
                lines: programLines(
                  kind,
                  d,
                  'AMORTIZE',
                  0,
                  b.context.currencyScales[d.currency],
                ),
              },
              chart,
            );
          }
          if (kind === 'ALLOCATION' && d.previewId) {
            const [o] = await m.query(
              'SELECT payload,subject_hash FROM finance_allocation_preview_occurrences WHERE book_id=$1 AND id=$2',
              [b.book_id, d.previewId],
            );
            if (
              !o ||
              o.subject_hash !== d.previewHash ||
              hash(o.payload) !== d.previewHash ||
              o.payload.currency !== d.currency ||
              o.payload.occurrenceDate !== d.start ||
              o.payload.decimalScale !== b.context.currencyScales[d.currency] ||
              hash(
                o.payload.lines.map(
                  (l: {
                    branch: string;
                    role: string;
                    debitMinor: string;
                    creditMinor: string;
                  }) => [
                    l.branch.toLowerCase(),
                    l.role,
                    l.debitMinor,
                    l.creditMinor,
                  ],
                ),
              ) !==
                hash(
                  first.map((l) => [
                    l.dimensions.BRANCH,
                    l.role,
                    moneyMinor(l.debit, o.payload.decimalScale).toString(),
                    moneyMinor(l.credit, o.payload.decimalScale).toString(),
                  ]),
                )
            )
              throw new ConflictException(
                'The financial allocation must match the selected immutable preview, currency, date and vector.',
              );
          }
        }
        if (kind === 'TEMPLATE')
          await voucherLines(
            m,
            b,
            'MANUAL',
            { date: d.start, currency: d.currency, lines: d.lines! },
            chart,
          );
        if (kind === 'RECURRING') {
          const template = await approved(
            m,
            b.book_id,
            d.templateId!,
            d.templateHash!,
          );
          if (
            template.kind !== 'TEMPLATE' ||
            template.definition.currency !== d.currency ||
            template.definition.start > d.firstDue! ||
            template.definition.end < dueDate(d.firstDue!, d.count! - 1)
          )
            invalid('The template must cover the schedule and currency.');
        }
        if (kind === 'RECONCILIATION') {
          if (!chart.accounts.some((x) => x.posting && x.code === d.account))
            invalid('Choose a posting account for reconciliation.');
          definition = {
            ...d,
            reconciliation: await reconciliation(m, this.ledger, a, b, d),
          };
        }
        const subject = hash({
          book: b.book_id,
          kind,
          code,
          definition,
          previousHash: input.previousHash ?? null,
        });
        if (
          last?.subject_hash === subject &&
          last.maker_person_id === a.naturalPersonId
        )
          return last;
        if (
          (last?.subject_hash ?? null) !== (input.previousHash ?? null) ||
          (last && last.kind !== kind)
        )
          throw new ConflictException(
            'Refresh the current version before revising this program.',
          );
        if (last && ['ACCRUAL', 'PREPAYMENT'].includes(kind)) {
          const [started] = await m.query(
            "SELECT 1 FROM finance_operating_postings WHERE book_id=$1 AND snapshot->>'programCode'=$2 LIMIT 1",
            [b.book_id, code],
          );
          if (started)
            throw new ConflictException(
              'An initiated register retains its approved accounting terms.',
            );
        }
        const [row] = await m.query(
          `INSERT INTO finance_gl_programs(company_id,tenant_id,legal_entity_id,book_id,code,revision,kind,definition,subject_hash,maker_user_id,maker_subject_id,maker_person_id,reason)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,subject_hash,revision`,
          [
            b.company_id,
            b.tenant_id,
            b.legal_entity_id,
            b.book_id,
            code,
            (last?.revision ?? 0) + 1,
            kind,
            definition,
            subject,
            a.sourceUserId,
            a.subjectId,
            a.naturalPersonId,
            reason,
          ],
        );
        return row;
      },
    );
  }
  decide(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    action: 'APPROVE' | 'PAUSE',
    expected: string,
    reason: string,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'REVIEW',
      reason,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        const [p] = await m.query(
          versions + ' WHERE p.book_id=$1 AND p.id=$2',
          [b.book_id, id],
        );
        if (
          !p ||
          p.subject_hash !== expected ||
          !['APPROVE', 'PAUSE'].includes(action)
        )
          invalid('Select the exact version and decision.');
        if (
          p.maker_person_id === a.naturalPersonId ||
          p.maker_subject_id === a.subjectId
        )
          throw new ForbiddenException(
            'An independent reviewer must decide this program.',
          );
        const [same] = await m.query(
          'SELECT actor_person_id FROM finance_gl_decisions WHERE program_id=$1 AND action=$2',
          [id, action],
        );
        if (same) {
          if (same.actor_person_id !== a.naturalPersonId)
            throw new ConflictException(
              'This decision already has a reviewer.',
            );
          return { id, reused: true };
        }
        if (action === 'APPROVE') {
          const [newer] = await m.query(
            'SELECT 1 FROM finance_gl_programs WHERE book_id=$1 AND code=$2 AND revision>$3',
            [b.book_id, p.code, p.revision],
          );
          if (newer || p.state !== 'DRAFT')
            throw new ConflictException(
              'Only the latest draft can be approved.',
            );
          await ownedEvidence(m, b, p.definition.evidence);
          if (p.kind === 'RECONCILIATION') {
            const r = await reconciliation(m, this.ledger, a, b, p.definition);
            if (
              r.populationHash !== p.definition.reconciliation.populationHash ||
              r.openItems ||
              !DecimalUtil.value(r.difference).isZero()
            )
              throw new ConflictException(
                'Refresh the ledger balance and resolve the outstanding difference and exceptions before sign-off.',
              );
          }
        } else if (p.state !== 'APPROVED')
          throw new ConflictException(
            'Only an approved version can be paused.',
          );
        await m.query(
          'INSERT INTO finance_gl_decisions(program_id,action,actor_subject_id,actor_person_id,reason) VALUES($1,$2,$3,$4,$5)',
          [id, action, a.subjectId, a.naturalPersonId, reason],
        );
        return { id, state: action === 'APPROVE' ? 'APPROVED' : 'PAUSED' };
      },
    );
  }

  run(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    args: {
      subjectHash: string;
      date: string;
      stage: string;
      reference?: string;
    },
    reason: string,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      reason,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s),
          p = await approved(m, b.book_id, id, args.subjectHash),
          d = p.definition,
          date = args.date;
        const [{ today }] = await m.query(
          'SELECT (statement_timestamp() AT TIME ZONE $1)::date::text today',
          [b.timezone],
        );
        if (
          !isFinanceDate(date) ||
          date < d.start ||
          date > d.end ||
          date > today
        )
          invalid('Choose a due posting date inside the effective range.');
        const [newer] = await m.query(
          "SELECT 1 FROM finance_gl_programs q JOIN finance_gl_decisions e ON e.program_id=q.id AND e.action='APPROVE' WHERE q.book_id=$1 AND q.code=$2 AND q.revision>$3 AND q.definition->>'start'<=$4",
          [b.book_id, p.code, p.revision, date],
        );
        if (newer)
          throw new ConflictException(
            'A later approved revision covers this date.',
          );
        const stage = args.stage;
        let index = 0,
          occurrence = stage,
          kind: string = p.kind,
          lines: VoucherLine[] = [],
          currency = d.currency;
        const origin: Record<string, unknown> = {
          programId: p.id,
          programCode: p.code,
          programHash: p.subject_hash,
          programKind: p.kind,
        };
        const stages: Record<ProgramKind, string[]> = {
          TEMPLATE: ['USE'],
          RECURRING: ['GENERATE'],
          ACCRUAL: ['INITIAL', 'SETTLE', 'REVERSE'],
          PREPAYMENT: ['INITIAL', 'AMORTIZE'],
          INTERBRANCH: ['TRANSFER'],
          ALLOCATION: ['ALLOCATE'],
          REVALUATION: ['REVALUE'],
          RECONCILIATION: [],
        };
        if (!stages[p.kind].includes(stage))
          invalid('Choose a supported action for this program.');
        if (stage === 'USE') {
          if (!candidateText(args.reference, 120))
            invalid('Enter a distinct reference for this template use.');
          occurrence = args.reference.toUpperCase();
          kind = 'MANUAL';
          lines = d.lines!;
        }
        if (stage === 'GENERATE' || stage === 'AMORTIZE') {
          index =
            (Number(date.slice(0, 4)) - Number(d.firstDue!.slice(0, 4))) * 12 +
            Number(date.slice(5, 7)) -
            Number(d.firstDue!.slice(5, 7));
          if (
            index < 0 ||
            index >= d.count! ||
            dueDate(d.firstDue!, index) !== date
          )
            invalid('This date is outside the monthly schedule.');
          occurrence = date.slice(0, 7);
        }
        if (stage === 'INITIAL' && date !== d.start)
          invalid('Use the approved initial recognition date.');
        if (['AMORTIZE', 'SETTLE', 'REVERSE'].includes(stage)) {
          const [initial] = await m.query(
            `SELECT j.id,p.source_id FROM finance_operating_postings p JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
          WHERE p.book_id=$1 AND p.source_type='GL_VOUCHER' AND p.snapshot->>'programCode'=$2 AND p.snapshot->>'occurrence'='INITIAL' AND j.accounting_date<=$3
          AND NOT EXISTS(SELECT 1 FROM finance_operating_postings r WHERE r.source_type='GL_REVERSAL' AND r.source_id=p.source_id AND r.book_id=p.book_id)`,
            [b.book_id, p.code, date],
          );
          if (!initial)
            throw new ConflictException(
              'Post the initial recognition entry before releasing this balance.',
            );
          if (stage === 'REVERSE')
            invalid(
              'Use the linked reversal action on the posted initial accrual.',
            );
        }
        if (d.previewId) {
          const [used] = await m.query(
            "SELECT 1 FROM finance_operating_postings WHERE book_id=$1 AND snapshot->>'previewId'=$2 AND snapshot->>'programCode'<>$3",
            [b.book_id, d.previewId, p.code],
          );
          if (used || date !== d.start)
            throw new ConflictException(
              'Use the preview once on the approved allocation date.',
            );
          origin.previewId = d.previewId;
          origin.previewHash = d.previewHash;
        }
        if (stage === 'REVALUE') occurrence = 'REVALUE/' + date;
        const attempts = await m.query(
          `SELECT p.candidate_id id,c.subject_hash hash,r.state, EXISTS(SELECT 1 FROM finance_foundation_journals j JOIN finance_foundation_journals x ON x.reversal_of=j.id AND x.mode='LIVE' WHERE j.candidate_id=p.candidate_id AND j.mode='LIVE') AS reversed FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id
        JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=p.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1)r ON true
        WHERE p.book_id=$1 AND p.snapshot->>'programCode'=$2 AND p.snapshot->>'occurrence'=$3 AND p.source_type='GL_VOUCHER' ORDER BY c.created_at DESC,c.id`,
          [b.book_id, p.code, occurrence],
        );
        const previous = attempts[0];
        if (
          previous &&
          previous.state !== 'REJECTED_INACTIVE' &&
          !(stage === 'REVALUE' && previous.reversed)
        )
          return { id: previous.id, hash: previous.hash, reused: true };
        const retrySuffix = previous ? '/R' + attempts.length : '',
          event = 'program:' + p.code + ':' + occurrence + retrySuffix;
        if (previous) origin.rejectedCandidateId = previous.id;
        if (stage === 'GENERATE') {
          const t = await approved(
            m,
            b.book_id,
            d.templateId!,
            d.templateHash!,
          );
          lines = t.definition.lines!;
          origin.templateId = t.id;
          origin.templateHash = t.subject_hash;
        } else if (stage === 'REVALUE') {
          const fx = await revalue(m, b, d, date, await bookChart(m, b));
          currency = b.context.functionalCurrency;
          const [existing] = await m.query(
            "SELECT 1 FROM finance_operating_postings p WHERE book_id=$1 AND source_type='GL_VOUCHER' AND snapshot->>'positionKey'=$2 AND snapshot->>'transactionDate'=$3 AND NOT EXISTS(SELECT 1 FROM finance_approval_requests r WHERE r.candidate_id=p.candidate_id AND r.state='REJECTED_INACTIVE') AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals j JOIN finance_foundation_journals r ON r.reversal_of=j.id AND r.mode='LIVE' WHERE j.candidate_id=p.candidate_id AND j.mode='LIVE')",
            [b.book_id, fx.positionKey, date],
          );
          if (existing)
            throw new ConflictException(
              'This period already has a revaluation request for the monetary position.',
            );
          if (!fx.lines.length) {
            await m.query(
              'INSERT INTO finance_gl_zero_revaluations(book_id,program_id,position_key,as_of,population_hash,evidence,actor_subject_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(book_id,position_key,as_of,population_hash) DO NOTHING',
              [
                b.book_id,
                p.id,
                fx.positionKey,
                date,
                fx.populationHash,
                fx,
                a.subjectId,
              ],
            );
            return { state: 'NO_MOVEMENT', ...fx };
          }
          const { lines: fxLines, ...proof } = fx;
          lines = fxLines;
          Object.assign(origin, proof);
        } else if (stage !== 'USE')
          lines = programLines(
            p.kind,
            d,
            stage,
            index,
            b.context.currencyScales[currency],
          );
        if (stage === 'AMORTIZE') kind = 'PREPAYMENT_RELEASE';
        if (stage === 'SETTLE') kind = 'ACCRUAL_SETTLEMENT';
        return this.vouchers.issue(
          m,
          a,
          b,
          kind,
          {
            reference:
              args.reference ?? p.code + '/' + occurrence + retrySuffix,
            description: d.description,
            currency,
            date,
            evidence: d.evidence,
            lines,
          },
          event,
          { ...origin, occurrence, stage },
        );
      },
    );
  }

  @Cron('0 10 * * * *', { timeZone: 'UTC' })
  async runDue() {
    const [schema] = await this.db.query(
      "SELECT to_regclass('finance_gl_programs') IS NOT NULL present",
    );
    if (!schema.present) return;
    const plans = await this.db
      .query(`SELECT p.*,(statement_timestamp() AT TIME ZONE a.timezone)::date::text today FROM finance_gl_programs p
      JOIN finance_operating_setups a ON a.book_id=p.book_id AND a.withdrawn_at IS NULL
      JOIN finance_gl_decisions d ON d.program_id=p.id AND d.action='APPROVE' WHERE p.kind IN ('RECURRING','PREPAYMENT')
      AND NOT EXISTS(SELECT 1 FROM finance_gl_decisions x WHERE x.program_id=p.id AND x.action='PAUSE') ORDER BY p.book_id,p.code,p.revision DESC`);
    for (const p of plans) {
      try {
        const scope = { legalEntityId: p.legal_entity_id, bookId: p.book_id },
          d: ProgramDefinition = p.definition;
        const actor = await this.ledger.resolveIdentity(
          { id: p.maker_user_id, companyId: p.company_id },
          scope,
        );
        if (
          actor.subjectId !== p.maker_subject_id ||
          actor.naturalPersonId !== p.maker_person_id
        )
          throw new ForbiddenException('Schedule preparer authority changed.');
        const pending = await this.db.query(
          "SELECT snapshot->>'occurrence' occurrence FROM finance_operating_postings WHERE book_id=$1 AND source_type='GL_VOUCHER' AND snapshot->>'programCode'=$2 AND NOT EXISTS(SELECT 1 FROM finance_approval_requests ar WHERE ar.candidate_id=finance_operating_postings.candidate_id AND ar.state='REJECTED_INACTIVE')",
          [p.book_id, p.code],
        );
        const done = new Set(pending.map((x) => x.occurrence));
        for (let i = 0; i < d.count!; i++) {
          const date = dueDate(d.firstDue!, i);
          if (date > p.today) break;
          if (done.has(date.slice(0, 7))) continue;
          await this.run(
            actor,
            scope,
            p.id,
            {
              subjectHash: p.subject_hash,
              date,
              stage: p.kind === 'RECURRING' ? 'GENERATE' : 'AMORTIZE',
            },
            'Prepare the due occurrence of independently approved schedule ' +
              p.code,
          );
        }
      } catch (e) {
        this.logger.warn(
          'Scheduled journal held for ' +
            p.code +
            ' in ' +
            p.book_id +
            ': ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }
    }
  }
}
