import { ForbiddenException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
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
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { documentDimensionFields } from '../../foundation/finance-setup/finance-operating-dimensions';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import { prepareAsset } from './fixed-asset-operations';
import {
  assetRegister,
  classValuations,
  assetReport,
  ownedAssetReview,
  leaseReview,
  nextDepreciation,
} from './fixed-asset-reports';
import { record, sourceLines } from './fixed-asset-register';
import {
  code,
  conflict,
  day,
  isMaster,
  str,
  uuid,
  type Doc,
  type Input,
} from './fixed-asset.types';

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly vouchers: FinanceGlVoucherService,
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
          conflict('Choose the active primary fixed asset book.');
        return fn(m, b);
      },
    );
  }
  workspace(a: FoundationActor, s: FinanceBookSelection) {
    return this.run(a, s, 'READ', 'Read fixed assets', async (m, b) => {
      const [{ today }] = await m.query(
        'SELECT (now() AT TIME ZONE $1)::date::text today',
        [b.timezone],
      );
      const documents = await m.query(
        'SELECT d.*,d.effective_date::text FROM finance_fa_documents d WHERE book_id=$1 ORDER BY sequence DESC',
        [b.book_id],
      );
      const assets = await assetRegister(m, b.book_id, today);
      const staff = await m.query(
        "SELECT u.id,u.email label FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL ORDER BY u.email",
        [b.company_id],
      );
      const evidence = await m.query(
        "SELECT v.id,d.id AS \"documentId\", d.title,v.sha256_hash hash FROM document_versions v JOIN documents d ON d.id=v.document_id AND d.company_id=v.company_id WHERE d.company_id=$1 AND v.status='AVAILABLE' AND d.status='AVAILABLE' AND ((d.owner_type='COMPANY' AND d.owner_id=$1) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$2)) ORDER BY d.title",
        [b.company_id, b.book_id],
      );
      const sources = await sourceLines(m, b.book_id, '', today, 0);
      const chart = await bookChart(m, b);
      return {
        today,
        currency: b.context.functionalCurrency,
        scale: b.context.currencyScales[b.context.functionalCurrency],
        documents,
        assets,
        leaseReview: leaseReview(assets),
        ownedAssetReview: ownedAssetReview(assets, documents, today),
        valuations: await classValuations(m, b.book_id, today),
        staff,
        evidence,
        sources,
        roles: chart.roles,
        dimensions: await documentDimensionFields(m, b.company_id, s.bookId),
        depreciation: assets
          .map((x) =>
            nextDepreciation(
              x,
              b.context.currencyScales[b.context.functionalCurrency],
            ),
          )
          .filter(Boolean),
      };
    });
  }
  sources(
    a: FoundationActor,
    s: FinanceBookSelection,
    q: string,
    to: string,
    page: number,
  ) {
    return this.run(a, s, 'READ', 'Find fixed asset funding journals', (m, b) =>
      sourceLines(m, b.book_id, q, to, page),
    );
  }
  reports(
    a: FoundationActor,
    s: FinanceBookSelection,
    from: string,
    to: string,
  ) {
    return this.run(a, s, 'READ', 'Read fixed asset report', (m, b) =>
      assetReport(m, b, from, to),
    );
  }
  submit(a: FoundationActor, s: FinanceBookSelection, v: Input) {
    return this.run(a, s, 'PREPARE', 'Prepare fixed asset document', (m, b) =>
      this.save(m, b, a, v),
    );
  }
  private async save(
    m: EntityManager,
    b: ActivePostingBook,
    a: FoundationActor,
    input: Input,
    classRun = false,
  ): Promise<Doc> {
    const key = str(input?.requestKey, 'request key', 180);
    const fingerprint = hash(input);
    const [old] = await m.query(
      'SELECT d.*,d.effective_date::text FROM finance_fa_documents d WHERE book_id=$1 AND request_key=$2',
      [b.book_id, key],
    );
    if (old) {
      if (old.request_hash !== fingerprint || old.maker_id !== a.sourceUserId)
        conflict('The request key belongs to another fixed asset document.');
      return old;
    }
    const v = { ...input, code: code(input.code) };
    if (v.valuationRunId !== undefined) {
      if (classRun || v.kind !== 'REVALUE')
        conflict(
          'Only an individual supplemental valuation can link to a class run.',
        );
      v.valuationRunId = uuid(v.valuationRunId).toLowerCase();
    }
    if (!isMaster(v.kind)) {
      const [open] = await m.query(
        "SELECT id FROM finance_fa_documents WHERE book_id=$1 AND code=$2 AND state IN ('PENDING','APPROVED') AND kind NOT IN ('GROUP','LOCATION','CATEGORY')",
        [b.book_id, v.code],
      );
      if (open)
        conflict('Finish or withdraw the pending document for this asset.');
    } else {
      const [dup] = await m.query(
        "SELECT id FROM finance_fa_documents WHERE book_id=$1 AND code=$2 AND kind=$3 AND effective_date=$4 AND state NOT IN ('REJECTED','CANCELLED')",
        [b.book_id, v.code, v.kind, day(v.date)],
      );
      if (dup) conflict('This setup code already has a version on this date.');
    }
    const { plan, prior } = await prepareAsset(m, b, v);
    if (v.kind === 'REVALUE' && !classRun) {
      const [period] = await m.query(
        "SELECT id FROM finance_foundation_periods WHERE book_id=$1 AND mode='LIVE' AND period_kind='REGULAR' AND state='OPEN' AND starts_on<=$2 AND ends_before>$2 FOR SHARE",
        [b.book_id, v.date],
      );
      if (!period)
        conflict('Open the valuation period before preparing a valuation.');
      if (v.valuationRunId !== undefined) {
        const [run] = await m.query(
          `SELECT 1 FROM finance_fa_valuation_coverage($1,greatest($2::date,(now() AT TIME ZONE $3)::date)) v
           WHERE v.run_id::text=$4 AND v.effective_date=$2 AND v.category=$5 AND v.reference=$6 AND $7=ANY(v.missing)`,
          [
            b.book_id,
            v.date,
            b.timezone,
            v.valuationRunId,
            plan.asset!.category,
            v.reference,
            v.code,
          ],
        );
        if (!run)
          conflict(
            'Select an uncovered asset in the specified class valuation.',
          );
      } else {
        const same = (await assetRegister(m, b.book_id, v.date)).filter(
          (x) => x.category === plan.asset!.category && x.status === 'ACTIVE',
        );
        if (same.length > 1)
          conflict(
            'Use the class revaluation run to include all active assets in this category.',
          );
      }
    }
    const [r] = await m.query(
      `INSERT INTO finance_fa_documents(book_id,company_id,kind,code,reference,effective_date,currency,request_key,request_hash,input,plan,prior_id,reversal_of,maker_id,maker_person)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *,effective_date::text`,
      [
        b.book_id,
        b.company_id,
        v.kind,
        v.code,
        v.reference,
        v.date,
        b.context.functionalCurrency,
        key,
        fingerprint,
        v,
        plan,
        prior,
        v.kind === 'REVERSE' ? v.original : null,
        a.sourceUserId,
        a.naturalPersonId,
      ],
    );
    return r;
  }
  private async runOnce(
    m: EntityManager,
    b: ActivePostingBook,
    a: FoundationActor,
    key: string,
    input: unknown,
    create: () => Promise<Doc[]>,
  ) {
    const fingerprint = hash(input);
    const [old] = await m.query(
      'SELECT * FROM finance_fa_runs WHERE book_id=$1 AND request_key=$2',
      [b.book_id, key],
    );
    if (old) {
      if (old.request_hash !== fingerprint || old.maker_id !== a.sourceUserId)
        conflict('This run key belongs to a different request.');
      const docs: Doc[] = [];
      for (const id of old.document_ids)
        docs.push(await record(m, b.book_id, id));
      return docs;
    }
    const rows = await create();
    await m.query(
      'INSERT INTO finance_fa_runs(book_id,request_key,request_hash,maker_id,document_ids) VALUES($1,$2,$3,$4,$5)',
      [b.book_id, key, fingerprint, a.sourceUserId, rows.map((r) => r.id)],
    );
    return rows;
  }
  revaluation(
    a: FoundationActor,
    s: FinanceBookSelection,
    v: Pick<Input, 'date' | 'reference' | 'requestKey' | 'evidence'> & {
      category: string;
      values: (Pick<Input, 'code' | 'life' | 'residual'> & {
        amount: string;
      })[];
    },
  ) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Prepare class revaluation',
      async (m, b) => {
        const key = str(v.requestKey, 'run key', 95);
        return this.runOnce(
          m,
          b,
          a,
          key,
          { kind: 'REVALUE', ...v },
          async () => {
            const period = await m.query(
              "SELECT id FROM finance_foundation_periods WHERE book_id=$1 AND mode='LIVE' AND period_kind='REGULAR' AND state='OPEN' AND starts_on<=$2 AND ends_before>$2 FOR SHARE",
              [b.book_id, day(v.date)],
            );
            if (!period.length)
              conflict(
                'Open the valuation period before starting a class run.',
              );
            const assets = (
              await assetRegister(m, b.book_id, day(v.date))
            ).filter(
              (x) => x.category === code(v.category) && x.status === 'ACTIVE',
            );
            if (
              !Array.isArray(v.values) ||
              !assets.length ||
              v.values.length !== assets.length
            )
              conflict(
                'Provide a valuation for every active asset in this category.',
              );
            const prices = new Map(v.values.map((x) => [code(x.code), x]));
            const out: Doc[] = [];
            for (const x of assets) {
              const valuation = prices.get(x.code);
              if (!valuation)
                conflict(
                  'The valuation population changed. Review the class again.',
                );
              out.push(
                await this.save(
                  m,
                  b,
                  a,
                  {
                    kind: 'REVALUE',
                    date: v.date,
                    evidence: v.evidence,
                    reference: v.reference,
                    code: x.code,
                    amount: valuation.amount,
                    ...(valuation.life !== undefined && {
                      life: valuation.life,
                    }),
                    ...(valuation.residual !== undefined && {
                      residual: valuation.residual,
                    }),
                    requestKey: key + '/' + x.code,
                  },
                  true,
                ),
              );
            }
            return out;
          },
        );
      },
    );
  }
  batch(
    a: FoundationActor,
    s: FinanceBookSelection,
    v: Pick<Input, 'date' | 'reference' | 'requestKey' | 'evidence'> & {
      codes: string[];
    },
  ) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Prepare monthly asset depreciation',
      async (m, b) => {
        if (!Array.isArray(v.codes) || !v.codes.length || v.codes.length > 500)
          conflict('Select between one and 500 assets for the run.');
        const key = str(v.requestKey, 'run key', 95);
        return this.runOnce(
          m,
          b,
          a,
          key,
          { kind: 'DEPRECIATE', ...v },
          async () => {
            const out: Doc[] = [];
            for (const id of [...new Set(v.codes.map(code))].sort()) {
              out.push(
                await this.save(m, b, a, {
                  kind: 'DEPRECIATE',
                  date: day(v.date),
                  code: id,
                  reference: v.reference,
                  evidence: v.evidence,
                  requestKey: key + '/' + id,
                }),
              );
            }
            return out;
          },
        );
      },
    );
  }
  private async current(m: EntityManager, b: ActivePostingBook, r: Doc) {
    const prepared = await prepareAsset(m, b, r.input);
    // Older pending plans have no separate ownership field. Compare their original
    // accounting and schedule exactly, including the previously approved end date.
    const lease = prepared.plan.asset?.lease;
    if (lease && r.plan.asset?.lease && !r.plan.asset.lease.ownershipBasis)
      delete lease.ownershipBasis;
    if (prepared.prior !== r.prior_id || hash(prepared.plan) !== hash(r.plan))
      conflict('The source or asset has changed. Prepare a new document.');
  }
  private async apply(
    m: EntityManager,
    b: ActivePostingBook,
    r: Doc,
    journal: string | null,
  ) {
    if (!isMaster(r.kind) && r.kind !== 'OPENING') {
      const [p] = await m.query(
        "SELECT id FROM finance_foundation_periods WHERE book_id=$1 AND mode='LIVE' AND state='OPEN' AND starts_on<=$2 AND ends_before>$2 AND coalesce(to_jsonb(finance_foundation_periods)->>'period_kind','REGULAR')='REGULAR' FOR SHARE",
        [b.book_id, r.effective_date],
      );
      if (!p) conflict('Open the regular period for this asset transaction.');
    }
    if (r.plan.source) {
      const x = r.plan.source;
      await m.query(
        'INSERT INTO finance_fa_sources(document_id,journal_id,line_key,amount) VALUES($1,$2,$3,$4)',
        [r.id, x.journal, x.line, x.amount],
      );
    }
    if (r.reversal_of)
      await m.query(
        'UPDATE finance_fa_sources SET released_by=$2 WHERE document_id=$1 AND released_by IS NULL',
        [r.reversal_of, r.id],
      );
    await m.query(
      "UPDATE finance_fa_documents SET state='POSTED',journal_id=$2,posted_at=now() WHERE id=$1",
      [r.id, journal],
    );
  }
  review(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    action: 'approve' | 'reject' | 'cancel',
    why: string,
  ) {
    const reason = str(why, 'decision reason', 1000);
    return this.run(
      a,
      s,
      action === 'cancel' ? 'PREPARE' : 'REVIEW',
      reason,
      async (m, b) => {
        const r = await record(m, b.book_id, id),
          next =
            action === 'cancel'
              ? 'CANCELLED'
              : action === 'reject'
                ? 'REJECTED'
                : 'APPROVED';
        if (action === 'cancel') {
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
            !['PENDING', 'APPROVED'].includes(r.state) ||
            (r.candidate_id && !rejected)
          )
            conflict(
              'Withdraw a pending document or one whose journal was rejected.',
            );
          await m.query(
            "UPDATE finance_fa_documents SET state='CANCELLED',reason=$2 WHERE id=$1",
            [id, reason],
          );
        } else {
          if (
            r.maker_id === a.sourceUserId ||
            r.maker_person === a.naturalPersonId
          )
            throw new ForbiddenException(
              'An independent person must review the asset document.',
            );
          if (
            r.state === next ||
            (action === 'approve' && r.state === 'POSTED')
          )
            return r;
          if (r.state !== 'PENDING')
            conflict('This document already has a decision.');
          if (action === 'approve') {
            await this.current(m, b, r);
            if (new Decimal(r.plan.amount).gt(0)) {
              const [mandate] = await m.query(
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
                  r.plan.amount,
                  r.maker_person,
                ],
              );
              if (!mandate)
                throw new ForbiddenException(
                  'The asset transaction exceeds the independent reviewer mandate.',
                );
            }
          }
          await m.query(
            'UPDATE finance_fa_documents SET state=$2,reviewer_id=$3,reviewer_person=$4,reviewed_at=now(),reason=$5 WHERE id=$1',
            [id, next, a.sourceUserId, a.naturalPersonId, reason],
          );
          if (action === 'approve' && !r.plan.lines.length)
            await this.apply(m, b, r, null);
        }
        return record(m, b.book_id, id);
      },
    );
  }
  post(a: FoundationActor, s: FinanceBookSelection, id: string) {
    return this.run(
      a,
      s,
      'PREPARE',
      'Submit approved fixed asset journal',
      async (m, b) => {
        const r = await record(m, b.book_id, id);
        if (
          r.maker_id !== a.sourceUserId ||
          r.maker_person !== a.naturalPersonId
        )
          throw new ForbiddenException(
            'The original preparer submits the approved journal.',
          );
        if (r.state === 'POSTED' || (r.state === 'APPROVED' && r.candidate_id))
          return r;
        if (r.state !== 'APPROVED' || !r.plan.lines.length)
          conflict('Select an approved asset document with journal lines.');
        await this.current(m, b, r);
        const voucher = {
          reference: 'FA-' + r.sequence,
          description: r.kind + ' ' + r.code + ' ' + r.reference,
          date: r.effective_date,
          currency: r.currency,
          evidence: r.input.evidence,
          lines: r.plan.lines,
        };
        let candidate: { id: string };
        if (r.reversal_of) {
          const orig = await record(m, b.book_id, r.reversal_of);
          candidate = await this.vouchers.reverse(
            a,
            s,
            orig.journal_id!,
            voucher,
            { manager: m, originalAssetId: orig.id, assetDocumentId: r.id },
          );
        } else
          candidate = await this.vouchers.issue(
            m,
            a,
            b,
            'MANUAL',
            voucher,
            'asset:' + r.id,
            { assetDocumentId: r.id },
          );
        await m.query(
          'UPDATE finance_fa_documents SET candidate_id=$2 WHERE id=$1',
          [id, candidate.id],
        );
        return record(m, b.book_id, id);
      },
    );
  }
  async posted(
    m: EntityManager,
    book: string,
    id: string,
    candidate: string,
    journal: string,
  ) {
    const r = await record(m, book, id);
    if (r.candidate_id !== candidate)
      conflict('Asset document and journal candidate differ.');
    if (r.state === 'POSTED' && r.journal_id === journal) return;
    if (r.state !== 'APPROVED')
      conflict('An approved asset document is required.');
    const b = await activePostingBook(m, r.company_id, 'UPDATE', book);
    if (!b) conflict('The asset book is inactive.');
    await this.current(m, b, r);
    await this.apply(m, b, r, journal);
  }
}
