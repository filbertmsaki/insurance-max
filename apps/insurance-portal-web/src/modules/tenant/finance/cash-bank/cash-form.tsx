import { useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  CASH_BANK_GROUPS,
  type CashBankKind,
  type CashBankInput,
} from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { Field, DocumentField } from '../journals/GlFields';
import type { Evidence, Option } from '../journals/gl-form';
import { ApEvidenceUpload } from '../payables/ApEvidenceUpload';
import { amountLabel } from '../payables/ap-export';
export type Area = keyof typeof CASH_BANK_GROUPS;
export interface CashRow {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}
export interface CashDoc extends CashRow {
  kind: CashBankKind;
  reference: string;
  state: string;
  maker_id: string;
}
export interface CashData {
  today: string;
  currency: string;
  currencies: string[];
  roles: { code: string; accountCode: string; accountType: string }[];
  dimensions: { code: string; label: string; options: Option[] }[];
  staff: Option[];
  evidence: (Evidence & { title: string })[];
  accounts: CashRow[];
  masters: CashRow[];
  rules: CashRow[];
  documents: CashDoc[];
  entries: CashRow[];
  lines: CashRow[];
  statements: CashRow[];
  shifts: CashRow[];
  payables: CashRow[];
  counts: CashRow[];
  cashiers: CashRow[];
  transfers: CashRow[];
  cheques: CashRow[];
  eftProofs?: CashRow[];
  planEntries?: { plan_id: string; entry_id: string }[];
}
const fields: Record<CashBankKind, string[]> = {
  BANK: ['name', 'branchName', 'swift'],
  OFFICE: ['name', 'branch'],
  AMEND_BANK: ['master', 'name', 'branchName', 'swift'],
  AMEND_OFFICE: ['master', 'name', 'branch'],
  CLOSE_MASTER: ['master'],
  END_RULE: ['rule'],
  ACCOUNT: [
    'type',
    'name',
    'currency',
    'branch',
    'role',
    'purpose',
    'opening',
    'institution',
    'number',
    'office',
    'manager',
    'maximum',
    'limit',
    'minimum',
    'openItems',
  ],
  CASHIER: ['account', 'cashier'],
  REVOKE_CASHIER: ['account', 'cashier'],
  AMEND_ACCOUNT: [
    'account',
    'name',
    'purpose',
    'number',
    'manager',
    'maximum',
    'limit',
    'minimum',
  ],
  DEACTIVATE: ['account'],
  OPEN: ['account', 'amount', 'denominations'],
  CLOSE: ['account', 'amount', 'denominations'],
  COUNT: ['account', 'amount', 'denominations'],
  RECEIPT: ['account', 'role', 'amount', 'description'],
  PAYMENT: ['account', 'role', 'amount', 'description'],
  SHORTAGE: ['account', 'target', 'role', 'amount'],
  OVERAGE: ['account', 'target', 'role', 'amount'],
  DEPOSIT: ['account', 'destination', 'role', 'amount', 'destinationAmount'],
  WITHDRAW: ['account', 'destination', 'role', 'amount', 'destinationAmount'],
  REPLENISH: ['account', 'destination', 'role', 'amount', 'destinationAmount'],
  TRANSFER: ['account', 'destination', 'role', 'amount', 'destinationAmount'],
  WALLET_SETTLE: [
    'account',
    'destination',
    'role',
    'amount',
    'destinationAmount',
  ],
  RECEIVE: ['target'],
  REVERSE: ['target'],
  FX_SETTLE: ['target', 'role'],
  CHEQUEBOOK: ['account', 'first', 'last'],
  RETIRE_LEAF: ['account', 'chequebook', 'serial', 'status', 'description'],
  CHEQUE: ['account', 'chequebook', 'serial', 'payee', 'role', 'amount'],
  PRESENT: ['target'],
  STOP: ['target'],
  VOID: ['target'],
  DISHONOUR: ['target'],
  EFT: [
    'account',
    'apVoucher',
    'payee',
    'beneficiary',
    'bank',
    'role',
    'amount',
  ],
  EFT_SETTLE: ['target', 'line', 'confirmation'],
  EFT_CANCEL: ['target'],
  STATEMENT: [
    'account',
    'replaces',
    'from',
    'to',
    'opening',
    'closing',
    'csv',
    'batch',
    'delimiter',
    'dateFormat',
    'dateColumn',
    'referenceColumn',
    'descriptionColumn',
    'amountColumn',
    'debitColumn',
    'creditColumn',
    'currencyColumn',
  ],
  MATCH: ['line', 'entry'],
  AUTO_MATCH: ['statement'],
  UNMATCH: ['line'],
  TIMING: ['entry'],
  SIGNOFF: ['statement'],
  FEE: ['account', 'line', 'amount', 'role'],
  INTEREST: ['account', 'line', 'amount', 'role'],
  EFT_LINK: ['target', 'line', 'entry'],
  EFT_VERIFY: [
    'target',
    'line',
    'sourceNumber',
    'bank',
    'beneficiary',
    'confirmation',
  ],
  EFT_RELEASE: ['target', 'description'],
  WITHDRAW_STATEMENT: ['statement', 'description'],
  GROUP_MATCH: ['line', 'entries'],
  SPLIT_MATCH: ['entry', 'lines'],
  LINK_PLAN: ['target', 'entry'],
  UNLINK_PLAN: ['target', 'entry'],
  PLAN: ['account', 'direction', 'amount', 'due', 'description'],
  CANCEL_PLAN: ['target'],
  BANK_RULE: ['account', 'pattern', 'classification', 'direction', 'role'],
};
export const labels: Record<string, string> = {
  replaces: 'Replace unsigned statement (optional)',
  entries: 'Cashbook entries in this bank line',
  lines: 'Bank lines for this cashbook entry',
  sourceNumber: 'Debited account number on bank evidence',
  status: 'Cheque leaf condition',
  master: 'Registered bank or cash office',
  rule: 'Active statement rule',
  apVoucher: 'Approved payable voucher (optional)',
  confirmation: 'Confirmed bank reference (if different from the instruction)',
  currencyColumn: 'Currency column (optional)',
  destinationAmount: 'Receiving amount',
  pattern: 'Statement description text',
  classification: 'Bank adjustment type',
  name: 'Name',
  branchName: 'Bank branch or operator',
  swift: 'SWIFT / BIC (if applicable)',
  branch: 'Company branch',
  type: 'Account type',
  currency: 'Currency',
  role: 'Counterpart GL role',
  purpose: 'Account purpose',
  opening: 'Opening balance',
  institution: 'Registered bank or operator',
  number: 'Bank account or wallet number',
  office: 'Cash office',
  manager: 'Replenishment approver',
  maximum: 'Maximum float',
  limit: 'Maximum single payment',
  minimum: 'Minimum balance alert',
  openItems:
    'Opening outstanding items (one reference | signed amount per line)',
  account: 'Account or till',
  cashier: 'Cashier',
  amount: 'Amount',
  denominations:
    'Denomination count (optional, one denomination * quantity per line)',
  destination: 'Destination account',
  target: 'Original document',
  first: 'First cheque number',
  last: 'Last cheque number',
  chequebook: 'Cheque book',
  serial: 'Cheque number',
  payee: 'Payee',
  beneficiary: 'Beneficiary account number',
  bank: 'Beneficiary bank',
  from: 'Statement start',
  to: 'Statement end',
  closing: 'Closing balance',
  csv: 'Bank CSV file',
  batch: 'Existing posted payment statement batch ID (alternative to CSV)',
  delimiter: 'File delimiter',
  dateFormat: 'File date format',
  dateColumn: 'Date column',
  referenceColumn: 'Reference column',
  descriptionColumn: 'Description column',
  amountColumn: 'Signed amount column',
  debitColumn: 'Debit column (split amounts)',
  creditColumn: 'Credit column (split amounts)',
  line: 'Statement line',
  entry: 'Cashbook entry',
  statement: 'Statement',
  direction: 'Cash flow direction',
  due: 'Expected date',
  description: 'Description',
};
const transfers = [
  'DEPOSIT',
  'WITHDRAW',
  'REPLENISH',
  'TRANSFER',
  'WALLET_SETTLE',
];
const options = (v: string[]): Option[] =>
  v.map((value) => ({ value, label: value }));
const mapped = <T extends CashRow>(rows: T[], label: (r: T) => string) =>
  rows.map((r) => ({ value: r.id, label: label(r) }));
const CashAmount = Decimal.clone({ precision: 42 });
const outstanding = (entry: CashRow) =>
  new CashAmount(
    String(entry.remaining_amount ?? (entry.line_id ? 0 : entry.amount)),
  );
export function CashForm({
  w,
  kind,
  company,
  scope,
  save,
  refresh,
  busy,
}: {
  w: CashData;
  kind: CashBankKind;
  company: string;
  scope: { bookId: string; legalEntityId: string };
  save: (v: CashBankInput) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  busy: boolean;
}) {
  const [f, F] = useState<Record<string, string>>({
      type: 'BANK',
      currency: w.currency,
      dateFormat: 'YYYY-MM-DD',
      delimiter: ',',
      from: w.today,
      to: w.today,
      due: w.today,
    }),
    [day, D] = useState(w.today),
    [reference, R] = useState(''),
    [proof, P] = useState<Evidence>(),
    [dims, M] = useState<Record<string, string>>({}),
    [fileError, E] = useState('');
  const cutover = useQuery({
    queryKey: ['cash-cutover', company, scope.bookId, f.role, f.currency, day],
    enabled: kind === 'ACCOUNT' && !!f.role && !!f.currency && !!day,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<{ opening: string; pendingReceipts: number }>(
          '/tenant/finance/cash-bank/cutover',
          {
            params: { ...scope, role: f.role, currency: f.currency, date: day },
            signal,
          },
        )
      ).data,
  });
  const key = useRef(crypto.randomUUID());
  const [mapping, showMapping] = useState(false);
  const change = (k: string, v: string) => {
    key.current = crypto.randomUUID();
    const line =
      k === 'line' && ['FEE', 'INTEREST'].includes(kind)
        ? w.lines.find((l) => l.id === v)
        : undefined;
    if (line) D(String(line.day));
    F((prev) => ({
      ...prev,
      ...(k === 'account'
        ? { apVoucher: '', replaces: '', chequebook: '' }
        : {}),
      ...(k === 'line' ? { entries: '', entry: '' } : {}),
      ...(k === 'entry' && kind === 'SPLIT_MATCH' ? { lines: '' } : {}),
      ...(k === 'target' ? { entry: '', line: '' } : {}),
      ...(line
        ? {
            account: String(line.account_id),
            amount: String(line.amount).replace(/^-/, ''),
            role:
              line.suggested_kind === kind
                ? String(line.suggested_role)
                : prev.role || '',
          }
        : {}),
      [k]: v,
    }));
  };
  const docs = (kinds: string[]) =>
    mapped(
      w.documents.filter((x) => x.state === 'POSTED' && kinds.includes(x.kind)),
      (x) => String(x.reference) + ' · ' + x.kind,
    );
  const splitEntry =
    kind === 'SPLIT_MATCH' && w.entries.find((e) => e.id === f.entry);
  const splitRemaining = splitEntry
    ? outstanding(splitEntry)
    : new CashAmount(0);
  const selectedLines = new Set(f.lines?.split(',').filter(Boolean) ?? []);
  const eligibleLines = splitEntry
    ? w.lines.filter(
        (l) =>
          l.account_id === splitEntry.account_id &&
          !l.entry_id &&
          !l.proof_id &&
          !l.signoff_id &&
          String(l.statement_end ?? l.day) >= String(splitEntry.day) &&
          CashAmount.sign(String(l.amount)) === CashAmount.sign(splitRemaining),
      )
    : [];
  const selectedParts = eligibleLines.filter((l) => selectedLines.has(l.id));
  const selectedAmount = selectedParts.reduce(
    (sum, l) => sum.plus(String(l.amount)),
    new CashAmount(0),
  );
  const splitExceeded = selectedAmount.abs().gt(splitRemaining.abs());
  const choices = (k: string): Option[] | undefined => {
    if (k === 'type') return options(['BANK', 'TILL', 'WALLET']);
    if (k === 'currency') return options(w.currencies);
    if (k === 'branch')
      return w.dimensions.find((x) => x.code === 'BRANCH')?.options || [];
    if (['institution', 'office', 'master'].includes(k)) {
      const type =
        k === 'office' || kind === 'AMEND_OFFICE'
          ? 'OFFICE'
          : k === 'institution' || kind === 'AMEND_BANK'
            ? 'BANK'
            : null;
      return mapped(
        w.masters.filter((x) => x.active && (!type || x.kind === type)),
        (x) => x.code + ' · ' + x.name,
      );
    }
    if (k === 'rule') return mapped(w.rules, (x) => x.pattern + ' · ' + x.role);
    if (k === 'manager' || k === 'cashier') return w.staff;
    if (k === 'chequebook')
      return mapped(
        w.documents.filter(
          (x) =>
            x.kind === 'CHEQUEBOOK' &&
            x.state === 'POSTED' &&
            x.account_id === f.account,
        ),
        (x) => x.reference,
      );
    if (k === 'status') return options(['LOST', 'SPOILED']);
    if (k === 'direction') return options(['INFLOW', 'OUTFLOW']);
    if (k === 'classification') return options(['FEE', 'INTEREST']);
    if (k === 'delimiter')
      return [
        { value: ',', label: 'Comma' },
        { value: ';', label: 'Semicolon' },
        { value: 'tab', label: 'Tab' },
      ];
    if (k === 'dateFormat') return options(['YYYY-MM-DD', 'DD/MM/YYYY']);
    if (k === 'role')
      return w.roles
        .filter(
          (x) =>
            (kind !== 'ACCOUNT' && !transfers.includes(kind)) ||
            x.accountType === 'ASSET',
        )
        .map((x) => ({ value: x.code, label: x.accountCode + ' · ' + x.code }));
    if (k === 'apVoucher')
      return mapped(
        w.payables.filter((x) => x.account_id === f.account),
        (x) => x.reference + ' / ' + x.currency + ' ' + x.amount,
      );
    if (k === 'account' || k === 'destination') {
      let types = ['BANK', 'TILL', 'WALLET'];
      if (k === 'destination')
        types =
          kind === 'REPLENISH' || kind === 'WITHDRAW' ? ['TILL'] : ['BANK'];
      else if (
        [
          'OPEN',
          'COUNT',
          'CLOSE',
          'CASHIER',
          'REVOKE_CASHIER',
          'RECEIPT',
          'PAYMENT',
          'DEPOSIT',
          'OVERAGE',
          'SHORTAGE',
        ].includes(kind)
      )
        types = ['TILL'];
      else if (
        [
          'EFT',
          'CHEQUE',
          'CHEQUEBOOK',
          'RETIRE_LEAF',
          'TRANSFER',
          'REPLENISH',
          'WITHDRAW',
        ].includes(kind)
      )
        types = ['BANK'];
      else if (kind === 'WALLET_SETTLE') types = ['WALLET'];
      return mapped(
        w.accounts.filter(
          (x) =>
            x.active &&
            types.includes(String(x.kind)) &&
            (k !== 'destination' || x.id !== f.account),
        ),
        (x) => String(x.code) + ' · ' + x.name + ' (' + x.currency + ')',
      );
    }
    if (k === 'line')
      return mapped(
        w.lines
          .filter(
            (x) =>
              !x.proof_id &&
              (kind === 'EFT_LINK' ||
                (!x.signoff_id &&
                  (kind === 'UNMATCH' ? x.entry_id : !x.entry_id))),
          )
          .filter((x) => !f.account || x.account_id === f.account)
          .filter(
            (x) =>
              !kind.startsWith('EFT') ||
              (f.target &&
                x.account_id ===
                  w.documents.find((d) => d.id === f.target)?.account_id &&
                Number(x.amount) < 0),
          ),
        (x) => x.day + ' · ' + x.reference + ' · ' + x.amount,
      );
    if (k === 'lines')
      return mapped(
        eligibleLines,
        (x) =>
          x.day + ' · ' + x.reference + ' · ' + amountLabel(String(x.amount)),
      );
    if (k === 'entry' && (kind === 'SPLIT_MATCH' || kind === 'TIMING'))
      return mapped(
        w.entries.filter(
          (e) =>
            !e.offset_id &&
            !outstanding(e).isZero() &&
            w.accounts.some((a) => a.id === e.account_id && a.kind !== 'TILL'),
        ),
        (e) =>
          e.code +
          ' · ' +
          e.reference +
          ' · ' +
          amountLabel(outstanding(e).toFixed()) +
          ' outstanding',
      );
    if (k === 'entry' && (kind === 'LINK_PLAN' || kind === 'UNLINK_PLAN')) {
      const plan = w.documents.find((d) => d.id === f.target);
      return mapped(
        w.entries.filter(
          (x) =>
            plan &&
            x.account_id === plan.account_id &&
            x.journal_id &&
            (kind === 'UNLINK_PLAN'
              ? w.planEntries?.some(
                  (l) => l.plan_id === plan.id && l.entry_id === x.id,
                )
              : !w.planEntries?.some((l) => l.entry_id === x.id)),
        ),
        (x) => x.day + ' · ' + x.reference + ' · ' + x.amount,
      );
    }
    if (k === 'entry' || k === 'entries')
      return mapped(
        w.entries.filter((x) =>
          kind === 'EFT_LINK'
            ? !!x.ap_document_id && (!x.line_id || x.line_id === f.line)
            : !x.line_id &&
              !x.offset_id &&
              (!f.line ||
                x.account_id ===
                  w.lines.find((l) => l.id === f.line)?.account_id),
        ),
        (x) => x.code + ' · ' + x.reference + ' · ' + x.amount,
      );
    if (k === 'statement' || k === 'replaces')
      return mapped(
        w.statements.filter(
          (x) =>
            !x.signoff_id &&
            !x.withdrawn_id &&
            (k !== 'replaces' || x.account_id === f.account),
        ),
        (x) =>
          w.accounts.find((a) => a.id === x.account_id)?.code + ' · ' + x.ends,
      );
    if (k === 'target') {
      if (kind === 'FX_SETTLE')
        return mapped(
          w.transfers.filter(
            (x) => x.received_id && !x.fx_id && Number(x.fx_difference) !== 0,
          ),
          (x) => x.reference + ' · ' + x.fx_difference,
        );
      if (kind === 'RECEIVE')
        return mapped(
          w.transfers.filter((x) => !x.received_id),
          (x) => x.reference + ' · ' + x.amount,
        );
      if (kind === 'SHORTAGE' || kind === 'OVERAGE')
        return mapped(
          w.counts,
          (x) => x.code + ' · ' + x.counted + ' / ' + x.expected,
        );
      if (kind === 'EFT_RELEASE')
        return mapped(
          (w.eftProofs ?? []).filter((p) => !p.entry_id),
          (p) => w.documents.find((d) => d.id === p.eft_id)?.reference ?? p.id,
        );
      if (kind.startsWith('EFT'))
        return mapped(
          w.documents.filter(
            (d) =>
              d.kind === 'EFT' &&
              d.state === 'POSTED' &&
              !w.eftProofs?.some((p) => p.eft_id === d.id) &&
              !w.documents.some(
                (x) =>
                  x.target === d.id &&
                  x.state === 'POSTED' &&
                  ['EFT_LINK', 'EFT_SETTLE', 'EFT_CANCEL'].includes(x.kind),
              ) &&
              (kind !== 'EFT_VERIFY' || d.ap_voucher) &&
              (kind !== 'EFT_SETTLE' || !d.ap_voucher),
          ),
          (x) => x.reference,
        );
      if (['CANCEL_PLAN', 'LINK_PLAN', 'UNLINK_PLAN'].includes(kind))
        return mapped(
          w.documents.filter(
            (d) =>
              d.kind === 'PLAN' &&
              d.state === 'POSTED' &&
              !w.documents.some(
                (x) =>
                  x.kind === 'CANCEL_PLAN' &&
                  x.state === 'POSTED' &&
                  x.target === d.id,
              ),
          ),
          (x) => x.reference,
        );
      if (kind !== 'REVERSE') return docs(['CHEQUE']);
      return mapped(
        w.documents.filter((x) => !!x.journal_id),
        (x) => x.reference + ' · ' + x.kind,
      );
    }
  };
  const accountType =
    kind === 'AMEND_ACCOUNT'
      ? w.accounts.find((a) => a.id === f.account)?.kind
      : f.type;
  const visible = fields[kind].filter((k) => {
    if (
      kind === 'EFT' &&
      f.apVoucher &&
      ['payee', 'beneficiary', 'bank', 'role', 'amount'].includes(k)
    )
      return false;
    if (k === 'destinationAmount')
      return (
        !!f.destination &&
        w.accounts.find((a) => a.id === f.destination)?.currency !==
          w.accounts.find((a) => a.id === f.account)?.currency
      );
    if (
      kind === 'STATEMENT' &&
      !mapping &&
      [
        'batch',
        'delimiter',
        'dateFormat',
        'dateColumn',
        'referenceColumn',
        'descriptionColumn',
        'amountColumn',
        'debitColumn',
        'creditColumn',
        'currencyColumn',
      ].includes(k)
    )
      return false;
    return (
      !['ACCOUNT', 'AMEND_ACCOUNT'].includes(kind) ||
      (accountType === 'TILL'
        ? !['institution', 'number', 'openItems'].includes(k)
        : !['office', 'manager', 'maximum', 'limit'].includes(k))
    );
  });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await save({
            kind,
            date: day,
            reference,
            requestKey: key.current,
            fields: Object.fromEntries(
              fields[kind]
                .filter(
                  (k) =>
                    f[k] !== undefined &&
                    f[k] !== '' &&
                    (kind === 'STATEMENT' || visible.includes(k)),
                )
                .map((k) => [k, f[k]]),
            ),
            evidence: proof,
            dimensions: dims,
          });
          R('');
          key.current = crypto.randomUUID();
        } catch {
          /* The workspace displays the server error. */
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label={
            ['BANK', 'OFFICE', 'ACCOUNT'].includes(kind)
              ? 'Code'
              : 'Document reference'
          }
          value={reference}
          change={(v) => {
            R(v);
            key.current = crypto.randomUUID();
          }}
        />
        <Field
          label="Accounting date"
          value={day}
          change={(v) => {
            D(v);
            key.current = crypto.randomUUID();
          }}
          type="date"
        />
        {visible.map((k) => {
          if (k === 'entries' || k === 'lines') {
            const selected = f[k]?.split(',').filter(Boolean) ?? [];
            return (
              <fieldset key={k} className="space-y-1 sm:col-span-2">
                <legend>{labels[k]}</legend>
                {(k === 'lines' ? f.entry : f.line) ? (
                  (choices(k) ?? []).map((o) => (
                    <label className="block text-sm" key={o.value}>
                      <input
                        type="checkbox"
                        checked={selected.includes(o.value)}
                        onChange={(e) =>
                          change(
                            k,
                            (e.target.checked
                              ? [...selected, o.value]
                              : selected.filter((x) => x !== o.value)
                            ).join(','),
                          )
                        }
                      />{' '}
                      {o.label}
                    </label>
                  ))
                ) : (
                  <p>
                    {k === 'lines'
                      ? 'Select a cashbook entry to see its bank lines.'
                      : 'Select a bank line to see its cashbook entries.'}
                  </p>
                )}
                {k === 'lines' && splitEntry && (
                  <p role={splitExceeded ? 'alert' : 'status'}>
                    {splitExceeded
                      ? 'Selected lines exceed the outstanding amount.'
                      : splitEntry.currency +
                        ' ' +
                        amountLabel(
                          splitRemaining.minus(selectedAmount).toFixed(),
                        ) +
                        ' remaining after matching'}
                  </p>
                )}
              </fieldset>
            );
          }
          if (k === 'csv')
            return (
              <label key={k} className="grid gap-1 text-sm">
                {labels[k]}
                <input
                  type="file"
                  accept=".csv,.txt,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1500000) {
                      E('Choose a file under 1.5 MB.');
                      return;
                    }
                    try {
                      change('csv', await file.text());
                      E('');
                    } catch {
                      E('The statement file could not be read.');
                    }
                  }}
                />
              </label>
            );
          if (k === 'openItems' || k === 'denominations')
            return (
              <label key={k} className="grid gap-1 text-sm">
                {labels[k]}
                <textarea
                  className="rounded border p-2"
                  value={f[k] || ''}
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            );
          const label =
            k === 'description' &&
            ['WITHDRAW_STATEMENT', 'EFT_RELEASE', 'RETIRE_LEAF'].includes(kind)
              ? 'Reason'
              : k === 'pattern'
                ? 'Text in bank reference or description'
                : k === 'classification'
                  ? 'Bank adjustment type'
                  : k === 'destinationAmount'
                    ? 'Agreed destination amount in receiving currency'
                    : k === 'role'
                      ? kind === 'ACCOUNT'
                        ? 'Account GL role'
                        : transfers.includes(kind)
                          ? 'Cash-in-transit GL role'
                          : labels[k]
                      : labels[k];
          return (
            <Field
              key={k}
              label={label}
              value={f[k] || ''}
              change={(v) => change(k, v)}
              options={choices(k)}
              type={['from', 'to', 'due'].includes(k) ? 'date' : 'text'}
            />
          );
        })}
        {fields[kind].includes('role') &&
          kind !== 'ACCOUNT' &&
          w.dimensions
            .filter((x) => x.code !== 'BRANCH')
            .map((d) => (
              <Field
                key={d.code}
                label={d.label}
                options={d.options}
                value={dims[d.code] || ''}
                change={(v) => {
                  key.current = crypto.randomUUID();
                  M({ ...dims, [d.code]: v });
                }}
              />
            ))}
        <DocumentField
          w={{ documents: w.evidence }}
          value={proof}
          change={(v) => {
            key.current = crypto.randomUUID();
            P(v);
          }}
        />
      </div>
      {kind === 'EFT' && f.apVoucher && (
        <p className="text-sm">
          The instruction uses the voucher amount and approved beneficiary. For
          a bank file, select Verify supplier EFT against a bank statement, then
          submit the voucher in Accounts Payable. For a voucher already posted
          with a signed bank confirmation, select Settle EFT against an existing
          payment.
        </p>
      )}
      {kind === 'EFT_VERIFY' && (
        <p className="text-sm">
          Attach the bank evidence and copy its debited account and beneficiary
          details. An independent reviewer confirms the debit before the payable
          journal can be submitted.
        </p>
      )}
      {kind === 'PLAN' && (
        <p className="text-sm">
          A posted receipt or payment in the same account and direction applies
          automatically when its reference matches the plan. Use Apply a
          cashbook entry to a plan for another reference.
        </p>
      )}
      {kind === 'ACCOUNT' && cutover.error && (
        <p role="alert">{getApiErrorMessage(cutover.error)}</p>
      )}
      {kind === 'ACCOUNT' && cutover.data && (
        <div className="space-y-2">
          <p>
            Certified GL opening at cutover: {f.currency} {cutover.data.opening}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => change('opening', cutover.data.opening)}
          >
            Use GL opening balance
          </Button>
          {f.type === 'TILL' && cutover.data.pendingReceipts > 0 && (
            <p role="alert">
              Post the {cutover.data.pendingReceipts} pending receipts before
              activating this till.
            </p>
          )}
        </div>
      )}
      {kind === 'STATEMENT' && (
        <>
          <p className="text-sm">
            The default CSV columns are date, reference and amount. Use a
            positive amount for money received and a negative amount for money
            paid.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => showMapping(!mapping)}
          >
            {mapping
              ? 'Hide import options'
              : 'Map bank columns or use an existing batch'}
          </Button>
        </>
      )}
      <ApEvidenceUpload
        companyId={company}
        refresh={refresh}
        documentType="CASH_BANK_EVIDENCE"
      />
      {fileError && <p role="alert">{fileError}</p>}
      <Button
        disabled={
          busy ||
          !reference.trim() ||
          (kind === 'SPLIT_MATCH' &&
            (!selectedParts.length ||
              selectedParts.length !== selectedLines.size ||
              splitExceeded))
        }
        type="submit"
      >
        Submit for review
      </Button>
    </form>
  );
}
