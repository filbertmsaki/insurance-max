import type { EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import {
  bookChart,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { certifiedOpening } from '../../accounting/general-ledger/finance-gl-balances';
import { invalid } from '../../accounting/general-ledger/finance-gl-program';
import {
  documentDimensionFields,
  operatingDimensions,
} from '../../foundation/finance-setup/finance-operating-dimensions';
import {
  policyTerms,
  scheduleFrom,
  shiftDay,
  shiftMonth,
} from './fixed-asset-measurement';
import {
  code,
  conflict,
  day,
  roleTypes,
  str,
  uuid,
  value,
  leaseBasis,
  months,
  type Asset,
  type Doc,
  type Input,
  type Kind,
  type Master,
  type Plan,
  type Roles,
} from './fixed-asset.types';

export const viewColumns = 'd.*,d.effective_date::text';
export async function record(
  m: EntityManager,
  book: string,
  id: string,
): Promise<Doc> {
  const [d] = await m.query(
    'SELECT ' +
      viewColumns +
      ' FROM finance_fa_documents d WHERE book_id=$1 AND id=$2 FOR UPDATE',
    [book, uuid(id)],
  );
  if (!d) conflict('Select a fixed asset document from this book.');
  return d;
}
export async function head(
  m: EntityManager,
  book: string,
  id: string,
): Promise<Doc | undefined> {
  const [d] = await m.query(
    'SELECT ' +
      viewColumns +
      " FROM finance_fa_documents d WHERE book_id=$1 AND code=$2 AND state='POSTED' AND kind NOT IN ('CATEGORY','LOCATION','GROUP') ORDER BY sequence DESC LIMIT 1",
    [book, id],
  );
  return d;
}
export async function master(
  m: EntityManager,
  b: ActivePostingBook,
  kind: Kind,
  id: unknown,
  date: string,
): Promise<Master> {
  const [v] = await m.query(
    "SELECT plan->'master' data FROM finance_fa_documents WHERE book_id=$1 AND kind=$2 AND code=$3 AND state='POSTED' AND effective_date<=$4 ORDER BY effective_date DESC,sequence DESC LIMIT 1",
    [b.book_id, kind, code(id), date],
  );
  if (!v)
    conflict(
      'Select an approved ' + kind.toLowerCase() + ' effective on this date.',
    );
  return v.data;
}
export async function masterPlan(
  m: EntityManager,
  b: ActivePostingBook,
  v: Input,
): Promise<Master> {
  const name = str(v.name, 'name');
  if (v.kind === 'GROUP') return { name };
  if (v.kind === 'LOCATION') {
    const branch = uuid(v.branch);
    const fields = await documentDimensionFields(m, b.company_id, b.book_id);
    if (
      !fields
        .find((f) => f.code === 'BRANCH')
        ?.options?.some((o: { value: string }) => o.value === branch)
    )
      invalid('Choose an active branch from the book.');
    return { name, branch };
  }
  await master(m, b, 'GROUP', v.group, v.date);
  if (!['COST', 'REVALUATION'].includes(v.model!))
    invalid('Choose the category valuation model.');
  const terms = policyTerms(v),
    roles: Roles = {},
    chart = await bookChart(m, b);
  const needed = new Set([
    'asset',
    'clearing',
    'impairment',
    'loss',
    'gain',
    ...(terms.method === 'NONE' ? [] : ['accumulated', 'depreciation']),
    ...(v.model === 'REVALUATION' ? ['surplus', 'retained'] : []),
  ]);
  const accounts = new Set<string>(),
    pinned: Roles = {};
  for (const key of Object.keys(roleTypes) as (keyof Roles)[]) {
    if (!needed.has(key) && !v.roles?.[key]) continue;
    const role = chart.roles.find((r) => r.code === v.roles?.[key]);
    const account = chart.accounts.find((a) => a.code === role?.accountCode);
    if (
      !role ||
      !account?.posting ||
      !roleTypes[key].includes(account.type) ||
      accounts.has(account.code)
    )
      invalid(
        'Choose a distinct posting account with the correct type for ' +
          key +
          '.',
      );
    accounts.add(account.code);
    roles[key] = role.code;
    pinned[key] = account.code;
  }
  return {
    name,
    group: code(v.group),
    policy: { ...terms, model: v.model!, roles, accounts: pinned },
  };
}
export async function dimensions(
  m: EntityManager,
  b: ActivePostingBook,
  v: Input,
  location: Master,
) {
  const dims = { ...v.dimensions, BRANCH: location.branch! };
  if (v.dimensions?.BRANCH && v.dimensions.BRANCH !== location.branch)
    invalid('The branch must match the asset location.');
  await operatingDimensions(
    m,
    b,
    v.date,
    b.context.functionalCurrency,
    null,
    dims.BRANCH,
    dims,
  );
  return dims;
}
export async function funding(
  m: EntityManager,
  b: ActivePostingBook,
  v: Input,
  plan: Plan,
  allowed: (string | undefined)[],
  amount: Decimal,
  side: 'debit' | 'credit',
) {
  const journal = uuid(v.sourceJournal),
    line = str(v.sourceLine, 'journal line', 60);
  const [row] = await m.query(
    `SELECT l.*,j.accounting_date::text date FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id
 WHERE j.book_id=$1 AND j.id=$2 AND l.line_key=$3 AND j.mode='LIVE' AND j.kind='ORIGINAL' AND j.functional_currency=$4 AND j.accounting_date<=$5
 AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals x WHERE x.reversal_of=j.id AND x.mode='LIVE')
 AND NOT EXISTS(SELECT 1 FROM finance_operating_postings p WHERE p.candidate_id=j.candidate_id AND p.snapshot ? 'assetDocumentId') FOR UPDATE OF j`,
    [b.book_id, journal, line, b.context.functionalCurrency, v.date],
  );
  const roles = (await bookChart(m, b)).roles.filter(
    (role) =>
      allowed.includes(role.code) && role.accountCode === row?.account_code,
  );
  const sourceRole =
    roles.find((role) => role.code === row?.role_code) ?? roles[0];
  if (!row || !sourceRole)
    conflict(
      'Select a posted source line on an eligible account in this book.',
    );
  const [used] = await m.query(
    "SELECT (SELECT coalesce(sum(amount),0) FROM finance_fa_sources WHERE journal_id=$1::uuid AND line_key=$2 AND released_by IS NULL) + (SELECT coalesce(sum((plan->'source'->>'amount')::numeric),0) FROM finance_fa_documents WHERE book_id=$3 AND request_key<>$4 AND state IN ('PENDING','APPROVED') AND plan->'source'->>'journal'=$1::uuid::text AND plan->'source'->>'line'=$2) AS used",
    [journal, line, b.book_id, v.requestKey],
  );
  if (new Decimal(row['functional_' + side]).minus(used.used).lt(amount))
    conflict('The source line has insufficient unassigned value.');
  const [reversed] = await m.query(
    "SELECT id FROM finance_foundation_journals WHERE reversal_of=$1 AND mode='LIVE'",
    [journal],
  );
  if (reversed) conflict('The funding journal has been reversed.');
  const fields = await documentDimensionFields(m, b.company_id, b.book_id);
  const dims: Record<string, string> = {};
  for (const f of fields) {
    if (row.dimensions[f.code]) dims[f.code] = row.dimensions[f.code];
  }
  plan.source = { journal, line, amount: amount.toFixed() };
  return { role: sourceRole.code, dimensions: dims };
}
export async function newAsset(
  m: EntityManager,
  b: ActivePostingBook,
  v: Input,
): Promise<Asset> {
  const category = await master(m, b, 'CATEGORY', v.category, v.date),
    location = await master(m, b, 'LOCATION', v.location, v.date);
  return {
    code: code(v.code),
    name: str(v.name, 'asset name'),
    category: code(v.category),
    group: category.group!,
    location: code(v.location),
    serial: v.serial ? str(v.serial, 'serial number') : '',
    custodian: null,
    status: 'ACQUIRED',
    dimensions: await dimensions(m, b, v, location),
    policy: category.policy!,
    acquired: v.date,
    inService: null,
    end: null,
    through: null,
    cost: '0',
    accumulated: '0',
    impairment: '0',
    lossInProfit: '0',
    deficit: '0',
    surplus: '0',
    residual: '0',
    shadow: '0',
    sourceRole: '',
    sourceCost: '0',
    sourceDimensions: {},
    maintenance: null,
    verified: null,
    lease: null,
  };
}
export function startUse(a: Asset, date: string, residual: Decimal) {
  if (residual.gt(a.cost))
    invalid('Residual value exceeds the capitalized cost.');
  a.status = 'ACTIVE';
  a.inService = date;
  a.end = a.policy.method === 'NONE' ? null : shiftMonth(date, a.policy.life);
  a.through = shiftDay(date, -1);
  a.shadow = a.cost;
  a.residual = residual.toFixed();
}
export async function opening(
  m: EntityManager,
  b: ActivePostingBook,
  v: Input,
  a: Asset,
  plan: Plan,
  scale: number,
) {
  const cert = await certifiedOpening(m, b.book_id, v.date);
  if (cert.payload.date !== v.date)
    invalid('Use the effective date of the certified opening.');
  const inService = day(v.inService);
  if (inService > v.date)
    invalid('In-service date cannot follow the opening date.');
  if ((v.payments || v.leaseMonths) && v.life !== undefined)
    a.policy.life = months(v.life);
  a.acquired = inService;
  a.cost = value(v.amount, scale, true).toFixed();
  a.sourceCost = a.cost;
  startUse(a, inService, value(v.residual ?? '0', scale));
  const accum = value(v.accumulated ?? '0', scale);
  if (
    accum.gt(new Decimal(a.cost).minus(a.residual)) ||
    (a.policy.method === 'NONE' && accum.gt(0))
  )
    invalid('Check accumulated depreciation in the opening.');
  a.accumulated = accum.toFixed();
  a.shadow = new Decimal(a.cost).minus(accum).toFixed();
  a.through = shiftDay(v.date, -1);
  const impairment = value(v.openingImpairment ?? '0', scale),
    reserve = value(v.openingReserve ?? '0', scale),
    loss = value(v.openingLoss ?? impairment.toFixed(), scale);
  if (
    impairment.gt(a.shadow) ||
    loss.gt(impairment) ||
    (reserve.gt(0) && a.policy.model !== 'REVALUATION')
  )
    invalid('Check the opening impairment, loss and reserve.');
  a.impairment = impairment.toFixed();
  a.lossInProfit = loss.toFixed();
  a.deficit = loss.toFixed();
  a.surplus = reserve.toFixed();
  if (v.unimpairedValue !== undefined) {
    const ceiling = value(v.unimpairedValue, scale);
    if (
      ceiling.gt(a.shadow) ||
      ceiling.lt(new Decimal(a.shadow).minus(impairment))
    )
      invalid(
        'The unimpaired carrying amount must be between net book value and depreciated cost.',
      );
    a.shadow = ceiling.toFixed();
  }
  if (v.payments || v.leaseMonths) {
    if (!a.policy.roles.liability || !a.policy.roles.interest)
      invalid('Configure lease roles before importing an opening lease.');
    const schedule = scheduleFrom(v, scale);
    if (!a.end)
      invalid('Choose a depreciable class for an opening right-of-use asset.');
    const basis = leaseBasis(v.ownershipBasis);
    if (basis === 'LEASE_TERM')
      a.end = [a.end, schedule[schedule.length - 1].date].sort()[0];
    a.lease = {
      schedule,
      anchor: v.date,
      index: 0,
      accrued: false,
      paid: '0',
      annualRate: v.annualRate ?? '0',
      usefulLifeEnd: shiftMonth(inService, a.policy.life),
      ownershipBasis: basis,
      ownershipTransfer: basis !== 'LEASE_TERM',
      liability: schedule[0].opening,
    };
  }
  const balances: Record<string, string> = {},
    chart = await bookChart(m, b);
  for (const [role, n] of [
    [a.policy.roles.asset, a.cost],
    [a.policy.roles.accumulated, accum.neg().toFixed()],
    [a.policy.roles.impairment, impairment.neg().toFixed()],
    [a.policy.roles.surplus, reserve.neg().toFixed()],
    [
      a.policy.roles.liability,
      new Decimal(a.lease?.liability ?? 0).neg().toFixed(),
    ],
  ] as const) {
    if (new Decimal(n).isZero()) continue;
    const account = chart.roles.find((r) => r.code === role)?.accountCode;
    if (!account) invalid('The opening account must be in the approved chart.');
    const certified =
      cert.payload.balances.find(
        (x: { accountCode: string }) => x.accountCode === account,
      )?.signedBalance ?? '0';
    const [used] = await m.query(
      `SELECT coalesce(sum((d.plan->'opening'->'balances'->>$3)::numeric),0)::text used FROM finance_fa_documents d WHERE d.book_id=$1 AND d.kind='OPENING' AND d.state='POSTED' AND d.plan->'opening'->>'id'=$2 AND NOT EXISTS(SELECT 1 FROM finance_fa_documents r WHERE r.reversal_of=d.id AND r.state='POSTED')`,
      [b.book_id, cert.id, account],
    );
    const rest = new Decimal(certified).minus(used.used);
    if (rest.mul(n).lte(0) || rest.abs().lt(new Decimal(n).abs()))
      conflict(
        'Asset openings exceed the certified balance for ' + account + '.',
      );
    balances[account] = n;
  }
  plan.opening = { id: cert.id, balances };
  plan.amount = a.cost;
}

export async function sourceLines(
  m: EntityManager,
  book: string,
  search: string,
  to: string,
  page: number,
) {
  if (
    typeof search !== 'string' ||
    search.length > 160 ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 100000
  )
    invalid('Choose a valid journal search and page.');
  day(to);
  return m.query(
    `SELECT j.id journal,l.line_key line,l.account_code,l.role_code,j.accounting_date::text date,coalesce(p.snapshot->>'reference',j.sequence::text) reference,
   greatest(l.functional_debit-coalesce(used.n,0),0)::text debit,greatest(l.functional_credit-coalesce(used.n,0),0)::text credit
   FROM finance_foundation_journals j JOIN finance_foundation_lines l ON l.journal_id=j.id LEFT JOIN finance_operating_postings p ON p.candidate_id=j.candidate_id
   LEFT JOIN LATERAL(SELECT sum(amount) n FROM finance_fa_sources x WHERE x.journal_id=j.id AND x.line_key=l.line_key AND x.released_by IS NULL)used ON true
   WHERE j.book_id=$1 AND j.mode='LIVE' AND j.kind='ORIGINAL' AND NOT coalesce(p.snapshot ? 'assetDocumentId',false)
   AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals r WHERE r.mode='LIVE' AND r.reversal_of=j.id)
   AND ($2='' OR position(lower($2) in lower(concat_ws(' ',p.snapshot->>'reference',j.id::text,l.account_code,l.role_code,l.line_key)))>0) AND j.accounting_date<=$3 AND greatest(l.functional_debit,l.functional_credit)>coalesce(used.n,0) ORDER BY j.accounting_date DESC,j.sequence DESC,l.line_key LIMIT 80 OFFSET $4`,
    [book, search, to, page * 80],
  );
}
