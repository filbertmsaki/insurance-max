import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '../journals/GlFields';
import {
  names,
  choices,
  options,
  type Choice,
  type Register,
  type Payload,
  type Send,
} from './customer-account-model';
import { CustomerOpeningImport } from './CustomerOpeningImport';
const accounts: Record<string, string> = {
  ar: 'Receivable control',
  income: 'Billing income',
  tax: 'Tax payable',
  advance: 'Advance liability',
  bank: 'Refund settlement bank',
  expense: 'Impairment expense',
  allowance: 'Loss allowance',
  premiumCash: 'Insurer premium cash control',
};

const documentGroups = {
  'Customer setup': ['CATEGORY', 'PROFILE', 'PAYER_MANDATE', 'POLICY'],
  'Notes and advances': [
    'DEBIT_NOTE',
    'CREDIT_NOTE',
    'CREDIT_APPLICATION',
    'CREDIT_REFUND',
    'ADVANCE',
    'ADVANCE_APPLICATION',
    'ADVANCE_RELEASE',
  ],
  'Impairment and reconciliation': [
    'IMPAIRMENT',
    'WRITE_OFF',
    'OPENING_IMPORT',
    'OPENING_VOID',
    'RECONCILIATION',
    'REVERSAL',
  ],
};

export function DocumentForm({
  w,
  send,
  busy,
  initialKind = 'CATEGORY',
  onKindChange,
}: {
  w: Register;
  send: Send;
  busy: boolean;
  initialKind?: string;
  onKindChange?: (kind: string) => void;
}) {
  const [kind, setKind] = useState(initialKind),
    [v, set] = useState<Record<string, string>>({}),
    [key, setKey] = useState(() => crypto.randomUUID());
  const [openingItems, setOpeningItems] = useState<Record<string, string>[]>(
    [],
  );
  const [external, setExternal] = useState([
    { date: w.today, reference: '', amount: '' },
  ]);
  function resetKind(next: string) {
    setKind(next);
    setOpeningItems([]);
    setExternal([{ date: w.today, reference: '', amount: '' }]);
    set({});
    setKey(crypto.randomUUID());
  }
  if (onKindChange && kind !== initialKind) resetKind(initialKind);
  const change = (name: string, value: string) => {
    set((current) => ({ ...current, [name]: value }));
    setKey(crypto.randomUUID());
  };
  const field = (
    name: string,
    label: string,
    opts?: Choice[],
    type = 'text',
    fallback = '',
  ) => (
    <Field
      key={name}
      label={label}
      value={v[name] ?? fallback}
      options={opts}
      type={type}
      change={(value) => change(name, value)}
    />
  );
  const customer = v.customerId,
    currency = v.currency ?? w.currencies[0],
    forDebtor = (r: { customer_id?: string; currency?: string }) =>
      r.customer_id === customer && r.currency === currency;
  const src = (
    {
      ADVANCE_APPLICATION: 'ADVANCE',
      ADVANCE_RELEASE: 'ADVANCE',
      CREDIT_APPLICATION: 'CREDIT_NOTE',
      CREDIT_REFUND: 'CREDIT_NOTE',
    } as Record<string, string>
  )[kind];
  const invoice = [
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'ADVANCE_APPLICATION',
    'CREDIT_APPLICATION',
    'IMPAIRMENT',
    'WRITE_OFF',
  ].includes(kind);
  const dims = Array.isArray(w.dimensions) ? w.dimensions : w.dimensions.fields;
  const submit = async () => {
    const evidence = w.evidence.find((x) => x.id === v.evidence);
    const input: Payload = {
      kind,
      reference: v.reference,
      currency,
      date: v.date ?? w.today,
      requestKey: key,
      evidence: evidence
        ? {
            id: evidence.id,
            documentId: evidence.document_id,
            hash: evidence.hash,
          }
        : undefined,
      customerId: customer,
      invoiceId: v.invoiceId,
      receiptId: v.receiptId,
      relatedId: v.relatedId,
      billingSourceId: v.billingSourceId || undefined,
      amount: v.amount,
      tax: v.tax,
      categoryId: v.categoryId,
      termCode: v.termCode,
      payerId: v.payerId,
      enabled: v.enabled !== 'Disabled',
      dimensions: Object.fromEntries(
        dims.filter((d) => v[d.code]).map((d) => [d.code, v[d.code]]),
      ),
    };
    if (kind === 'OPENING_IMPORT') {
      input.openingItems = openingItems;
      input.remainingAfterImport = v.remainingAfterImport || '0';
    }
    if (kind === 'POLICY')
      Object.assign(input, {
        requireProfile: v.creditPolicy !== 'Use FIN-01 terms during migration',
        roles: Object.fromEntries(
          Object.keys(accounts).map((k) => [k, v['role_' + k]]),
        ),
        lossRates: (v.rates ?? '').split(',').map((x) => x.trim()),
        reminderDays: (v.days ?? '').trim()
          ? v.days.split(',').map(Number)
          : [],
      });
    if (kind === 'RECONCILIATION')
      Object.assign(input, {
        from: v.from,
        opening: v.opening,
        statementLines: external.filter((l) => l.reference || l.amount),
      });
    await send(kind === 'OPENING_IMPORT' ? '/opening-imports' : '', { input });
    setOpeningItems([]);
    set({});
    setKey(crypto.randomUUID());
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit().catch(() => {});
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Document type"
          optionGroups={documentGroups}
          value={kind}
          options={Object.entries(names).map(([value, label]) => ({
            value,
            label,
          }))}
          change={onKindChange ?? resetKind}
        />
        {field('reference', 'Source reference or category name')}
        {field('date', 'Effective date', undefined, 'date', w.today)}
        {field('currency', 'Currency', options(w.currencies), 'text', currency)}
        {!['CATEGORY', 'POLICY', 'OPENING_IMPORT', 'OPENING_VOID'].includes(
          kind,
        ) && field('customerId', 'Customer', choices(w.customers))}
        {kind === 'OPENING_IMPORT' && (
          <CustomerOpeningImport
            currency={currency}
            items={openingItems}
            change={(items) => {
              setOpeningItems(items);
              setKey(crypto.randomUUID());
            }}
          />
        )}
        {kind === 'OPENING_IMPORT' &&
          field(
            'remainingAfterImport',
            'Balance left for later opening batches',
            undefined,
            'text',
            '0',
          )}
        {kind === 'OPENING_VOID' &&
          field(
            'relatedId',
            'Import to correct',
            choices(
              w.documents.filter(
                (d) =>
                  d.kind === 'OPENING_IMPORT' &&
                  d.state === 'POSTED' &&
                  d.currency === currency &&
                  !w.documents.some(
                    (v) =>
                      v.kind === 'OPENING_VOID' &&
                      v.state === 'POSTED' &&
                      v.data.relatedId === d.id,
                  ),
              ),
              'reference',
            ),
          )}
        {kind === 'PROFILE' && (
          <>
            {field(
              'categoryId',
              'Approved category',
              choices(
                w.documents.filter(
                  (d) => d.kind === 'CATEGORY' && d.state === 'APPROVED',
                ),
                'reference',
              ),
            )}
            {field(
              'termCode',
              'Payment terms',
              choices(w.terms, 'label', 'code'),
            )}
          </>
        )}
        {kind === 'PAYER_MANDATE' &&
          field(
            'payerId',
            'Authorized payer',
            choices(w.customers.filter((c) => c.id !== customer)),
          )}
        {['PAYER_MANDATE', 'CATEGORY'].includes(kind) &&
          field(
            'enabled',
            'Status',
            options(['Enabled', 'Disabled']),
            'text',
            'Enabled',
          )}
        {invoice &&
          field('invoiceId', 'Invoice', choices(w.invoices.filter(forDebtor)))}
        {kind === 'ADVANCE' &&
          field(
            'receiptId',
            'Unallocated receipt',
            choices(
              w.receipts.filter((r) => forDebtor(r) && Number(r.available) > 0),
            ),
          )}
        {(src || kind === 'REVERSAL') &&
          field(
            'relatedId',
            'Posted source document',
            w.documents
              .filter(
                (r) =>
                  forDebtor(r) &&
                  r.state === 'POSTED' &&
                  (src
                    ? r.kind === src
                    : [
                        'CREDIT_NOTE',
                        'DEBIT_NOTE',
                        'CREDIT_APPLICATION',
                        'IMPAIRMENT',
                        'WRITE_OFF',
                        'ADVANCE',
                        'ADVANCE_APPLICATION',
                        'ADVANCE_RELEASE',
                      ].includes(r.kind)),
              )
              .map((r) => ({
                value: r.id,
                label: 'AR-' + r.sequence + ' · ' + r.reference,
              })),
          )}
        {![
          'CATEGORY',
          'POLICY',
          'PAYER_MANDATE',
          'REVERSAL',
          'OPENING_IMPORT',
          'OPENING_VOID',
          'IMPAIRMENT',
        ].includes(kind) &&
          field(
            'amount',
            kind === 'PROFILE'
              ? 'Approved credit limit'
              : kind === 'RECONCILIATION'
                ? 'External closing balance'
                : 'Amount',
          )}
        {kind === 'DEBIT_NOTE' &&
          field(
            'billingSourceId',
            'Originating endorsement invoice, if already billed',
            choices(
              w.invoices.filter(
                (i) =>
                  forDebtor(i) &&
                  (i.endorsement_id || i.source_type?.includes('ENDORSEMENT')),
              ),
            ),
          )}
        {kind === 'CREDIT_NOTE' &&
          field(
            'billingSourceId',
            'Originating policy return, if already approved',
            choices(
              w.refunds.filter(
                (r) => r.invoice_id === v.invoiceId && r.source_record_id,
              ),
              'refund_no',
            ),
          )}
        {['DEBIT_NOTE', 'CREDIT_NOTE'].includes(kind) &&
          field('tax', 'Tax included in amount', undefined, 'text', '0')}
        {kind === 'POLICY' && (
          <>
            {field(
              'creditPolicy',
              'Credit terms for customers without a profile',
              options([
                'Require an approved profile',
                'Use FIN-01 terms during migration',
              ]),
              'text',
              'Require an approved profile',
            )}
            {Object.entries(accounts).map(([k, label]) =>
              field('role_' + k, label, choices(w.roles, 'code', 'code')),
            )}
            {field(
              'rates',
              'Loss percentages for current, 1–30, 31–60, 61–90 and over 90 days',
            )}
            {field('days', 'Reminder days after due date, separated by commas')}
          </>
        )}
        {![
          'CATEGORY',
          'PROFILE',
          'PAYER_MANDATE',
          'POLICY',
          'RECONCILIATION',
          'REVERSAL',
        ].includes(kind) && dims.map((d) => field(d.code, d.label, d.options))}
        {field('evidence', 'Supporting document', choices(w.evidence, 'title'))}
        {kind === 'RECONCILIATION' && (
          <>
            {field('from', 'Statement start date', undefined, 'date')}
            {field('opening', 'External opening balance')}
          </>
        )}
      </div>
      {kind === 'RECONCILIATION' && (
        <fieldset className="space-y-2">
          <legend>External statement movements</legend>
          {external.map((l, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-3">
              {(['date', 'reference', 'amount'] as const).map((k) => (
                <Field
                  key={k}
                  label={k}
                  type={k === 'date' ? 'date' : 'text'}
                  value={l[k]}
                  change={(value) => {
                    setExternal(
                      external.map((x, j) =>
                        j === i ? { ...x, [k]: value } : x,
                      ),
                    );
                    setKey(crypto.randomUUID());
                  }}
                />
              ))}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setExternal([
                ...external,
                { date: w.today, reference: '', amount: '' },
              ])
            }
          >
            Add statement line
          </Button>
        </fieldset>
      )}
      <Button
        disabled={busy || (kind === 'OPENING_IMPORT' && !openingItems.length)}
      >
        Submit for independent review
      </Button>
    </form>
  );
}

export function CashForm({
  w,
  send,
  busy,
  canAllocate,
  canRefund,
}: {
  w: Register;
  send: Send;
  busy: boolean;
  canAllocate: boolean;
  canRefund: boolean;
}) {
  const [mode, M] = useState(
      canAllocate ? 'Allocate receipt' : 'Request refund',
    ),
    [rid, R] = useState(''),
    [iid, I] = useState(''),
    [amount, A] = useState(''),
    [reason, N] = useState(''),
    [key, K] = useState(() => crypto.randomUUID());
  const r = w.receipts.find((x) => x.id === rid);
  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onChange={() => K(crypto.randomUUID())}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (mode === 'Allocate receipt')
            await send(
              '/receipts/' + rid + '/allocate',
              { invoice_id: iid, amount, idempotency_key: key },
              true,
            );
          else
            await send(
              '/refunds',
              {
                receipt_id: rid,
                invoice_id: iid || undefined,
                amount,
                reason,
                idempotency_key: key,
              },
              true,
            );
          A('');
          K(crypto.randomUUID());
        } catch {
          /* displayed by the workspace */
        }
      }}
    >
      <Field
        label="Cash action"
        value={mode}
        change={M}
        options={options([
          ...(canAllocate ? ['Allocate receipt'] : []),
          ...(canRefund ? ['Request refund'] : []),
        ])}
      />
      <Field
        label="Receipt"
        value={rid}
        change={(x) => {
          R(x);
          I('');
        }}
        options={choices(w.receipts)}
      />
      <Field
        label={
          mode === 'Allocate receipt'
            ? 'Invoice'
            : 'Original invoice, if refunding allocated cash'
        }
        value={iid}
        change={I}
        options={choices(w.invoices.filter((i) => i.currency === r?.currency))}
      />
      <Field label="Amount" value={amount} change={A} />
      {mode === 'Request refund' && (
        <Field label="Refund reason" value={reason} change={N} />
      )}
      <Button
        disabled={
          busy || !rid || !amount || (mode === 'Allocate receipt' && !iid)
        }
      >
        {mode}
      </Button>
    </form>
  );
}
