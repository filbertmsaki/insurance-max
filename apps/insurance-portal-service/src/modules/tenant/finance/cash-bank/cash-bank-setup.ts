import Decimal from 'decimal.js';
import { bookChart } from '../accounting/general-ledger/finance-book-request';
import { certifiedOpening } from '../accounting/general-ledger/finance-gl-balances';
import { documentDimensionFields } from '../foundation/finance-setup/finance-operating-dimensions';
import {
  account,
  bad,
  conflict,
  currency,
  date,
  denied,
  field,
  money,
  positive,
  staff,
  uuid,
  type Context,
  type Document,
} from './cash-bank.types';

export async function cutover(
  c: Context,
  roleCode: string,
  iso: string,
  day: string,
) {
  const { m, b } = c;
  date(day);
  currency(b, iso);
  const chart = await bookChart(m, b),
    role = chart.roles.find((x) => x.code === roleCode);
  if (
    !role?.accountCode ||
    role.accountType !== 'ASSET' ||
    !chart.accounts.some((x) => x.code === role.accountCode && x.posting)
  )
    return bad('Select a posting asset role from the approved chart.');
  const gl = role.accountCode,
    verified = await glCashBalance(c, gl, iso, day, false);
  const [unposted] = await m.query(
    `SELECT count(DISTINCT r.id)::int n FROM receipts r CROSS JOIN LATERAL (VALUES
       ('RECEIPT',(r.received_at AT TIME ZONE $5)::date),('RECEIPT_REVERSAL',(r.reversed_at AT TIME ZONE $5)::date)) effect(kind,day)
     WHERE r.company_id=$1 AND r.settlement_account_code=$2 AND r.deleted_at IS NULL
       AND r.status IN ('POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED','REVERSED') AND effect.day IS NOT NULL
       AND (effect.day>=$4 OR EXISTS(SELECT 1 FROM finance_operating_postings staged WHERE staged.book_id=$3 AND staged.source_type=effect.kind AND staged.source_id=r.id))
       AND NOT EXISTS(SELECT 1 FROM finance_operating_postings p JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' WHERE p.book_id=$3 AND p.source_type=effect.kind AND p.source_id=r.id)`,
    [b.company_id, gl, b.book_id, day, b.timezone],
  );
  return {
    ...verified,
    role: role.code,
    accountCode: gl,
    pendingReceipts: unposted.n,
  };
}

export async function glCashBalance(
  c: Context,
  gl: string,
  iso: string,
  day: string,
  inclusive: boolean,
) {
  const { m, b } = c;
  const certificate = await certifiedOpening(m, b.book_id, day);
  let base = new Decimal(
    certificate.payload.balances.find(
      (x: { accountCode: string }) => x.accountCode === gl,
    )?.signedBalance ?? 0,
  );
  const functional = iso === b.context.functionalCurrency;
  if (!functional) {
    const [positions] = await m.query(
      "SELECT sum((x->>'foreign')::numeric)::text total FROM finance_gl_fx_opening_sets s CROSS JOIN LATERAL jsonb_array_elements(s.payload) x WHERE s.opening_id=$1 AND s.account_code=$2 AND x->>'currency'=$3",
      [certificate.id, gl, iso],
    );
    if (positions.total == null && !base.isZero())
      conflict(
        'Certify the foreign currency opening positions in the general ledger first.',
      );
    base = new Decimal(positions.total ?? 0);
  }
  const [prior] = await m.query(
    `SELECT coalesce(sum(CASE WHEN $6 THEN l.functional_debit-l.functional_credit ELSE l.transaction_debit-l.transaction_credit END),0)::text net FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id WHERE l.book_id=$1 AND l.account_code=$2 AND j.mode='LIVE' AND j.accounting_date>=$3 AND (j.accounting_date<$4 OR ($7 AND j.accounting_date=$4)) AND ($6 OR j.transaction_currency=$5)`,
    [b.book_id, gl, certificate.payload.date, day, iso, functional, inclusive],
  );
  return {
    opening: base.plus(prior.net).toFixed(),
    certificate: certificate.id as string,
    functional,
  };
}

export async function registerAccount(c: Context, r: Document) {
  const { m, b } = c,
    f = r.input.fields,
    kind = f.type,
    iso = currency(b, f.currency),
    scale = b.context.currencyScales[iso];
  if (!['BANK', 'TILL', 'WALLET'].includes(kind))
    bad('Choose bank, till or wallet.');
  const branch = uuid(f.branch),
    dimensions = await documentDimensionFields(m, b.company_id, b.book_id);
  if (
    !dimensions
      .find((d) => d.code === 'BRANCH')
      ?.options.some((x) => x.value === branch)
  )
    bad('Select a branch in the active book.');
  const preview = await cutover(c, f.role, iso, r.day),
    gl = preview.accountCode,
    till = kind === 'TILL';
  const parent = await cashMaster(
    c,
    till ? f.office : f.institution,
    till ? 'OFFICE' : 'BANK',
  );
  const office = till ? parent.id : null;
  if (till && parent.branch !== branch)
    conflict('The till branch must match its cash office.');
  const institution = till ? null : parent.id;
  const manager = till ? await staff(c, f.manager) : null;
  const maximum = till ? positive(f.maximum, scale) : null,
    limit = till ? positive(f.limit, scale) : null,
    minimum = till || f.minimum ? money(f.minimum, scale) : null;
  if (maximum && (limit!.gt(maximum) || minimum!.gt(maximum)))
    bad('Till thresholds must fit within the maximum float.');
  const opening = money(f.opening, scale, !till),
    functional = preview.functional;
  if (till && preview.pendingReceipts)
    conflict(
      'Post the pending receipts for this till GL account before cutover.',
    );
  if (!opening.eq(preview.opening))
    conflict(
      'Opening cash must equal the certified GL balance before the cutover date.',
    );
  if (maximum && opening.gt(maximum))
    conflict('Opening cash exceeds the maximum float.');
  await m.query(
    `INSERT INTO finance_cb_accounts(id,book_id,code,name,kind,currency,role,account_code,branch,institution,office,account_number,purpose,manager_id,starts,opening,certificate,maximum_float,payment_limit,minimum_alert) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      r.id,
      b.book_id,
      r.reference,
      field(f.name, 'account name'),
      kind,
      iso,
      preview.role,
      gl,
      branch,
      institution,
      office,
      till ? null : field(f.number, 'bank or wallet number', 100),
      field(f.purpose, 'account purpose'),
      manager,
      r.day,
      opening.toFixed(),
      preview.certificate,
      maximum?.toFixed(),
      limit?.toFixed(),
      minimum?.toFixed(),
    ],
  );
  // Bring in journals already posted on or after cutover without reposting them.
  await m.query(
    `INSERT INTO finance_cb_entries(account_id,journal_id,line_key,day,reference,amount)
    SELECT $1,j.id,l.line_key,j.accounting_date,coalesce(op.snapshot->>'reference',j.journal_no,j.id::text),
      CASE WHEN $6 THEN l.functional_debit-l.functional_credit ELSE l.transaction_debit-l.transaction_credit END
    FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id LEFT JOIN finance_operating_postings op ON op.candidate_id=j.candidate_id
    WHERE j.book_id=$2 AND l.account_code=$3 AND j.mode='LIVE' AND j.accounting_date>=$4 AND ($6 OR j.transaction_currency=$5) AND (CASE WHEN $6 THEN l.functional_debit-l.functional_credit ELSE l.transaction_debit-l.transaction_credit END)<>0`,
    [r.id, b.book_id, gl, r.day, iso, functional],
  );
  if (till) {
    const current = await account(c, r.id);
    if (
      new Decimal(current.balance).lt(0) ||
      new Decimal(current.balance).gt(maximum!)
    )
      conflict(
        'The opening and existing journals must fit the approved till float.',
      );
  }
  if (f.openItems?.trim()) {
    if (till) bad('Opening timing items apply to bank accounts and wallets.');
    const refs = new Set<string>();
    for (const row of f.openItems.trim().split(/\r?\n/)) {
      const parts = row.split('|');
      if (parts.length !== 2)
        bad('Use one reference | signed amount per opening item.');
      const ref = field(parts[0], 'opening item reference'),
        n = money(parts[1]?.trim(), scale, true);
      if (refs.has(ref) || n.isZero())
        bad('Opening items need distinct references and non-zero amounts.');
      refs.add(ref);
      const [e] = await m.query(
        'INSERT INTO finance_cb_entries(account_id,day,reference,amount,cutover) VALUES($1,$2,$3,$4,true) RETURNING id',
        [r.id, r.day, ref, n.toFixed()],
      );
      await m.query('INSERT INTO finance_cb_timing VALUES($1,$2)', [
        e.id,
        r.id,
      ]);
    }
  }
}

export async function cashMaster(c: Context, id: unknown, kind?: string) {
  const [row] = await c.m.query(
    'SELECT * FROM finance_cb_masters WHERE book_id=$1 AND id=$2 AND active',
    [c.b.book_id, uuid(id)],
  );
  if (!row || (kind && kind !== row.kind))
    conflict('Choose an active bank or cash office in this book.');
  return row;
}
async function maintainMaster(c: Context, r: Document) {
  const { m, b } = c,
    f = r.input.fields;
  const original = ['BANK', 'OFFICE'].includes(r.kind)
    ? null
    : await cashMaster(c, f.master);
  if (original) {
    const [used] = await m.query(
      'SELECT id FROM finance_cb_accounts WHERE active AND $1 IN(office,institution) LIMIT 1',
      [original.id],
    );
    if (
      used &&
      (r.kind === 'CLOSE_MASTER' ||
        (r.kind === 'AMEND_OFFICE' && f.branch !== original.branch))
    )
      conflict(
        'Close or transfer the active accounts before changing their bank or office branch.',
      );
    if (r.kind === 'CLOSE_MASTER') {
      await m.query(
        'UPDATE finance_cb_masters SET active=false,decision_id=$2 WHERE id=$1',
        [original.id, r.id],
      );
      return;
    }
  }
  const office = ['OFFICE', 'AMEND_OFFICE'].includes(r.kind),
    kind = office ? 'OFFICE' : 'BANK';
  if (original && original.kind !== kind)
    bad('Select the correct type of bank or office.');
  const branch = office ? uuid(f.branch) : null;
  if (office) {
    const dims = await documentDimensionFields(m, b.company_id, b.book_id);
    if (
      !dims
        .find((d) => d.code === 'BRANCH')
        ?.options.some((x) => x.value === branch)
    )
      bad('Choose an approved company branch.');
  }
  await m.query(
    `INSERT INTO finance_cb_masters(id,book_id,code,kind,name,branch,branch_name,swift,decision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,branch=excluded.branch,branch_name=excluded.branch_name,swift=excluded.swift,decision_id=excluded.decision_id`,
    [
      original?.id ?? r.id,
      b.book_id,
      original?.code ?? r.reference,
      kind,
      field(f.name, 'name'),
      branch,
      office ? null : field(f.branchName, 'bank branch or operator'),
      office || !f.swift ? null : field(f.swift, 'SWIFT / BIC', 11),
      r.id,
    ],
  );
}
export async function setupOrShift(c: Context, r: Document) {
  const { m, b } = c,
    f = r.input.fields;
  if (
    ['BANK', 'OFFICE', 'AMEND_BANK', 'AMEND_OFFICE', 'CLOSE_MASTER'].includes(
      r.kind,
    )
  )
    return maintainMaster(c, r);
  if (r.kind === 'ACCOUNT') return registerAccount(c, r);
  const ac = await account(c, f.account);
  if (r.day < ac.starts) conflict('Use a date on or after account activation.');
  if (r.kind === 'AMEND_ACCOUNT') {
    const till = ac.kind === 'TILL',
      scale = b.context.currencyScales[ac.currency];
    const maximum = till ? positive(f.maximum, scale) : null,
      limit = till ? positive(f.limit, scale) : null,
      min = till || f.minimum ? money(f.minimum, scale) : null;
    const manager = till ? await staff(c, f.manager) : null;
    if (
      till &&
      (limit!.gt(maximum!) || min!.gt(maximum!) || maximum!.lt(ac.balance))
    )
      bad(
        'The limits must accommodate the current cash and fit the approved float.',
      );
    if (till) {
      const [pending] = await m.query(
        'SELECT 1 FROM finance_cb_shifts WHERE account_id=$1 AND close_id IS NULL UNION ALL SELECT 1 FROM finance_cb_cashiers WHERE account_id=$1 AND user_id=$2 AND active LIMIT 1',
        [ac.id, manager],
      );
      if (pending)
        conflict(
          'Close the till and choose an approver separate from its cashiers.',
        );
    }
    await m.query(
      'UPDATE finance_cb_accounts SET name=$2,purpose=$3,maximum_float=$4,payment_limit=$5,minimum_alert=$6,manager_id=$7,account_number=coalesce($8,account_number) WHERE id=$1',
      [
        ac.id,
        field(f.name, 'account name'),
        field(f.purpose, 'account purpose'),
        maximum?.toFixed(),
        limit?.toFixed(),
        min?.toFixed(),
        manager,
        till ? null : field(f.number, 'bank or wallet number'),
      ],
    );
    return;
  }
  if (r.kind === 'DEACTIVATE') {
    const [pending] = await m.query(
      `SELECT 1 WHERE EXISTS(SELECT 1 FROM finance_cb_shifts WHERE account_id=$1 AND close_id IS NULL) OR EXISTS(SELECT 1 FROM finance_cb_transfers WHERE $1 IN(source,destination) AND (received_id IS NULL OR (fx_difference<>0 AND fx_id IS NULL))) OR EXISTS(SELECT 1 FROM finance_cb_entry_clearing e WHERE e.account_id=$1 AND $2<>'TILL' AND e.offset_id IS NULL AND e.remaining_amount<>0) OR EXISTS(SELECT 1 FROM finance_cb_statements WHERE account_id=$1 AND signoff_id IS NULL AND withdrawn_id IS NULL)
      OR EXISTS(SELECT 1 FROM finance_cb_documents d WHERE (d.input->'fields'->>'account'=$1::text OR d.input->'fields'->>'destination'=$1::text) AND (d.state IN ('PENDING','APPROVED') AND d.id<>$3 OR d.kind='EFT' AND d.state='POSTED' AND NOT EXISTS(SELECT 1 FROM finance_cb_ap_proofs p WHERE p.eft_id=d.id AND p.entry_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text)))
      OR EXISTS(SELECT 1 FROM finance_ap_status v WHERE v.book_id=$4 AND v.kind IN ('PAYMENT','ADVANCE','IMPREST') AND v.data->>'bankAccount'=$5 AND v.status IN ('PENDING','APPROVED','AWAITING_GL'))`,
      [ac.id, ac.kind, r.id, b.book_id, ac.account_code],
    );
    if (pending || !new Decimal(ac.balance).eq(0))
      conflict(
        'Clear the account balance, commitments, shifts, transfer exchange differences and statement items before closure.',
      );
    await m.query('UPDATE finance_cb_accounts SET active=false WHERE id=$1', [
      ac.id,
    ]);
    return;
  }
  if (ac.kind !== 'TILL') bad('Select a physical till.');
  const [shift] = await m.query(
    'SELECT *,day::text FROM finance_cb_shifts WHERE account_id=$1 AND close_id IS NULL FOR UPDATE',
    [ac.id],
  );
  if (r.kind === 'CASHIER' || r.kind === 'REVOKE_CASHIER') {
    const user = await staff(c, f.cashier);
    if (user === ac.manager_id)
      bad('Assign a cashier separate from the replenishment approver.');
    if (shift?.cashier === user && r.kind === 'REVOKE_CASHIER')
      conflict('Close the cashier shift before ending the assignment.');
    await m.query(
      'INSERT INTO finance_cb_cashiers VALUES($1,$2,$3,$4) ON CONFLICT(account_id,user_id) DO UPDATE SET active=excluded.active,decision_id=excluded.decision_id',
      [ac.id, user, r.kind === 'CASHIER', r.id],
    );
    return;
  }
  const [allowed] = await m.query(
    'SELECT 1 FROM finance_cb_cashiers WHERE account_id=$1 AND user_id=$2 AND active',
    [ac.id, r.maker_id],
  );
  if (!allowed) denied('Only an assigned cashier can operate this till.');
  const counted = physicalCount(f, b.context.currencyScales[ac.currency]);
  if (r.kind === 'OPEN') {
    if (shift || !counted.eq(ac.balance))
      conflict(
        'Close the previous shift and count the full book float before opening.',
      );
    const [later] = await m.query(
      'SELECT 1 FROM finance_cb_shifts WHERE account_id=$1 AND day>$2 UNION ALL SELECT 1 FROM finance_cb_entries WHERE account_id=$1 AND day>$2 LIMIT 1',
      [ac.id, r.day],
    );
    if (later) conflict('A later till movement or shift already exists.');
    await m.query(
      'INSERT INTO finance_cb_shifts(id,account_id,cashier,day,opening) VALUES($1,$2,$3,$4,$5)',
      [r.id, ac.id, r.maker_id, r.day, counted.toFixed()],
    );
    return;
  }
  if (!shift || shift.cashier !== r.maker_id || shift.day !== r.day)
    denied('Use your open shift for this accounting day.');
  if (r.kind === 'CLOSE' && !counted.eq(ac.balance))
    conflict('Record a count and resolve the variance before closing.');
  if (r.kind === 'CLOSE') {
    const [pending] = await m.query(
      `SELECT id FROM finance_cb_documents WHERE shift_id=$1 AND state IN ('PENDING','APPROVED')
      UNION ALL SELECT receipt_id FROM finance_cb_receipt_shifts WHERE shift_id=$1 AND journal_id IS NULL
      UNION ALL SELECT ap.id FROM finance_ap_records ap WHERE ap.settlement->>'shiftId'=$1::text AND ap.candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals j WHERE j.candidate_id=ap.candidate_id AND j.mode='LIVE') LIMIT 1`,
      [shift.id],
    );
    if (pending)
      conflict(
        'Post or withdraw outstanding till vouchers before closing this shift.',
      );
  }
  await m.query('INSERT INTO finance_cb_counts VALUES($1,$2,$3,$4)', [
    r.id,
    shift.id,
    ac.balance,
    counted.toFixed(),
  ]);
  if (r.kind === 'CLOSE')
    await m.query(
      'UPDATE finance_cb_shifts SET close_id=$2,closing=$3 WHERE id=$1',
      [shift.id, r.id, counted.toFixed()],
    );
}
export function physicalCount(f: Record<string, string>, scale: number) {
  const total = money(f.amount, scale);
  if (f.denominations?.trim()) {
    let sum = new Decimal(0);
    for (const line of f.denominations.trim().split(/\r?\n/)) {
      const parts = line.split('*');
      if (parts.length !== 2 || !/^\d{1,9}$/.test(parts[1].trim()))
        bad('Enter denomination * count on each line.');
      sum = sum.plus(positive(parts[0].trim(), scale).times(parts[1].trim()));
    }
    if (!sum.eq(total))
      bad('The denominations must add up to the physical count.');
  }
  return total;
}
