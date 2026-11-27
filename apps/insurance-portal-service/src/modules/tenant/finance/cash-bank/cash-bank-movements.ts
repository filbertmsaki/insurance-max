import Decimal from 'decimal.js';
import { bookChart } from '../accounting/general-ledger/finance-book-request';
import { type VoucherLine } from '../accounting/general-ledger/finance-gl-program';
import {
  account,
  bad,
  conflict,
  denied,
  doc,
  field,
  positive,
  uuid,
  transfers,
  corrections,
  type Context,
  type Document,
  type Account,
} from './cash-bank.types';
import { match, statementLine } from './cash-bank-statements';
import {
  current,
  record,
  voucherNumber,
} from '../payables/trade-payables/trade-payables.types';
import { activeBatch } from '../payables/trade-payables/trade-payables-payments';

async function postingLine(c: Context, id: string) {
  const line = await statementLine(c, id);
  const [prior] = await c.m.query(
    `SELECT d.id FROM finance_cb_documents d
    WHERE d.book_id=$1 AND d.kind IN ('FEE','INTEREST','EFT_SETTLE','EFT_LINK') AND d.state='POSTED' AND d.input->'fields'->>'line'=$2
      AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals j WHERE j.reversal_of=d.journal_id AND j.mode='LIVE')`,
    [c.b.book_id, line.id],
  );
  if (prior)
    conflict(
      'This bank line already has a posted settlement or adjustment. Match its existing entry or reverse the incorrect adjustment.',
    );
  return line;
}

export async function payableInstruction(
  c: Context,
  f: Record<string, string>,
) {
  const accountRow = await account(c, f.account),
    voucher = await record(c.m, c.b.book_id, uuid(f.apVoucher));
  if (
    !['PAYMENT', 'IMPREST', 'ADVANCE'].includes(voucher.kind) ||
    voucher.status !== 'APPROVED' ||
    voucher.currency !== accountRow.currency ||
    voucher.data.bankAccount !== accountRow.account_code ||
    !voucher.data.bankId ||
    (await activeBatch(c, voucher.id))
  )
    conflict(
      'Choose an approved, unbatched bank payment voucher for this account and currency.',
    );
  const bank = await record(c.m, c.b.book_id, voucher.data.bankId),
    latest = await current(
      c.m,
      c.b.book_id,
      'BANK',
      bank.reference,
      voucher.party,
    );
  if (bank.id !== latest?.id || bank.data.details.disabled)
    conflict('The payment beneficiary bank details have changed.');
  return {
    ...f,
    amount: voucher.amount,
    bank: bank.data.details.bankName,
    payee: bank.data.details.accountName,
    beneficiary: bank.data.details.accountNumber,
  };
}

async function cashier(c: Context, r: Document, a: Account) {
  if (a.kind !== 'TILL') return;
  const [ok] = await c.m.query(
    'SELECT 1 FROM finance_cb_shifts WHERE account_id=$1 AND cashier=$2 AND close_id IS NULL AND day=$3',
    [a.id, r.maker_id, r.day],
  );
  if (!ok)
    denied(
      'The cashier assigned to this open shift must prepare the movement.',
    );
}
async function availableRole(c: Context, role: string, type?: string) {
  const chart = await bookChart(c.m, c.b),
    item = chart.roles.find((x) => x.code === role);
  if (
    !item ||
    !chart.accounts.some((x) => x.code === item.accountCode && x.posting) ||
    (type && item.accountType !== type)
  )
    bad('Choose an approved ' + (type?.toLowerCase() || 'posting') + ' role.');
  const [used] = await c.m.query(
    'SELECT id FROM finance_cb_accounts WHERE book_id=$1 AND account_code=$2',
    [c.b.book_id, item!.accountCode],
  );
  if (used)
    conflict('Use a transfer to move cash between registered accounts.');
  return role;
}
export async function transfer(c: Context, id: string) {
  const [t] = await c.m.query(
    'SELECT t.*,d.kind,d.day::text,d.state FROM finance_cb_transfers t JOIN finance_cb_documents d ON d.id=t.id WHERE t.id=$1 AND d.book_id=$2 FOR UPDATE OF t',
    [uuid(id), c.b.book_id],
  );
  if (!t || t.received_id)
    conflict('Choose an outstanding transfer in this book.');
  return t;
}
async function chequeNumber(c: Context, r: Document, a: Account) {
  const f = r.input.fields;
  const [range] = await c.m.query(
    'SELECT b.* FROM finance_cb_chequebooks b JOIN finance_cb_documents d ON d.id=b.id WHERE b.id=$1 AND b.account_id=$2 AND d.day<=$3',
    [uuid(f.chequebook), a.id, r.day],
  );
  if (
    !range ||
    !/^\d{1,14}$/.test(f.serial) ||
    BigInt(f.serial) < BigInt(range.first_serial) ||
    BigInt(f.serial) > BigInt(range.last_serial)
  )
    bad('Select an unused cheque number within its approved book.');
  const [used] = await c.m.query(
    'SELECT 1 FROM finance_cb_cheques WHERE book_id=$1 AND serial=$2',
    [range.id, f.serial],
  );
  if (used) conflict('This cheque number has already been issued or retired.');
}
export async function prepareMovement(c: Context, r: Document) {
  const f = r.input.fields,
    dims = r.input.dimensions || {};
  let openingVariance = false;
  let a: Account,
    other = '',
    n: Decimal,
    dr = false,
    branch = '';
  if (corrections.includes(r.kind)) {
    const orig = await doc(c, f.target);
    if (
      orig.state !== 'POSTED' ||
      !orig.journal_id ||
      orig.day > r.day ||
      corrections.includes(orig.kind)
    )
      conflict(
        'Choose an original posted cash voucher on or before the correction date.',
      );
    if (r.kind === 'REVERSE' && orig.kind === 'CHEQUE')
      bad('Use the cheque stop, cancel or dishonour workflow.');
    if (['RECEIVE', 'FX_SETTLE'].includes(orig.kind))
      conflict('Return the settled funds using a new transfer.');
    if (transfers.includes(orig.kind)) await transfer(c, orig.id);
    if (r.kind !== 'REVERSE') {
      const [ch] = await c.m.query(
        'SELECT state FROM finance_cb_cheques WHERE id=$1',
        [orig.id],
      );
      if (
        !ch ||
        ![
          'ISSUED',
          'PRESENTED',
          ...(r.kind === 'DISHONOUR' ? ['CLEARED'] : []),
        ].includes(ch.state)
      )
        conflict('Choose a cheque eligible for this correction.');
    }
    const [used] = await c.m.query(
      'SELECT 1 FROM finance_cb_matches x JOIN finance_cb_entries e ON e.id=x.entry_id WHERE e.journal_id=$1',
      [orig.journal_id],
    );
    if (used && r.kind !== 'DISHONOUR')
      conflict(
        'Correct the statement match before reversing a cleared movement.',
      );
    const [rev] = await c.m.query(
      "SELECT id FROM finance_foundation_journals WHERE reversal_of=$1 AND mode='LIVE'",
      [orig.journal_id],
    );
    if (rev) conflict('This movement is already reversed.');
    const [posted] = await c.m.query(
      'SELECT transaction_currency currency FROM finance_foundation_journals WHERE book_id=$1 AND id=$2',
      [c.b.book_id, orig.journal_id],
    );
    return {
      currency: posted.currency as string,
      lines: [] as VoucherLine[],
      original: orig,
    };
  }
  if (r.kind === 'FX_SETTLE') {
    const [t] = await c.m.query(
      "SELECT t.* FROM finance_cb_transfers t JOIN finance_cb_documents arrival ON arrival.id=t.received_id WHERE t.id=$1 AND arrival.book_id=$2 AND arrival.kind='RECEIVE' AND arrival.day<=$3 AND t.fx_id IS NULL AND t.fx_difference<>0",
      [uuid(f.target), c.b.book_id, r.day],
    );
    if (!t)
      conflict(
        'Choose a received transfer with an outstanding exchange difference.',
      );
    const src = await account(c, t.source, false),
      residual = new Decimal(t.fx_difference);
    const pnl = await availableRole(
      c,
      f.role,
      residual.gt(0) ? 'EXPENSE' : 'INCOME',
    );
    const amount = residual.abs().toFixed(),
      dim = { ...dims, BRANCH: src.branch };
    return {
      currency: c.b.context.functionalCurrency,
      original: null,
      lines: [
        {
          role: t.transit_role,
          debit: residual.lt(0) ? amount : '0',
          credit: residual.gt(0) ? amount : '0',
          dimensions: dim,
        },
        {
          role: pnl,
          debit: residual.gt(0) ? amount : '0',
          credit: residual.lt(0) ? amount : '0',
          dimensions: dim,
        },
      ],
    };
  } else if (r.kind === 'RECEIVE') {
    const t = await transfer(c, f.target);
    if (t.day > r.day) conflict('Receipt cannot precede dispatch.');
    a = await account(c, t.destination);
    n = new Decimal(t.destination_amount);
    other = t.transit_role;
    dr = true;
  } else if (r.kind === 'EFT_SETTLE') {
    const order = await openEft(c, f.target);
    a = await account(c, order.input.fields.account);
    if (order.input.fields.apVoucher)
      conflict(
        'Settle the linked voucher through Accounts Payable, then match the existing payment.',
      );
    const l = await postingLine(c, f.line);
    n = new Decimal(order.input.fields.amount);
    if (
      l.account_id !== a.id ||
      !n.negated().eq(l.amount) ||
      l.day !== r.day ||
      order.day > r.day
    )
      conflict(
        'Select the matching bank debit for this approved EFT and use its value date.',
      );
    const payables = await payableEntries(c, order);
    if (
      payables.some((p) =>
        bankReference(l, [order.reference, p.reference, p.bank_reference]),
      )
    )
      conflict(
        'An eligible posted payable already exists. Settle this instruction against its existing cashbook entry.',
      );
    if (!bankReference(l, [order.reference, f.confirmation]))
      conflict(
        'Match the instruction reference or enter the confirmed reference from the bank.',
      );
    other = order.input.fields.role;
  } else {
    a = await account(c, f.account);
    n = positive(f.amount, c.b.context.currencyScales[a.currency]);
    if (transfers.includes(r.kind)) {
      const dst = await account(c, f.destination);
      if (a.id === dst.id)
        bad('Select distinct source and destination accounts.');
      if (a.currency !== dst.currency)
        positive(f.destinationAmount, c.b.context.currencyScales[dst.currency]);
      else if (
        f.destinationAmount &&
        !n.eq(
          positive(f.destinationAmount, c.b.context.currencyScales[a.currency]),
        )
      )
        bad('Amounts on both sides of a same-currency transfer must agree.');
      if (
        (r.kind === 'DEPOSIT' && (a.kind !== 'TILL' || dst.kind !== 'BANK')) ||
        (['REPLENISH', 'WITHDRAW'].includes(r.kind) &&
          (a.kind !== 'BANK' || dst.kind !== 'TILL')) ||
        (r.kind === 'WALLET_SETTLE' &&
          (a.kind !== 'WALLET' || dst.kind !== 'BANK')) ||
        (r.kind === 'TRANSFER' && (a.kind !== 'BANK' || dst.kind !== 'BANK'))
      )
        bad('Select the correct source and destination account types.');
      other = await availableRole(c, f.role, 'ASSET');
    } else {
      if (
        ['RECEIPT', 'PAYMENT', 'OVERAGE', 'SHORTAGE'].includes(r.kind) &&
        a.kind !== 'TILL'
      )
        bad('Choose an active physical till.');
      dr = ['RECEIPT', 'INTEREST', 'OVERAGE'].includes(r.kind);
      if (r.kind === 'CHEQUE') {
        if (a.kind !== 'BANK') bad('Choose a bank account.');
        await chequeNumber(c, r, a);
        field(f.payee, 'payee');
      }
      if (r.kind === 'FEE' || r.kind === 'INTEREST') {
        const l = await postingLine(c, f.line);
        if (r.kind === 'INTEREST') dr = new Decimal(l.amount).gt(0);
        if (
          l.account_id !== a.id ||
          l.day !== r.day ||
          !n.times(dr ? 1 : -1).eq(l.amount)
        )
          conflict(
            'Use the account, date and signed amount on the statement line.',
          );
      }
      if (r.kind === 'SHORTAGE' || r.kind === 'OVERAGE') {
        const [cnt] = await c.m.query(
          `SELECT x.* FROM finance_cb_count_register x JOIN finance_cb_cashiers assigned
           ON assigned.account_id=x.account_id AND assigned.user_id=x.cashier AND assigned.active
           WHERE x.id=$1 AND x.account_id=$2 AND x.day=$3 AND x.current_count AND x.cashier=$4
             AND (x.adjustment_id IS NULL OR x.adjustment_id=$5)`,
          [uuid(f.target), a.id, r.day, r.maker_id, r.id],
        );
        if (
          !cnt ||
          !new Decimal(cnt.expected).eq(a.balance) ||
          !new Decimal(cnt.counted).minus(cnt.expected).eq(n.times(dr ? 1 : -1))
        )
          conflict('Use a current physical count and its exact variance.');
        openingVariance = !!cnt.opening_account_id;
      }
      other = await availableRole(
        c,
        f.role,
        r.kind === 'FEE' ||
          r.kind === 'SHORTAGE' ||
          (r.kind === 'INTEREST' && !dr)
          ? 'EXPENSE'
          : r.kind === 'INTEREST' || r.kind === 'OVERAGE'
            ? 'INCOME'
            : undefined,
      );
    }
  }
  if (!openingVariance) await cashier(c, r, a);
  if (r.day < a.starts) conflict('Use an accounting date on or after cutover.');
  if (a.kind === 'TILL') {
    const next = new Decimal(a.balance).plus(dr ? n : n.negated());
    if (next.lt(0) || next.gt(a.maximum_float!))
      conflict('The movement exceeds the available cash or maximum float.');
    if (r.kind === 'PAYMENT' && n.gt(a.payment_limit!))
      conflict('Payment exceeds the single-payment limit.');
  }
  branch = a.branch;
  const dimensions = { ...dims, BRANCH: branch };
  const line = (role: string, debit: boolean): VoucherLine => ({
    role,
    debit: debit ? n.toFixed() : '0',
    credit: debit ? '0' : n.toFixed(),
    dimensions,
  });
  return {
    currency: a.currency,
    lines: [line(a.role, dr), line(other, !dr)],
    original: null,
    openingVariance,
  };
}
export async function openEft(c: Context, id: string) {
  const order = await doc(c, id, 'EFT'),
    [done] = await c.m.query(
      "SELECT 1 FROM finance_cb_documents WHERE book_id=$1 AND kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND state='POSTED' AND input->'fields'->>'target'=$2",
      [c.b.book_id, order.id],
    );
  const [proof] = await c.m.query(
    'SELECT id FROM finance_cb_ap_proofs WHERE eft_id=$1 AND released_id IS NULL',
    [order.id],
  );
  if (done || proof) conflict('This EFT is verified, settled or cancelled.');
  return order;
}
type PayableEntry = {
  id: string;
  ap_id: string;
  reference: string;
  bank_reference: string;
};
async function payableEntries(
  c: Context,
  order: Document,
  line?: string,
): Promise<PayableEntry[]> {
  const f = order.input.fields;
  return c.m.query(
    `SELECT e.id,ap.id ap_id,e.reference,ap.settlement->>'reference' bank_reference
    FROM finance_cb_entries e JOIN finance_foundation_journals j ON j.id=e.journal_id
    JOIN finance_ap_records ap ON ap.candidate_id=j.candidate_id
    JOIN finance_ap_records beneficiary ON beneficiary.id::text=ap.data->>'bankId' AND beneficiary.book_id=ap.book_id
    WHERE ap.book_id=$1 AND e.account_id=$2 AND e.amount=-$3::numeric AND ap.kind IN ('PAYMENT','ADVANCE','IMPREST')
    AND upper(trim(beneficiary.data->'details'->>'bankName'))=upper(trim($4))
    AND upper(replace(beneficiary.data->'details'->>'accountNumber',' ',''))=upper(replace($5,' ',''))
    AND NOT EXISTS(SELECT 1 FROM finance_cb_matches x WHERE x.entry_id=e.id AND x.line_id IS DISTINCT FROM $6::uuid)`,
    [c.b.book_id, f.account, f.amount, f.bank, f.beneficiary, line ?? null],
  );
}
function bankReference(
  line: { reference: string; description: string },
  references: (string | undefined)[],
) {
  return references.some(
    (value) =>
      !!value?.trim() &&
      [line.reference, line.description].some(
        (text) => text.trim().toUpperCase() === value.trim().toUpperCase(),
      ),
  );
}
export async function channelOperation(c: Context, r: Document) {
  const f = r.input.fields;
  if (r.kind === 'EFT_RELEASE') {
    field(f.description, 'verification withdrawal reason', 700);
    const approval = await doc(c, f.target, 'EFT_VERIFY');
    const [proof] = await c.m.query(
      `WITH released AS (UPDATE finance_cb_ap_proofs p SET released_id=$2 FROM finance_ap_records ap
      WHERE p.id=$1 AND p.voucher_id=ap.id AND p.released_id IS NULL AND p.entry_id IS NULL AND ap.candidate_id IS NULL RETURNING p.id) SELECT id FROM released`,
      [approval.id, r.id],
    );
    if (!proof)
      conflict(
        'Withdraw verification before the payable journal has been submitted.',
      );
    return;
  }
  if (r.kind === 'EFT_VERIFY') {
    const order = await openEft(c, f.target);
    const o = order.input.fields;
    if (!o.apVoucher)
      conflict('Choose an EFT linked to an approved payable voucher.');
    const verified = await payableInstruction(c, o);
    const line = await postingLine(c, f.line);
    const normalize = (value: string) =>
      value.trim().replace(/\s+/g, '').toUpperCase();
    const [dates] = await c.m.query(
      `SELECT (e.reviewed_at AT TIME ZONE $3)::date::text eft_day,(ap.reviewed_at AT TIME ZONE $3)::date::text voucher_day,(now() AT TIME ZONE $3)::date::text today,
      ap.due_date::text due,ap.doc_date::text doc_date,ap.sequence,ap.data->'details'->>'discountUntil' discount_until
      FROM finance_cb_documents e JOIN finance_ap_records ap ON ap.id=$2 WHERE e.id=$1`,
      [order.id, o.apVoucher, c.b.timezone],
    );
    if (
      line.account_id !== o.account ||
      !new Decimal(line.amount).eq(new Decimal(o.amount).negated()) ||
      line.day < order.day ||
      line.day < dates.eft_day ||
      line.day < dates.voucher_day ||
      line.day < (dates.due ?? dates.doc_date) ||
      (dates.discount_until && line.day > dates.discount_until) ||
      line.day > dates.today ||
      line.day > r.day ||
      !bankReference(line, [
        order.reference,
        voucherNumber(dates),
        f.confirmation,
      ]) ||
      normalize(
        field(f.sourceNumber, 'debited account on the bank evidence'),
      ) !== normalize(order.eft_export!.sourceAccountNumber) ||
      normalize(
        field(f.beneficiary, 'beneficiary account on the bank evidence'),
      ) !== normalize(verified.beneficiary) ||
      field(f.bank, 'beneficiary bank on the bank evidence').toUpperCase() !==
        verified.bank.trim().toUpperCase()
    )
      conflict(
        'Verify the debited account, beneficiary, reference, amount and value date against the approved EFT and bank evidence.',
      );
    await c.m.query(
      'INSERT INTO finance_cb_ap_proofs(id,book_id,eft_id,voucher_id,line_id) VALUES($1,$2,$3,$4,$5)',
      [r.id, c.b.book_id, order.id, o.apVoucher, line.id],
    );
    return;
  }
  if (r.kind === 'EFT_CANCEL') {
    const order = await openEft(c, f.target);
    if (order.input.fields.apVoucher) {
      const voucher = await record(
        c.m,
        c.b.book_id,
        order.input.fields.apVoucher,
      );
      if (voucher.candidate_id || voucher.settlement)
        conflict(
          'The payable already has a settlement. Match the existing payment.',
        );
    }
    return;
  }
  if (r.kind === 'EFT_LINK') {
    const order = await openEft(c, f.target),
      entryId = uuid(f.entry),
      l = await statementLine(c, f.line, entryId);
    const entry = (await payableEntries(c, order, l.id)).find(
      (e) => e.id === entryId,
    );
    if (
      !entry ||
      (order.input.fields.apVoucher &&
        order.input.fields.apVoucher !== entry.ap_id) ||
      order.input.fields.account !== l.account_id ||
      l.day < order.day ||
      l.day > r.day ||
      !bankReference(l, [
        order.reference,
        entry.reference,
        entry.bank_reference,
      ])
    )
      conflict(
        'Select the posted payable for the approved beneficiary and the bank debit carrying its reference.',
      );
    if (!l.entry_id) await match(c, l.id, entryId, r.id);
    return;
  }
  if (r.kind === 'PRESENT') {
    const orig = await doc(c, f.target, 'CHEQUE');
    if (orig.day > r.day) bad('Presentation cannot precede cheque issue.');
    const [ch] = await c.m.query(
      "UPDATE finance_cb_cheques SET state='PRESENTED' WHERE id=$1 AND state='ISSUED' RETURNING id",
      [orig.id],
    );
    if (!ch) conflict('Select an issued cheque.');
    return;
  }
  const a = await account(c, f.account);
  if (a.kind !== 'BANK') bad('Select a bank account.');
  if (r.kind === 'RETIRE_LEAF') {
    await chequeNumber(c, r, a);
    const [reserved] = await c.m.query(
      `SELECT id FROM finance_cb_documents WHERE book_id=$1 AND kind='CHEQUE' AND state IN ('PENDING','APPROVED') AND lower(input->'fields'->>'chequebook')=$2 AND ltrim(input->'fields'->>'serial','0')=ltrim($3,'0')`,
      [c.b.book_id, uuid(f.chequebook), f.serial],
    );
    if (reserved)
      conflict(
        'Resolve the outstanding cheque issue before retiring its serial.',
      );
    if (!['LOST', 'SPOILED'].includes(f.status)) bad('Choose lost or spoiled.');
    field(f.description, 'reason for retiring the cheque leaf', 700);
    await c.m.query(
      'INSERT INTO finance_cb_cheques(id,book_id,serial,state) VALUES($1,$2,$3,$4)',
      [r.id, uuid(f.chequebook), f.serial, f.status],
    );
    return;
  }
  if (r.kind === 'EFT') {
    const [snapshot] = await c.m.query(
      'SELECT finance_cb_eft_export($1,clock_timestamp()) current',
      [r.id],
    );
    if (
      !r.eft_export ||
      !snapshot.current ||
      Object.keys(snapshot.current).some(
        (k) => snapshot.current[k] !== r.eft_export![k],
      )
    )
      conflict(
        'The source bank details changed during review. Withdraw and prepare the EFT again.',
      );
    const amount = positive(f.amount, c.b.context.currencyScales[a.currency]);
    if (f.apVoucher) {
      await payableInstruction(c, f);
      const [prior] = await c.m.query(
        `SELECT 1 FROM finance_cb_documents d WHERE d.book_id=$1 AND d.kind='EFT' AND d.state='POSTED' AND d.input->'fields'->>'apVoucher'=$2 AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.kind='EFT_CANCEL' AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text)`,
        [c.b.book_id, f.apVoucher],
      );
      if (prior)
        conflict('This payable already has an approved EFT instruction.');
    }
    const [mandate] = await c.m.query(
      `SELECT 1 FROM finance_approval_mandates l JOIN finance_approval_mandates root ON root.id=coalesce(l.delegated_from_id,l.id)
      AND (root.tenant_id,root.legal_entity_id,root.book_id,root.role_code,root.currency)=(l.tenant_id,l.legal_entity_id,l.book_id,l.role_code,l.currency)
      WHERE l.book_id=$1 AND l.subject_id=$2 AND l.natural_person_id=$3 AND l.currency=$4 AND l.max_amount>=$5 AND root.delegated_from_id IS NULL AND root.max_amount>=l.max_amount
      AND root.state='ENABLED' AND l.state='ENABLED' AND root.revoked_at IS NULL AND l.revoked_at IS NULL AND l.valid_from<=now() AND (l.valid_to IS NULL OR l.valid_to>now())
      AND root.valid_from<=l.valid_from AND (root.valid_to IS NULL OR root.valid_to>=l.valid_to) AND root.natural_person_id<>$6 FOR SHARE OF l,root`,
      [
        c.b.book_id,
        c.a.subjectId,
        c.a.naturalPersonId,
        a.currency,
        amount.toFixed(),
        r.maker_person,
      ],
    );
    if (!mandate) denied('The EFT exceeds the independent reviewer mandate.');
    field(f.payee, 'beneficiary name');
    field(f.beneficiary, 'beneficiary bank account');
    field(f.bank, 'beneficiary bank');
    if (!f.apVoucher) await availableRole(c, f.role);
    return;
  }
  if (
    !/^\d{1,14}$/.test(f.first) ||
    !/^\d{1,14}$/.test(f.last) ||
    BigInt(f.last) < BigInt(f.first)
  )
    bad('Enter a valid cheque serial range.');
  const [overlap] = await c.m.query(
    'SELECT 1 FROM finance_cb_chequebooks WHERE account_id=$1 AND first_serial<=$3 AND last_serial>=$2',
    [a.id, f.first, f.last],
  );
  if (overlap) conflict('This cheque range overlaps another cheque book.');
  await c.m.query('INSERT INTO finance_cb_chequebooks VALUES($1,$2,$3,$4)', [
    r.id,
    a.id,
    f.first,
    f.last,
  ]);
}
export async function finishMovement(c: Context, r: Document, journal: string) {
  const f = r.input.fields;
  if (transfers.includes(r.kind)) {
    await account(c, f.destination);
    await c.m.query(
      'INSERT INTO finance_cb_transfers(id,source,destination,amount,transit_role,destination_amount) VALUES($1,$2,$3,$4,$5,$6)',
      [
        r.id,
        f.account,
        f.destination,
        f.amount,
        f.role,
        f.destinationAmount || f.amount,
      ],
    );
  } else if (r.kind === 'RECEIVE') {
    const t = await transfer(c, f.target);
    await c.m.query(
      `UPDATE finance_cb_transfers SET received_id=$2,fx_difference=(SELECT sum(l.functional_debit-l.functional_credit) FROM finance_foundation_lines l JOIN finance_cb_documents origin ON origin.id=$1 WHERE l.journal_id IN (origin.journal_id,$3) AND l.role_code=$4) WHERE id=$1`,
      [t.id, r.id, journal, t.transit_role],
    );
  } else if (r.kind === 'FX_SETTLE') {
    const [t] = await c.m.query(
      'WITH cleared AS (UPDATE finance_cb_transfers SET fx_id=$2 WHERE id=$1 AND fx_id IS NULL AND fx_difference<>0 RETURNING id) SELECT id FROM cleared',
      [f.target, r.id],
    );
    if (!t)
      conflict('The transfer exchange difference has already been settled.');
  } else if (r.kind === 'CHEQUE') {
    await c.m.query(
      "INSERT INTO finance_cb_cheques VALUES($1,$2,$3,'ISSUED')",
      [r.id, f.chequebook, f.serial],
    );
  } else if (corrections.includes(r.kind)) {
    const orig = await doc(c, f.target);
    const [matched] = await c.m.query(
      'SELECT 1 FROM finance_cb_matches x JOIN finance_cb_entries e ON e.id=x.entry_id WHERE e.journal_id=$1',
      [orig.journal_id],
    );
    if (matched && r.kind !== 'DISHONOUR')
      conflict('The original was cleared after the correction was submitted.');
    if (transfers.includes(orig.kind)) {
      await transfer(c, orig.id);
      await c.m.query(
        'UPDATE finance_cb_transfers SET received_id=$2 WHERE id=$1',
        [orig.id, r.id],
      );
    }
    if (!matched && r.kind !== 'DISHONOUR') {
      await c.m.query(
        `WITH offsets AS (
        SELECT x.id original,y.id correction FROM finance_cb_entries x JOIN finance_cb_entries y ON y.account_id=x.account_id AND y.amount=-x.amount
        JOIN finance_cb_accounts a ON a.id=x.account_id WHERE x.journal_id=$1 AND y.journal_id=$2 AND a.kind<>'TILL')
        UPDATE finance_cb_entries e SET offset_id=$3 FROM offsets o WHERE e.id IN(o.original,o.correction)`,
        [orig.journal_id, journal, r.id],
      );
    }
    if (r.kind !== 'REVERSE') {
      const state =
        r.kind === 'STOP'
          ? 'STOPPED'
          : r.kind === 'VOID'
            ? 'CANCELLED'
            : 'DISHONOURED';
      const [ch] = await c.m.query(
        "UPDATE finance_cb_cheques SET state=$2 WHERE id=$1 AND (state IN ('ISSUED','PRESENTED') OR ($2='DISHONOURED' AND state='CLEARED')) RETURNING id",
        [orig.id, state],
      );
      if (!ch) conflict('The cheque has already been corrected.');
    }
  } else if (['FEE', 'INTEREST', 'EFT_SETTLE'].includes(r.kind)) {
    if (r.kind === 'EFT_SETTLE') await openEft(c, f.target);
    const l = await postingLine(c, f.line);
    const [e] = await c.m.query(
      'SELECT id FROM finance_cb_entries WHERE journal_id=$1 AND account_id=$2',
      [journal, l.account_id],
    );
    if (!e) conflict('The journal does not match the bank statement account.');
    await match(c, l.id, e.id, r.id);
  }
}
