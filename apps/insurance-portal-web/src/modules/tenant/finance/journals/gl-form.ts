export type Option = { value: string; label: string };
export type Line = {
  role: string;
  debit: string;
  credit: string;
  dimensions: Record<string, string>;
};
export type Evidence = { id: string; documentId: string; hash: string };
export type Voucher = {
  reference: string;
  date: string;
  description: string;
  currency: string;
  lines: Line[];
  evidence?: Evidence;
  replacementOf?: string;
  adjustmentPeriodId?: string;
};
type ReconciliationTotals = {
  ledgerBalance: string;
  statementBalance: string;
  rawDifference?: string;
  timingAdjustment?: string;
  adjustedStatementBalance?: string;
  difference: string;
  openItems: number;
};
export type Definition = {
  reconciliation?: ReconciliationTotals;
  start: string;
  end: string;
  description: string;
  currency: string;
  evidence?: Evidence;
  dimensions: Record<string, string>;
  [key: string]: unknown;
};
export type Program = {
  id: string;
  code: string;
  kind: string;
  revision: number;
  state: string;
  subject_hash: string;
  definition: Definition;
};
export type Workspace = {
  readiness: {
    releaseId: string;
    blockers: string[];
    missingNative: string[];
    counts: { candidates: number; posted: number; unposted: number };
    deployment: { sequence: string; action: string } | null;
  };
  functionalCurrency: string;
  currencies: Record<string, number>;
  accounts: {
    code: string;
    name: string;
    posting: boolean;
    parentCode: string | null;
  }[];
  roles: { code: string; accountCode: string | null; accountType: string }[];
  components: {
    component: string;
    debitRoles: string[];
    creditRoles: string[];
  }[];
  dimensions: {
    code: string;
    label: string;
    options?: Option[];
    required: boolean;
  }[];
  documents: (Evidence & { title: string })[];
  journals: {
    id: string;
    hash: string;
    type: string;
    maker: boolean;
    journalNo: string | null;
    journalId: string | null;
    state: string;
    snapshot: {
      sourceId: string;
      reference: string;
      description?: string;
      amount: string;
      currency: string;
      transactionDate: string;
      component?: string;
      programCode?: string;
      stage?: string;
      occurrence?: string;
      replacementOf?: string;
      originalJournalId?: string;
    };
  }[];
  drafts: { id: string; revision: number; input: Voucher }[];
  programs: Program[];
  insuranceMeasurements?: boolean;
  adjustmentPeriods?: {
    id: string;
    code: string;
    start: string;
    finish: string;
    ready: boolean | null;
  }[];
  scheduleHolds?: {
    programId: string;
    code: string;
    kind: string;
    date: string;
    reason: string;
  }[];
  registers: { code: string; currency: string; remaining: string }[];
  reconciliations: (ReconciliationTotals & { id: string; current: boolean })[];
};
export const today = () => new Date().toLocaleDateString('sv-SE');
export const emptyLine = (): Line => ({
  role: '',
  debit: '0',
  credit: '0',
  dimensions: {},
});
export const emptyVoucher = (currency: string): Voucher => ({
  reference: '',
  description: '',
  date: today(),
  currency,
  lines: [emptyLine(), emptyLine()],
});
export const strings = (v: string[]) =>
  v.map((value) => ({ value, label: value }));
export const roleChoices = (w: Workspace) =>
  w.roles
    .filter((r) => r.accountCode)
    .map((r) => ({
      value: r.code,
      label:
        r.accountCode +
        ' ' +
        (w.accounts.find((a) => a.code === r.accountCode)?.name ?? r.code) +
        ' (' +
        r.code +
        ')',
    }));
